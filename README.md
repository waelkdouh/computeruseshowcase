# Computer Use Showcase

A small, dependency-free browser demo of three computer-use workflows:

- **Legacy application navigation** — open a business app, find a customer, collect account details, and update a record.
- **Multi-system workflow** — read an email, retrieve information from a portal, update a second system, and prepare a summary.
- **Human approval** — gather information, prepare a recommendation, pause for a person's decision, and complete the workflow only after approval.

## Run locally

Open `index.html` in a modern browser, or serve this directory with any static web server, for example:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

Select a workflow and choose **Start workflow**. Advance actions one at a time; the approval workflow presents explicit **Approve** and **Decline** choices before the agent can continue.

This is an interactive simulation for illustrating workflow patterns. It does not connect to Azure, use a computer-use model, access real applications, or make external changes.
