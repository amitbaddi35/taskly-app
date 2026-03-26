/* TaskFlow app UI + state management */
const cfg = window.TaskFlowConfig || {};
const SUPER_USER = cfg.SUPER_USER_EMAIL;

let State = {
  username: null,
  tasks: [],
  isSuperUser: false,
};

// -----------------------
// HELPERS — LOADING & TOAST
// -----------------------
function showLoading(msg = "Loading…") {
  document.getElementById("loading-overlay").style.display = "flex";
  document.getElementById("loading-text").textContent = msg;
}

function hideLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}

function toast(msg, type = "success") {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || "💬"}</span>${msg}`;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// -----------------------
// STATE MANAGEMENT
// -----------------------
async function loadTasks() {
  showLoading("Fetching tasks…");
  try {
    State.tasks = await DB.fetchTasks({
      username: State.username,
      isSuperUser: State.isSuperUser,
    });
  } catch (e) {
    toast("Failed to load tasks: " + e.message, "error");
    State.tasks = [];
  }
  hideLoading();
}

// -----------------------
// UI — STATS
// -----------------------
function renderStats() {
  // For normal user stats are based only on their tasks
  const tasks = State.isSuperUser
    ? State.tasks
    : State.tasks.filter((t) => t.username === State.username);
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-done").textContent = done;
  document.getElementById("stat-pct").textContent = pct + "%";
  document.getElementById("progress-bar").style.width = pct + "%";
  document.getElementById("progress-label").textContent = `${done} of ${total} tasks done`;
}

// -----------------------
// UI — TASKS LIST
// -----------------------
function renderTasks() {
  renderStats();
  const container = document.getElementById("tasks-list");
  const empty = document.getElementById("empty-state");

  // DETACH empty-state BEFORE clearing
  if (empty && empty.parentNode === container) {
    container.removeChild(empty);
  }

  if (State.tasks.length === 0) {
    container.innerHTML = "";

    // RE-APPEND safely
    if (empty) {
      container.appendChild(empty);
      empty.style.display = "block";
    }
    return;
  }

  // hide empty state safely
  if (empty) empty.style.display = "none";

  // clear container
  container.innerHTML = "";

  // render tasks
  State.tasks.forEach((task) => {
    container.appendChild(buildTaskCard(task));
  });
}

function buildTaskCard(task) {
  const card = document.createElement("div");
  card.className = `task-card${task.done ? " completed" : ""}`;
  card.dataset.id = task.id;

  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const openClass = ""; // collapsed by default

  // TASK ROW
  const row = document.createElement("div");
  row.className = "task-row";

  // Checkbox
  const cb = document.createElement("div");
  cb.className = `task-checkbox${task.done ? " checked" : ""}`;
  cb.innerHTML = task.done ? "✓" : "";
  cb.title = task.done ? "Mark incomplete" : "Mark complete";
  cb.addEventListener("click", () => toggleTask(task.id, task.done));

  // Title
  const titleSpan = document.createElement("span");
  titleSpan.className = `task-title${task.done ? " done-text" : ""}`;
  titleSpan.textContent = task.title;

  // user chip (super user only)
  const chip = document.createElement("span");
  chip.className = "task-user-chip";
  chip.textContent = task.username;
  chip.style.display = State.isSuperUser ? "" : "none";

  // Actions
  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.title = "Edit";
  editBtn.innerHTML = "✏️";
  editBtn.addEventListener("click", () =>
    openEditModal(task.id, task.title, "task")
  );

  const delBtn = document.createElement("button");
  delBtn.className = "icon-btn danger";
  delBtn.title = "Delete";
  delBtn.innerHTML = "🗑️";
  delBtn.addEventListener("click", () => doDeleteTask(task.id));

  const expandBtn = document.createElement("button");
  expandBtn.className = "icon-btn expand-btn";
  expandBtn.title = "Toggle subtasks";
  expandBtn.innerHTML = subtasks.length > 0 ? `▾ ${subtasks.length}` : "▾";
  expandBtn.addEventListener("click", () => {
    subWrap.classList.toggle("open");
    expandBtn.innerHTML = subWrap.classList.contains("open")
      ? `▴ ${subtasks.length}`
      : `▾ ${subtasks.length || ""}`;
  });

  actions.appendChild(chip);
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  actions.appendChild(expandBtn);

  row.appendChild(cb);
  row.appendChild(titleSpan);
  row.appendChild(actions);

  // SUBTASKS WRAP
  const subWrap = document.createElement("div");
  subWrap.className = `subtasks-wrap${openClass}`;

  subtasks.forEach((st, idx) => {
    subWrap.appendChild(buildSubtaskItem(task.id, st, idx, subtasks));
  });

  // Add subtask bar
  const addBar = document.createElement("div");
  addBar.className = "add-subtask-bar";
  const stInput = document.createElement("input");
  stInput.className = "add-subtask-input";
  stInput.type = "text";
  stInput.placeholder = "New subtask…";
  const stBtn = document.createElement("button");
  stBtn.className = "btn-sm";
  stBtn.textContent = "+ Add";
  stBtn.addEventListener("click", () => {
    const val = stInput.value.trim();
    if (!val) return;
    addSubtask(task.id, val, subtasks);
    stInput.value = "";
  });
  stInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") stBtn.click();
  });
  addBar.appendChild(stInput);
  addBar.appendChild(stBtn);
  subWrap.appendChild(addBar);

  card.appendChild(row);
  card.appendChild(subWrap);
  return card;
}

function buildSubtaskItem(taskId, st, idx, allSubtasks) {
  const item = document.createElement("div");
  item.className = "subtask-item";

  const cb = document.createElement("div");
  cb.className = `subtask-checkbox${st.done ? " checked" : ""}`;
  cb.innerHTML = st.done ? "✓" : "";
  cb.addEventListener("click", () => toggleSubtask(taskId, idx, allSubtasks));

  const span = document.createElement("span");
  span.className = `subtask-title${st.done ? " done-text" : ""}`;
  span.textContent = st.title;

  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.innerHTML = "✏️";
  editBtn.style.fontSize = ".75rem";
  editBtn.addEventListener("click", () =>
    openEditModal(taskId, st.title, "subtask", idx, allSubtasks)
  );

  const delBtn = document.createElement("button");
  delBtn.className = "icon-btn danger";
  delBtn.innerHTML = "🗑️";
  delBtn.style.fontSize = ".75rem";
  delBtn.addEventListener("click", () =>
    deleteSubtask(taskId, idx, allSubtasks)
  );

  item.appendChild(cb);
  item.appendChild(span);
  item.appendChild(editBtn);
  item.appendChild(delBtn);
  return item;
}

// -----------------------
// TASK ACTIONS
// -----------------------
async function doAddTask() {
  const input = document.getElementById("new-task-input");
  const title = input.value.trim();
  if (!title) {
    toast("Task title cannot be empty", "error");
    return;
  }

  showLoading("Adding task…");
  try {
    const [newTask] = await DB.createTask(State.username, title);
    State.tasks.unshift(newTask);
    input.value = "";
    renderTasks();
    toast("Task added!");
  } catch (e) {
    toast("Error adding task: " + e.message, "error");
  }
  hideLoading();
}

async function toggleTask(id, currentDone) {
  const newDone = !currentDone;
  showLoading("Updating…");
  try {
    await DB.updateTask(id, { done: newDone });
    const idx = State.tasks.findIndex((t) => t.id === id);
    if (idx !== -1) State.tasks[idx].done = newDone;
    renderTasks();
    toast(newDone ? "Task completed! 🎉" : "Task reopened");
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
  hideLoading();
}

async function doDeleteTask(id) {
  if (!confirm("Delete this task?")) return;
  showLoading("Deleting…");
  try {
    await DB.deleteTask(id);
    State.tasks = State.tasks.filter((t) => t.id !== id);
    renderTasks();
    toast("Task deleted");
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
  hideLoading();
}

// -----------------------
// SUBTASK ACTIONS
// -----------------------
async function addSubtask(taskId, title, currentSubtasks) {
  const newSubtask = { title, done: false };
  const updated = [...currentSubtasks, newSubtask];
  showLoading("Adding subtask…");
  try {
    const autoComplete = updated.every((s) => s.done);
    await DB.updateTask(taskId, { subtasks: updated, done: autoComplete });
    const idx = State.tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      State.tasks[idx].subtasks = updated;
      State.tasks[idx].done = autoComplete;
    }
    renderTasks();
    toast("Subtask added!");
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
  hideLoading();
}

async function toggleSubtask(taskId, stIdx, currentSubtasks) {
  const updated = currentSubtasks.map((s, i) =>
    i === stIdx ? { ...s, done: !s.done } : s
  );
  const autoComplete = updated.length > 0 && updated.every((s) => s.done);
  showLoading("Updating…");
  try {
    await DB.updateTask(taskId, { subtasks: updated, done: autoComplete });
    const idx = State.tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      State.tasks[idx].subtasks = updated;
      State.tasks[idx].done = autoComplete;
    }
    renderTasks();
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
  hideLoading();
}

async function deleteSubtask(taskId, stIdx, currentSubtasks) {
  const updated = currentSubtasks.filter((_, i) => i !== stIdx);
  showLoading("Removing…");
  try {
    await DB.updateTask(taskId, { subtasks: updated });
    const idx = State.tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) State.tasks[idx].subtasks = updated;
    renderTasks();
    toast("Subtask removed");
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
  hideLoading();
}

// -----------------------
// EDIT MODAL
// -----------------------
let _modalCallback = null;

function openEditModal(taskId, currentVal, type, stIdx, allSubtasks) {
  const modal = document.getElementById("edit-modal");
  const titleEl = document.getElementById("modal-title");
  const inputEl = document.getElementById("modal-input");

  titleEl.textContent = type === "task" ? "Edit Task" : "Edit Subtask";
  inputEl.value = currentVal;
  modal.style.display = "flex";
  inputEl.focus();

  _modalCallback = async (newVal) => {
    if (!newVal) return;
    showLoading("Saving…");
    try {
      if (type === "task") {
        await DB.updateTask(taskId, { title: newVal });
        const idx = State.tasks.findIndex((t) => t.id === taskId);
        if (idx !== -1) State.tasks[idx].title = newVal;
      } else {
        const updated = allSubtasks.map((s, i) =>
          i === stIdx ? { ...s, title: newVal } : s
        );
        await DB.updateTask(taskId, { subtasks: updated });
        const idx = State.tasks.findIndex((t) => t.id === taskId);
        if (idx !== -1) State.tasks[idx].subtasks = updated;
      }
      renderTasks();
      toast("Saved!");
    } catch (e) {
      toast("Error: " + e.message, "error");
    }
    hideLoading();
    closeModal();
  };
}

function closeModal() {
  document.getElementById("edit-modal").style.display = "none";
  _modalCallback = null;
}

// -----------------------
// ANALYTICS
// -----------------------
function renderAnalytics() {
  // Determine the dataset
  const tasks = State.isSuperUser
    ? State.tasks
    : State.tasks.filter((t) => t.username === State.username);

  // Last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const byDay = {};
  days.forEach((d) => {
    byDay[d] = { created: 0, completed: 0 };
  });

  tasks.forEach((t) => {
    const day = t.created_at ? t.created_at.slice(0, 10) : null;
    if (day && byDay[day] !== undefined) {
      byDay[day].created++;
      if (t.done) byDay[day].completed++;
    }
  });

  // Bar chart
  const maxVal = Math.max(
    1,
    ...Object.values(byDay).flatMap((v) => [v.created, v.completed])
  );
  const chartEl = document.getElementById("bar-chart");
  chartEl.innerHTML = "";

  days.forEach((day) => {
    const d = byDay[day];
    const label = new Date(day + "T12:00:00").toLocaleDateString("en", {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    });
    const createdH = Math.round((d.created / maxVal) * 120);
    const completedH = Math.round((d.completed / maxVal) * 120);

    const group = document.createElement("div");
    group.className = "bar-group";

    const bars = document.createElement("div");
    bars.className = "bar-bars";

    const b1 = document.createElement("div");
    b1.className = "bar created";
    b1.style.height = createdH + "px";
    b1.title = `${d.created} created`;

    const b2 = document.createElement("div");
    b2.className = "bar completed";
    b2.style.height = completedH + "px";
    b2.title = `${d.completed} completed`;

    bars.appendChild(b1);
    bars.appendChild(b2);

    const lbl = document.createElement("div");
    lbl.className = "bar-label";
    lbl.textContent = label;

    group.appendChild(bars);
    group.appendChild(lbl);
    chartEl.appendChild(group);
  });

  // Table
  const tbody = document.getElementById("analytics-table-body");
  tbody.innerHTML = "";

  days
    .slice()
    .reverse()
    .forEach((day) => {
      const d = byDay[day];
      const rate = d.created > 0 ? Math.round((d.completed / d.created) * 100) : 0;
      const friendly = new Date(day + "T12:00:00").toLocaleDateString("en", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${friendly}</td>
      <td>${d.created}</td>
      <td>${d.completed}</td>
      <td><span class="pct-badge">${rate}%</span></td>
    `;
      tbody.appendChild(tr);
    });

  // Sub heading
  document.getElementById("analytics-sub").textContent = State.isSuperUser
    ? "Aggregated analytics across all users (last 7 days)"
    : "Your task activity over the last 7 days";
}

