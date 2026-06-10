import { API_BASE_URL } from './config';
import { Storage } from './storage';

async function request(path, body, method = 'POST') {
  const token = await Storage.get('session_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (res.status === 401 && data.reason === 'session_expired') {
    await Storage.remove('session_token');
    throw { sessionExpired: true };
  }

  return data;
}

// Persist the logged-in user's identity (needed by notifications + notes).
async function storeUser(user) {
  if (!user) return;
  if (user.userid != null) await Storage.set('user_id', user.userid);
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  if (name) await Storage.set('user_name', name);
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const Auth = {
  async login(email, passkey) {
    const deviceToken = await Storage.get('device_token');
    const data = await request('/api/login', { action: 'login', email, passkey, deviceToken });
    if (data.success && data.sessionToken) {
      await Storage.set('session_token', data.sessionToken);
      await storeUser(data.user);
    }
    return data;
  },
  async verify2FA(userId, code, remember) {
    const data = await request('/api/login', { action: 'verify2FA', userId, code, remember });
    if (data.success && data.sessionToken) {
      await Storage.set('session_token', data.sessionToken);
      if (remember && data.newDeviceToken) await Storage.set('device_token', data.newDeviceToken);
      await storeUser(data.user);
    }
    return data;
  },
  async logout() {
    try { await request('/api/login', { action: 'logout' }); } catch {}
    await Storage.remove('session_token');
    await Storage.remove('user_id');
    await Storage.remove('user_name');
  },
};

// ── MERCHANTS ─────────────────────────────────────────────────────────────────
export const Merchants = {
  // Response: { success, data[], count, metrics }
  list(query = '', page = 1, limit = 20) {
    return request('/api/merchants', { action: 'list', query, page, limit });
  },
  // merchant_uuid is the merchant row UUID (m.id), NOT the MID.
  get(merchant_uuid) {
    return request('/api/merchants', { action: 'get_full_merchant', merchant_uuid });
  },
  // Response: { success, data[] } — rows have title, body, type, display_name, created_at
  getNotes(merchant_uuid, type) {
    const body = { action: 'get_notes', merchant_uuid };
    if (type) body.type = type;
    return request('/api/merchants', body);
  },
  async addNote(merchant_uuid, title, body) {
    const created_by = await Storage.get('user_id');
    return request('/api/merchants', { action: 'add_note', merchant_uuid, title, body, created_by });
  },
  // Response: { success, data[] } — rows include assignee_name
  getMerchantTasks(merchant_uuid) {
    return request('/api/merchants', { action: 'get_tasks', merchant_uuid });
  },
};

// ── RETURNS ───────────────────────────────────────────────────────────────────
export const Returns = {
  // Response: { success, data[], metrics: { open, defective }, count, totalCount }
  list(query = '', offset = 0, limit = 20, filters = {}) {
    return request('/api/returns', { action: 'list', query, offset, limit, ...filters });
  },
  // payload: { id (return row UUID, required), equipment_id, destination,
  //            merchant_id, equipment_received_date, condition }
  complete(payload) {
    return request('/api/returns', { action: 'complete_return', payload });
  },
  remove(return_uuid) {
    return request('/api/returns', { action: 'delete', return_uuid });
  },
};

// ── DEPLOYMENTS ───────────────────────────────────────────────────────────────
export const Deployments = {
  // Response: { success, data[], metrics: { active, total, today },
  //             pagination: { totalRecords, currentPage, totalPages } }
  list(query = '', page = 1, limit = 20) {
    return request('/api/deployments', { action: 'list', query, page, limit });
  },
  // payload: { deployment_id (row UUID), status, tracking_id, target_date,
  //            notes, purchase_type, merchant_received_date }
  update(payload) {
    return request('/api/deployments', { action: 'update', payload });
  },
  // deployment_id is the row UUID. Response: { success, data, isBulk?, ... }
  checkRma(deployment_id) {
    return request('/api/deployments', { action: 'check_rma', deployment_id });
  },
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const Dashboard = {
  async stats() {
    const [merchants, returns, deployments] = await Promise.allSettled([
      Merchants.list('', 1, 1),
      Returns.list('', 0, 1),
      Deployments.list('', 1, 1),
    ]);
    return {
      merchants: merchants.value?.count ?? '—',
      openReturns: returns.value?.metrics?.open ?? '—',
      activeDeployments: deployments.value?.metrics?.active ?? '—',
    };
  },
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
export const Notifications = {
  // Response: { success, counts: { returns, deployments, tasks, ... } }
  async getCounts() {
    const userid = await Storage.get('user_id');
    if (!userid) return { success: false, counts: {} };
    return request('/api/notifications', { action: 'get_counts', userid });
  },
  // section: returns | deployments | tickets | tasks | ideas | partners | merchants | inventory
  async markSeen(section) {
    const userid = await Storage.get('user_id');
    if (!userid) return { success: false };
    return request('/api/notifications', { action: 'mark_seen', userid, section });
  },
};

// ── TASKS ─────────────────────────────────────────────────────────────────────
export const Tasks = {
  // page is 0-based. Response: { success, data[], count } — rows include
  // merchants: { id, dba_name, merchant_id }, assigned_to_name, created_by_name, is_overdue
  list({ view = 'mine', status, priority, assigned_to, page = 0, limit = 25 } = {}) {
    const body = { action: 'get_tasks', view, page, limit };
    if (status) body.status = status;
    if (priority) body.priority = priority;
    if (assigned_to) body.assigned_to = assigned_to;
    return request('/api/tasks', body);
  },
  // Response: { success, mine, overdue, all }
  stats() {
    return request('/api/tasks', { action: 'get_stats' });
  },
  // Required: title, merchant_id (merchant row UUID).
  // Optional: body, assigned_to, due_date, priority (default 'Normal'), notes
  create(payload) {
    return request('/api/tasks', { action: 'create_task', ...payload });
  },
  // payload may contain: title, body, status, priority, due_date, notes, assigned_to
  update(task_id, payload) {
    return request('/api/tasks', { action: 'update_task', task_id, payload });
  },
  remove(task_id) {
    return request('/api/tasks', { action: 'delete_task', task_id });
  },
  // Response: { success, data[] } — rows have body, author_name, created_at
  getComments(task_id) {
    return request('/api/tasks', { action: 'get_comments', task_id });
  },
  addComment(task_id, body) {
    return request('/api/tasks', { action: 'add_comment', task_id, body });
  },
  // Response: { success, data: [{ id, full_name }] }
  getStaff() {
    return request('/api/tasks', { action: 'get_staff' });
  },
};
