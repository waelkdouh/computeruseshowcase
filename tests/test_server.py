import os
import runpy
import shutil
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import server


SETTING_NAMES = (
    "FOUNDRY_PROJECT_ENDPOINT",
    "COMPUTER_USE_MODEL_DEPLOYMENT_NAME",
    "COMPUTER_USE_ALLOWED_ORIGINS",
    "PORT",
)


def load_server_settings(env_file_text=None, shell_environment=None):
    """Run a copy of server.py from a temporary folder with a controlled shell environment."""
    with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ):
        for name in SETTING_NAMES:
            os.environ.pop(name, None)
        os.environ.update(shell_environment or {})
        server_copy = Path(folder, "server.py")
        shutil.copy(server.__file__, server_copy)
        if env_file_text is not None:
            Path(folder, ".env").write_text(env_file_text, encoding="utf-8")
        return runpy.run_path(str(server_copy))


class BrowserStub:
    def __init__(self):
        self.mouse = SimpleNamespace(
            calls=[],
            click=lambda *args: self.mouse.calls.append(("click", *args)),
            dblclick=lambda *args: self.mouse.calls.append(("dblclick", *args)),
            move=lambda *args: self.mouse.calls.append(("move", *args)),
            wheel=lambda *args: self.mouse.calls.append(("wheel", *args)),
            down=lambda: self.mouse.calls.append(("down",)),
            up=lambda: self.mouse.calls.append(("up",)),
        )
        self.keyboard = SimpleNamespace(
            calls=[],
            type=lambda text: self.keyboard.calls.append(("type", text)),
            press=lambda key: self.keyboard.calls.append(("press", key)),
        )
        self.navigations = []

    def goto(self, url, **_kwargs):
        self.navigations.append(url)

    def wait_for_timeout(self, _duration):
        pass


