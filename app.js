const workflows = {
  legacy: {
    title: "Legacy application navigation",
    subtitle: "Update a customer record in a line-of-business app",
    icon: "⌘",
    name: "Customer records",
    address: "business.local / customers",
    steps: [
      { title: "Launch customer system", detail: "Open the business workspace", screen: "launch" },
      { title: "Find the customer", detail: "Search for Contoso account", screen: "search" },
      { title: "Collect account details", detail: "Review customer information", screen: "details" },
      { title: "Update the record", detail: "Save the requested contact update", screen: "update" },
    ],
  },
  multi: {
    title: "Multi-system workflow",
    subtitle: "Move a request from email to a second system",
    icon: "⤢",
    name: "Email & service portal",
    address: "workspace.local / inbox",
    steps: [
      { title: "Read the incoming email", detail: "Identify account and request", screen: "email" },
      { title: "Retrieve portal information", detail: "Look up the current service plan", screen: "portal" },
      { title: "Update the second system", detail: "Save the account note in CRM", screen: "crm" },
      { title: "Create a summary", detail: "Prepare a concise workflow recap", screen: "summary" },
    ],
  },
  approval: {
    title: "Human approval pattern",
    subtitle: "A person reviews the recommendation before action",
    icon: "✓",
    name: "Review workspace",
    address: "workspace.local / review",
    steps: [
      { title: "Gather information", detail: "Review account history and request", screen: "gather" },
      { title: "Prepare recommendation", detail: "Draft a proposed account adjustment", screen: "recommend" },
      { title: "Request human approval", detail: "Wait for a person's decision", screen: "approval", gate: true },
      { title: "Complete the workflow", detail: "Apply the approved adjustment", screen: "complete" },
    ],
    approval: "Recommendation: apply a one-time service credit of $50 to Contoso's account based on the verified outage. No change is made until you approve.",
  },
};

const app = {
  workflow: "legacy",
  step: -1,
  state: "ready",
};

const elements = {
  cards: [...document.querySelectorAll(".workflow-card")],
  title: document.querySelector("#workflow-title"),
  subtitle: document.querySelector("#workflow-subtitle"),
  icon: document.querySelector("#workspace-icon"),
  status: document.querySelector("#run-status"),
  screen: document.querySelector("#screen"),
  caption: document.querySelector("#step-caption"),
  screenApp: document.querySelector("#screen-app"),
  list: document.querySelector("#step-list"),
  counter: document.querySelector("#step-counter"),
  start: document.querySelector("#start-button"),
  reset: document.querySelector("#reset-button"),
  approval: document.querySelector("#approval-card"),
  approvalCopy: document.querySelector("#approval-copy"),
  approve: document.querySelector("#approve-button"),
  decline: document.querySelector("#decline-button"),
};

const statusLabels = {
  ready: "Ready",
  running: "In progress",
  awaiting: "Awaiting approval",
  complete: "Completed",
  declined: "Declined",
};

function renderScreen(step) {
  if (!step) {
    elements.caption.textContent = "WAITING TO START";
    elements.screenApp.textContent = workflows[app.workflow].name;
    elements.screen.innerHTML = '<div class="screen-empty"><span class="screen-empty-icon" aria-hidden="true">⌘</span><strong>Your agent workspace is ready</strong><p>Start the workflow to see the agent move through each task.</p></div>';
    return;
  }

  const screenTemplates = {
    launch: '<div class="mock-app-heading"><strong>Northwind Business System</strong><span>Home · Customers · Reports</span></div><div class="mock-message"><strong>Customer management</strong>Search for a customer account to view contact information, service history, and account status.</div>',
    search: '<div class="mock-app-heading"><strong>Customer search</strong><span>3 results</span></div><div class="mock-search">⌕ &nbsp; Contoso Ltd.</div><table class="mock-table"><thead><tr><th>Account</th><th>Contact</th><th>Status</th></tr></thead><tbody><tr><td class="mock-highlight">Contoso Ltd.</td><td>Jamie Chen</td><td><span class="mock-tag">Active</span></td></tr><tr><td>Contoso Retail</td><td>R. Patel</td><td>Active</td></tr></tbody></table>',
    details: '<div class="mock-app-heading"><strong>Contoso Ltd.</strong><span><span class="mock-tag">Active account</span></span></div><table class="mock-table"><tbody><tr><th>Account owner</th><td>Jamie Chen</td></tr><tr><th>Service plan</th><td>Enterprise Plus</td></tr><tr><th>Renewal date</th><td>November 30, 2026</td></tr><tr><th>Last contact</th><td>October 6, 2026</td></tr></tbody></table>',
    update: '<div class="mock-app-heading"><strong>Edit customer record</strong><span>Contoso Ltd.</span></div><table class="mock-table"><tbody><tr><th>Primary contact</th><td>Jamie Chen</td></tr><tr><th>Account note</th><td class="mock-highlight">Follow up requested · saved</td></tr><tr><th>Record status</th><td><span class="mock-tag">Updated</span></td></tr></tbody></table>',
    email: '<div class="mock-app-heading"><strong>Inbox</strong><span>1 unread</span></div><div class="mock-message"><strong>From: Jamie Chen · Contoso Ltd.</strong>Could you confirm our current service plan and add a note to our account about next month’s renewal review?<br><br><span>Received: October 8, 2026</span></div>',
    portal: '<div class="mock-app-heading"><strong>Service portal</strong><span>Account overview</span></div><table class="mock-table"><tbody><tr><th>Account</th><td>Contoso Ltd.</td></tr><tr><th>Plan</th><td>Enterprise Plus</td></tr><tr><th>Renewal</th><td>November 30, 2026</td></tr><tr><th>Portal status</th><td><span class="mock-tag">Verified</span></td></tr></tbody></table>',
    crm: '<div class="mock-app-heading"><strong>CRM · Contoso Ltd.</strong><span>Account notes</span></div><div class="mock-message"><strong>New note · October 8, 2026</strong>Customer requested confirmation of their Enterprise Plus plan and a follow-up for the November 30 renewal review.<br><br><span class="mock-tag">Saved to account</span></div>',
    summary: '<div class="mock-app-heading"><strong>Workflow summary</strong><span>Ready to share</span></div><div class="mock-summary"><strong>Contoso renewal request</strong>Confirmed Enterprise Plus service plan in the portal. Added the requested November renewal follow-up to the CRM account. Email and account details matched.</div>',
    gather: '<div class="mock-app-heading"><strong>Contoso account review</strong><span>Information gathered</span></div><table class="mock-table"><tbody><tr><th>Service status</th><td>Outage resolved</td></tr><tr><th>Incident window</th><td>October 4, 2026</td></tr><tr><th>Account history</th><td>Enterprise Plus · Active</td></tr><tr><th>Customer request</th><td>Review service impact</td></tr></tbody></table>',
    recommend: '<div class="mock-app-heading"><strong>Recommendation draft</strong><span>Not applied</span></div><div class="mock-summary"><strong>Proposed action: $50 service credit</strong>Verified outage affected the customer’s service. A one-time credit is within the standard support allowance.<br><br>Next step: human review required.</div>',
    approval: '<div class="mock-app-heading"><strong>Approval required</strong><span>Waiting for reviewer</span></div><div class="mock-summary"><strong>Nothing has been changed.</strong>The agent prepared a recommendation and is paused. Approve or decline in the activity panel to decide what happens next.</div>',
    complete: '<div class="mock-app-heading"><strong>Contoso account</strong><span><span class="mock-tag">Workflow complete</span></span></div><table class="mock-table"><tbody><tr><th>Service credit</th><td class="mock-highlight">$50 one-time credit applied</td></tr><tr><th>Approval</th><td>Approved by human reviewer</td></tr><tr><th>Account status</th><td>Active</td></tr></tbody></table>',
  };

  elements.caption.textContent = app.state === "awaiting" ? "HUMAN REVIEW REQUIRED" : `ACTION ${String(app.step + 1).padStart(2, "0")}`;
  elements.screenApp.textContent = workflows[app.workflow].name;
  elements.screen.innerHTML = `<div class="mock-window"><div class="mock-toolbar"><span class="window-dot"></span><span class="window-dot"></span><span class="window-dot"></span><div class="mock-address">${workflows[app.workflow].address}</div></div><div class="mock-app">${screenTemplates[step.screen]}</div></div>`;
}

