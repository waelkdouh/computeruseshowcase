import unittest
from types import SimpleNamespace
from unittest.mock import patch

import server


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