class ComputerUseServerTests(unittest.TestCase):
    def test_env_file_overrides_shell_values_and_shell_fills_missing_keys(self):
        settings = load_server_settings(
            env_file_text=(
                "FOUNDRY_PROJECT_ENDPOINT=https://from-file.example.test/api/projects/demo\n"
                "COMPUTER_USE_ALLOWED_ORIGINS=https://crm.example.test/, https://portal.example.test\n"
                "PORT=9123\n"
            ),
            shell_environment={
                "FOUNDRY_PROJECT_ENDPOINT": "https://stale-shell.example.test/api/projects/old",
                "COMPUTER_USE_ALLOWED_ORIGINS": "https://stale-shell.example.test",
                "PORT": "2222",
                "COMPUTER_USE_MODEL_DEPLOYMENT_NAME": "model-from-shell",
            },
        )
        self.assertEqual(settings["FOUNDRY_ENDPOINT"], "https://from-file.example.test/api/projects/demo")
        self.assertEqual(
            settings["ALLOWED_ORIGINS"],
            {"https://crm.example.test", "https://portal.example.test"},
        )
        self.assertEqual(settings["PORT"], 9123)
        self.assertEqual(settings["MODEL"], "model-from-shell")

    def test_shell_values_and_defaults_apply_without_env_file(self):
        settings = load_server_settings(
            shell_environment={"FOUNDRY_PROJECT_ENDPOINT": "https://from-shell.example.test/api/projects/demo"},
        )
        self.assertEqual(settings["FOUNDRY_ENDPOINT"], "https://from-shell.example.test/api/projects/demo")
        self.assertEqual(settings["ALLOWED_ORIGINS"], set())
        self.assertEqual(settings["MODEL"], "computer-use-preview")
        self.assertEqual(settings["PORT"], 8765)

    def test_agent_version_and_temporary_agent_are_deleted(self):
        calls = []

        class Agents:
            def create_version(self, **kwargs):
                calls.append(("create_version", kwargs["agent_name"]))
                return SimpleNamespace(version="1")

            def get(self, **kwargs):
                return SimpleNamespace(agent_endpoint="previous")

            def update_details(self, **kwargs):
                calls.append(("update_details", kwargs["agent_endpoint"]))

            def delete_version(self, **kwargs):
                calls.append(("delete_version", kwargs["agent_version"]))

            def delete(self, **kwargs):
                calls.append(("delete_agent", kwargs["agent_name"]))

        fake_project = SimpleNamespace(agents=Agents())
        with patch.object(server, "project", fake_project):
            with server.create_agent("showcase-test-agent"):
                calls.append(("run",))

        self.assertEqual(
            [call[0] for call in calls],
            [
                "create_version",
                "update_details",
                "run",
                "update_details",
                "delete_version",
                "delete_agent",
            ],
        )
        self.assertIsInstance(calls[1][1], server.AgentEndpointConfig)
        self.assertEqual(calls[3], ("update_details", "previous"))
        self.assertEqual(calls[4], ("delete_version", "1"))
        self.assertEqual(calls[5], ("delete_agent", "showcase-test-agent"))

    def test_target_origin_must_be_allowlisted(self):
        with patch.object(server, "ALLOWED_ORIGINS", {"https://crm.example.test"}):
            self.assertEqual(
                server.validate_target("https://crm.example.test/customers"),
                "https://crm.example.test/customers",
            )
            with self.assertRaisesRegex(ValueError, "not in COMPUTER_USE_ALLOWED_ORIGINS"):
                server.validate_target("https://other.example.test/")

    def test_rejects_embedded_credentials_and_non_http_urls(self):
        with self.assertRaisesRegex(ValueError, "must not contain usernames or passwords"):
            server.origin_for("https://name@crm.example.test/")
        with self.assertRaisesRegex(ValueError, "http:// or https://"):
            server.origin_for("file:///etc/passwd")

    def test_approved_browser_shortcut_navigates_only_to_an_allowed_target(self):
        browser = BrowserStub()
        session = {
            "page": browser,
            "address_focused": False,
            "address_buffer": "",
        }
        with patch.object(server, "ALLOWED_ORIGINS", {"https://portal.example.test"}):
            server.execute_action(
                session,
                SimpleNamespace(type="keypress", keys=["CTRL", "L"]),
            )
            server.execute_action(
                session,
                SimpleNamespace(type="type", text="https://portal.example.test/account"),
            )
            server.execute_action(
                session,
                SimpleNamespace(type="keypress", keys=["ENTER"]),
            )
        self.assertEqual(browser.navigations, ["https://portal.example.test/account"])
        self.assertFalse(session["address_focused"])

    def test_browser_navigation_rejects_unapproved_origins(self):
        browser = BrowserStub()
        session = {"page": browser, "address_focused": False, "address_buffer": ""}
        with patch.object(server, "ALLOWED_ORIGINS", {"https://portal.example.test"}):
            server.execute_action(session, SimpleNamespace(type="keypress", keys=["CTRL", "L"]))
            server.execute_action(
                session,
                SimpleNamespace(type="type", text="https://unlisted.example.test/"),
            )
            with self.assertRaisesRegex(ValueError, "not in COMPUTER_USE_ALLOWED_ORIGINS"):
                server.execute_action(
                    session,
                    SimpleNamespace(type="keypress", keys=["ENTER"]),
                )
        self.assertEqual(browser.navigations, [])

    def test_actions_are_executed_in_browser_viewport(self):
        browser = BrowserStub()
        session = {"page": browser}
        server.execute_action(
            session,
            SimpleNamespace(type="click", x=5000, y=-4),
        )
        server.execute_action(
            session,
            SimpleNamespace(type="type", text="Contoso"),
        )
        self.assertEqual(browser.mouse.calls, [("click", 1279, 0)])
        self.assertEqual(browser.keyboard.calls, [("type", "Contoso")])


if __name__ == "__main__":
    unittest.main()
