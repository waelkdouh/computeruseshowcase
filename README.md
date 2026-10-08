# Microsoft Foundry Computer Use Showcase

This demo makes real calls to a customer-owned Microsoft Foundry project and runs the resulting computer-use actions in an isolated Playwright Chromium browser against the test applications you configure. The agent reads screenshots of those applications and proposes UI actions; the server executes an action only after a person approves it.

## Prerequisites

1. An Azure subscription and Microsoft Foundry project.
2. Access to the preview `computer-use-preview` model. Request access through the [Microsoft application form](https://aka.ms/oai/cuaaccess), then deploy the model in your Foundry project in a supported region. Use the deployment name in the configuration below.
3. Azure CLI installed and signed in as an identity allowed to create/use agents and invoke the model in that project.
4. A dedicated, isolated VM for the showcase, with access only to non-production test applications and accounts. Do not run against production or data you would not send to the model.
5. Python 3.10 or later.

See Microsoft's [current Computer Use Preview guide](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/computer-use) for access, region support, current SDKs, and security guidance. The computer-use model is in preview; its availability and API can change.

## Configure and start

On macOS or Linux:

```sh
cd /path/to/computeruseshowcase
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env
```

On Windows, in PowerShell:

```powershell
cd C:\path\to\computeruseshowcase
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m playwright install chromium
Copy-Item .env.example .env
```

If PowerShell blocks `Activate.ps1`, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` and try again.

Edit `.env` with the project endpoint shown in your Foundry project's **Overview**, the name of your computer-use model deployment, and the exact origins of the test apps the browser is permitted to access. For example:

```sh
FOUNDRY_PROJECT_ENDPOINT=https://your-resource.ai.azure.com/api/projects/your-project
COMPUTER_USE_MODEL_DEPLOYMENT_NAME=computer-use-preview
COMPUTER_USE_ALLOWED_ORIGINS=https://crm-test.example.com,https://portal-test.example.com
PORT=8765
```

Authenticate with Azure CLI, load `.env` into the current shell, and start the local server. The endpoint listens only on loopback.

On macOS or Linux:

```sh
az login
set -a
. ./.env
set +a
python server.py
```

On Windows, in PowerShell:

```powershell
az login
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#\s=][^=]*)=(.*)$') { Set-Item "Env:$($Matches[1].Trim())" $Matches[2].Trim() }
}
python server.py
```

Open <http://127.0.0.1:8765>. Choose a scenario, enter the first test-app URL and a specific task, then start the run. The multi-system scenario also needs the second app's URL. The model can switch between the configured origins with **Ctrl+L**, type the provided URL, and press **Enter**; other origins are blocked. It can use normal in-app links as well.

Run the focused local checks with `python -m unittest discover -s tests -v`.

## Safety and data handling

- The browser is a fresh, headless Chromium context and is closed when you close or decline a run. It does not reuse the operator's personal browser profile.
- Every action proposed by the model must be approved in the showcase before the browser executes it. Foundry safety checks are shown alongside the proposed action; approving acknowledges those checks. Declining closes the session without executing that pending action.
- Browser navigation and subrequests are restricted to the exact origins in `COMPUTER_USE_ALLOWED_ORIGINS`. Add any required test-app or authentication origins explicitly; do not allowlist production systems.
- Screenshots and prompts, including any visible page contents, are sent to Microsoft Foundry for inference. Use synthetic or otherwise approved demo data. Do not type passwords, secrets, or sensitive personal information into the controlled browser.
- The model deployment, Azure permissions, target applications, test accounts, and isolated VM belong to the operator/customer; this repository does not provision them.
- Each run creates a temporary Foundry agent version and removes it when the session is closed. Keep this demo on a trusted local machine or isolated VM; it is not a multi-user web service.

The three scenarios are examples of interaction patterns. Replace their starter task text with a narrow task against your own test systems; use non-production data and review the model's decision at every action.
