const scenarios = {
  legacy: {
    title: "Legacy application navigation",
    subtitle: "Find a record and update it through the real application UI.",
    icon: "⌘",
    task: "Find the customer record I specify, review the relevant account details, and make the specific update I request. Summarize what you changed.",
  },
  multi: {
    title: "Multi-system workflow",
    subtitle: "Read information in one app, update another, and prepare a summary.",
    icon: "⤢",
    task: "Read the request in the first application, verify the requested information, update the matching record in the second application, and summarize what you did.",
  },
  approval: {
    title: "Human approval pattern",
    subtitle: "Gather evidence and prepare a recommendation for review.",
    icon: "✓",
    task: "Review the account information and request, gather the relevant evidence, and recommend a specific next step. Do not change any records until I approve your recommendation.",
  },
};

const state = { scenario: "legacy", sessionId: null, status: "ready", allowedOrigins: [] };
const elements = {
  cards: [...document.querySelectorAll(".workflow-card")],
  title: document.querySelector("#workflow-title"),
  subtitle: document.querySelector("#workflow-subtitle"),
  icon: document.querySelector("#workspace-icon"),
  status: document.querySelector("#run-status"),
  activityTitle: document.querySelector("#activity-title"),
  stepCaption: document.querySelector("#step-caption"),
  screen: document.querySelector("#screen"),
  screenApp: document.querySelector("#screen-app"),
  counter: document.querySelector("#step-counter"),
  startUrl: document.querySelector("#start-url"),
  secondaryUrl: document.querySelector("#secondary-url"),
  secondaryLabel: document.querySelector("#secondary-label"),
  task: document.querySelector("#task-input"),
  allowed: document.querySelector("#allowed-targets"),
  setup: document.querySelector("#setup-fields"),
  action: document.querySelector("#action-card"),
  actionTitle: document.querySelector("#action-title"),
  actionDescription: document.querySelector("#action-description"),
  safetyChecks: document.querySelector("#safety-checks"),
  recommendationCard: document.querySelector("#recommendation-card"),
  recommendation: document.querySelector("#recommendation"),
  feedback: document.querySelector("#feedback"),
  start: document.querySelector("#start-button"),
  approve: document.querySelector("#approve-button"),
  approveRecommendation: document.querySelector("#recommendation-button"),
  decline: document.querySelector("#decline-button"),
  close: document.querySelector("#close-button"),
};

const labels = {
  ready: "Ready",
  starting: "Starting",
  awaiting_action: "Action needs approval",
  awaiting_recommendation: "Recommendation ready",
  completed: "Completed",
  declined: "Declined",
  error: "Error",
};

function setStatus(status) {
  state.status = status;
  elements.status.dataset.state = status;
  elements.status.replaceChildren();
  const dot = document.createElement("span");
  dot.className = "status-dot";
  elements.status.append(dot, document.createTextNode(` ${labels[status] || status}`));
}

function setBusy(busy) {
  elements.start.disabled = busy;
  elements.approve.disabled = busy;
  elements.approveRecommendation.disabled = busy;
  elements.decline.disabled = busy;
  if (busy) elements.feedback.textContent = "Working with Microsoft Foundry…";
}

function render() {
  const scenario = scenarios[state.scenario];
  elements.title.textContent = scenario.title;
  elements.subtitle.textContent = scenario.subtitle;
  elements.icon.textContent = scenario.icon;
  elements.task.value = elements.task.value || scenario.task;
  elements.cards.forEach((card, index) => {
    const selected = card.dataset.workflow === state.scenario;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
    card.disabled = Boolean(state.sessionId);
    if (selected) {
      document.querySelector(".scenario-count").innerHTML = `${String(index + 1).padStart(2, "0")} <span>/</span> 03`;
    }
  });

  const active = Boolean(state.sessionId);
  elements.setup.hidden = active;
  elements.start.hidden = active;
  elements.action.hidden = state.status !== "awaiting_action";
  elements.approve.hidden = state.status !== "awaiting_action";
  elements.decline.hidden = !["awaiting_action", "awaiting_recommendation"].includes(state.status);
  elements.recommendationCard.hidden = state.status !== "awaiting_recommendation";
  elements.approveRecommendation.hidden = state.status !== "awaiting_recommendation";
  elements.close.hidden = !["completed", "declined", "error"].includes(state.status);
  elements.secondaryUrl.hidden = state.scenario !== "multi";
  elements.secondaryLabel.hidden = state.scenario !== "multi";

  const progress = state.actionCount || 0;
  elements.counter.textContent = `${progress} / 20 actions`;
  elements.activityTitle.textContent = active ? "Review each step" : "Configure a run";

  if (state.action) {
    elements.actionTitle.textContent = `Proposed action · ${state.action.type}`;
    elements.actionDescription.textContent = describeAction(state.action);
  }
  if (state.safetyChecks?.length) {
    elements.safetyChecks.hidden = false;
    elements.safetyChecks.textContent = `Foundry safety check: ${state.safetyChecks.map((check) => check.message || check.code).join("; ")}`;
  } else {
    elements.safetyChecks.hidden = true;
    elements.safetyChecks.textContent = "";
  }
  if (state.message) elements.feedback.textContent = state.message;
  setStatus(state.status);
}