function renderSteps() {
  const { steps } = workflows[app.workflow];
  elements.list.innerHTML = "";
  steps.forEach((step, index) => {
    const item = document.createElement("li");
    const done = index < app.step || (app.state === "complete" && index <= app.step);
    const active = index === app.step && ["running", "awaiting"].includes(app.state);
    item.className = `step-item${done ? " done" : ""}${active ? " active" : ""}`;
    item.innerHTML = `<span class="step-marker" aria-hidden="true">${done ? "✓" : String(index + 1).padStart(2, "0")}</span><span class="step-text"><strong>${step.title}</strong><span>${done ? "Completed" : active ? (step.gate ? "Waiting for your decision" : "Agent is working") : step.detail}</span></span>`;
    elements.list.append(item);
  });

  const completed = app.state === "complete" ? steps.length : Math.max(0, app.step);
  elements.counter.textContent = `${completed} / ${steps.length}`;
}

function render() {
  const workflow = workflows[app.workflow];
  elements.title.textContent = workflow.title;
  elements.subtitle.textContent = workflow.subtitle;
  elements.icon.textContent = workflow.icon;
  elements.cards.forEach((card, index) => {
    const selected = card.dataset.workflow === app.workflow;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
    if (selected) document.querySelector(".scenario-count").innerHTML = `${String(index + 1).padStart(2, "0")} <span>/</span> 03`;
  });
  elements.status.dataset.state = app.state;
  elements.status.innerHTML = `<span class="status-dot"></span> ${statusLabels[app.state]}`;
  renderSteps();
  const currentStep = app.step >= 0 ? workflow.steps[app.step] : null;
  renderScreen(currentStep);

  const isApproval = app.state === "awaiting";
  elements.approval.hidden = !isApproval;
  elements.approvalCopy.textContent = workflow.approval || "";
  elements.start.hidden = app.state === "complete" || app.state === "declined";
  elements.reset.hidden = !elements.start.hidden;
  elements.start.disabled = isApproval;
  elements.start.innerHTML = app.state === "ready"
    ? 'Start workflow <span aria-hidden="true">→</span>'
    : 'Run next action <span aria-hidden="true">→</span>';
}

function advance() {
  const steps = workflows[app.workflow].steps;
  if (app.state === "ready") {
    app.state = "running";
    app.step = 0;
  } else if (app.state === "running") {
    if (app.step === steps.length - 1) {
      app.state = "complete";
    } else {
      app.step += 1;
      if (steps[app.step].gate) app.state = "awaiting";
    }
  }
  render();
}

elements.cards.forEach((card) => {
  card.addEventListener("click", () => {
    app.workflow = card.dataset.workflow;
    app.step = -1;
    app.state = "ready";
    render();
  });
});
elements.start.addEventListener("click", advance);
elements.reset.addEventListener("click", () => {
  app.step = -1;
  app.state = "ready";
  render();
});
elements.approve.addEventListener("click", () => {
  app.state = "running";
  app.step += 1;
  render();
});
elements.decline.addEventListener("click", () => {
  app.state = "declined";
  render();
});

render();