// -----------------------
// ROUTING — TABS
// -----------------------
function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById(`tab-${name}`).classList.add("active");
  document.querySelector(`[data-tab="${name}"]`).classList.add("active");
  if (name === "analytics") renderAnalytics();
}

// -----------------------
// LOGIN / LOGOUT
// -----------------------
async function doLogin() {
  const input = document.getElementById("login-username");
  const username = input.value.trim();

  if (!username) {
    toast("Enter your email", "error");
    return;
  }

  if (!username.includes("@")) {
    toast("Enter a valid email", "error");
    return;
  }

  localStorage.setItem("tf_username", username);
  State.username = username;
  State.isSuperUser = username === SUPER_USER;

  document.getElementById("header-username").textContent = username;
  const dot = document.getElementById("user-dot");
  if (State.isSuperUser) {
    dot.classList.add("superuser-dot");
    dot.title = "Super User";
  } else {
    dot.classList.remove("superuser-dot");
  }

  document.getElementById("page-login").classList.remove("active");
  document.getElementById("page-app").classList.add("active");

  DB.upsertUser(username); // best-effort
  await loadTasks();
  renderTasks();
}

function doSwitchUser() {
  localStorage.removeItem("tf_username");
  State.tasks = [];
  document.getElementById("page-app").classList.remove("active");
  document.getElementById("page-login").classList.add("active");
  document.getElementById("login-username").value = "";
  switchTab("dashboard"); // reset tab
}

// -----------------------
// EVENT WIRING
// -----------------------
document.getElementById("login-btn").addEventListener("click", doLogin);
document.getElementById("login-username").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

document.getElementById("add-task-btn").addEventListener("click", doAddTask);
document.getElementById("new-task-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doAddTask();
});

document.getElementById("switch-btn").addEventListener("click", doSwitchUser);

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

document.getElementById("modal-cancel").addEventListener("click", closeModal);
document.getElementById("modal-save").addEventListener("click", () => {
  const val = document.getElementById("modal-input").value.trim();
  if (_modalCallback) _modalCallback(val);
});

document.getElementById("modal-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("modal-save").click();
  if (e.key === "Escape") closeModal();
});

document.getElementById("edit-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("edit-modal")) closeModal();
});

// -----------------------
// BOOT — auto-login from localStorage
// -----------------------
(async function boot() {
  const saved = localStorage.getItem("tf_username");
  if (saved) {
    document.getElementById("login-username").value = saved;
    await doLogin();
  }
})();