function describeAction(action) {
  const keys = Array.isArray(action.keys) ? action.keys : action.keys ? [action.keys] : [];
  switch (action.type) {
    case "click":
      return `Click at screen position (${action.x}, ${action.y}).`;
    case "double_click":
      return `Double-click at screen position (${action.x}, ${action.y}).`;
    case "type":
      return `Type: “${action.text}”`;
    case "key":
    case "keypress":
      return `Press: ${keys.join(" + ")}.`;
    case "scroll":
      return `Scroll ${action.scroll_y || 0}px vertically and ${action.scroll_x || 0}px horizontally.`;
    case "drag":
      return "Drag along the proposed screen path.";
    case "move":
      return `Move pointer to (${action.x}, ${action.y}).`;
    case "wait":
      return "Wait for the current page to respond.";
    case "screenshot":
      return "Capture the current screen.";
    default:
      return "Review the screen and proposed operation.";
  }
}

function showScreenshot(dataUrl) {
  const image = document.createElement("img");
  image.className = "live-screenshot";
  image.alt = "Current screenshot of the isolated target application";
  image.src = dataUrl;
  elements.screen.replaceChildren(image);
  elements.screenApp.textContent = "Customer-configured application";
  elements.stepCaption.textContent = "REAL APPLICATION SCREEN";
}

async function api(path, payload = {}) {
  const response = await fetch(path, {
    method: path === "/api/config" ? "GET" : "POST",
    headers: path === "/api/config" ? {} : { "Content-Type": "application/json" },
    body: path === "/api/config" ? undefined : JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The local demo server returned an error.");
  return result;
}

function showError(error) {
  state.status = "error";
  elements.feedback.textContent = error.message;
  setBusy(false);
  render();
}

async function refreshConfig() {
  try {
    const config = await api("/api/config");
    state.allowedOrigins = config.allowedOrigins;
    elements.allowed.textContent = config.configured
      ? `Foundry model: ${config.model}. Allowed app origins: ${config.allowedOrigins.join(", ")}`
      : "Setup required: set your Foundry project endpoint and allowed test-app origins in .env, sign in with Azure CLI, then restart the local server.";
    elements.allowed.classList.toggle("warning", !config.configured);
  } catch (error) {
    elements.allowed.textContent = error.message;
    elements.allowed.classList.add("warning");
  }
}

elements.cards.forEach((card) => {
  card.addEventListener("click", () => {
    if (state.sessionId) return;
    state.scenario = card.dataset.workflow;
    elements.task.value = scenarios[state.scenario].task;
    elements.secondaryUrl.value = "";
    render();
  });
});

elements.start.addEventListener("click", async () => {
  elements.feedback.textContent = "";
  setBusy(true);
  setStatus("starting");
  try {
    const session = await api("/api/sessions", {
      scenario: state.scenario,
      startUrl: elements.startUrl.value.trim(),
      secondaryUrl: elements.secondaryUrl.value.trim(),
      task: elements.task.value.trim(),
    });
    state.sessionId = session.sessionId;
    Object.assign(state, session);
    showScreenshot(session.screenshot);
    render();
  } catch (error) {
    showError(error);
  }
});

elements.approve.addEventListener("click", async () => {
  setBusy(true);
  try {
    const result = await api("/api/approve-action", { sessionId: state.sessionId });
    Object.assign(state, result);
    showScreenshot(result.screenshot);
    render();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
});

elements.approveRecommendation.addEventListener("click", async () => {
  setBusy(true);
  try {
    const result = await api("/api/approve-recommendation", { sessionId: state.sessionId });
    Object.assign(state, result);
    showScreenshot(result.screenshot);
    render();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
});

elements.decline.addEventListener("click", async () => {
  setBusy(true);
  try {
    const result = await api("/api/decline", { sessionId: state.sessionId });
    state.sessionId = null;
    state.message = result.message;
    state.action = null;
    state.status = "declined";
    render();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
});

elements.close.addEventListener("click", async () => {
  if (state.sessionId) {
    try {
      await api("/api/close", { sessionId: state.sessionId });
    } catch (error) {
      elements.feedback.textContent = error.message;
    }
  }
  state.sessionId = null;
  state.message = "";
  state.action = null;
  state.actionCount = 0;
  state.status = "ready";
  elements.screen.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "screen-empty";
  empty.innerHTML = '<span class="screen-empty-icon" aria-hidden="true">⌘</span><strong>Connect a sandbox application</strong><p>Enter an allowed test-app URL and task to begin a real Foundry computer-use session.</p>';
  elements.screen.append(empty);
  elements.screenApp.textContent = "No browser session";
  elements.stepCaption.textContent = "WAITING TO START";
  elements.feedback.textContent = "";
  render();
});

render();
refreshConfig();
