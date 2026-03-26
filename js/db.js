/* TaskFlow DB layer (Supabase REST) */
window.DB = (() => {
  const cfg = window.TaskFlowConfig || {};
  const SUPABASE_URL = cfg.SUPABASE_URL;
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("TaskFlowConfig is missing Supabase config");
  }

  const headers = () => ({
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: "return=representation",
  });

  async function apiGet(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
    return res.json();
  }

  async function apiPost(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${table} failed: ${res.status}`);
    return res.json();
  }

  async function apiPatch(table, id, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${table} failed: ${res.status}`);
    return res.json();
  }

  async function apiDelete(table, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) throw new Error(`DELETE ${table} failed: ${res.status}`);
  }

  // -----------------------
  // DATA LAYER — TASKS
  // -----------------------
  async function fetchTasks({ username, isSuperUser }) {
    if (isSuperUser) {
      return apiGet("tasks", "select=*&order=created_at.desc");
    }
    return apiGet(
      "tasks",
      `select=*&username=eq.${encodeURIComponent(username)}&order=created_at.desc`
    );
  }

  async function createTask(username, title) {
    return apiPost("tasks", {
      username,
      title,
      done: false,
      subtasks: [],
    });
  }

  async function updateTask(id, patch) {
    return apiPatch("tasks", id, patch);
  }

  async function deleteTask(id) {
    return apiDelete("tasks", id);
  }

  // Upsert user in users table (best-effort)
  async function upsertUser(username) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: "POST",
        headers: {
          ...headers(),
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify({ username }),
      });
    } catch (_) {
      // Best-effort: ignore failures (user row may not be required).
    }
  }

  return {
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    upsertUser,
  };
})();

