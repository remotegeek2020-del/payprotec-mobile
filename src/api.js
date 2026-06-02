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

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const Auth = {
  async login(email, passkey) {
    const deviceToken = await Storage.get('device_token');
    return request('/api/login', { action: 'login', email, passkey, deviceToken });
  },
  async verify2FA(userId, code, remember) {
    const data = await request('/api/login', { action: 'verify2FA', userId, code, remember });
    if (data.success && data.sessionToken) {
      await Storage.set('session_token', data.sessionToken);
      if (remember && data.newDeviceToken) await Storage.set('device_token', data.newDeviceToken);
    }
    return data;
  },
  async logout() {
    await request('/api/login', { action: 'logout' });
    await Storage.remove('session_token');
  },
};

// ── MERCHANTS ─────────────────────────────────────────────────────────────────
export const Merchants = {
  list(query = '', page = 1, limit = 20) {
    return request('/api/merchants', { action: 'list', query, page, limit });
  },
  get(id) {
    return request('/api/merchants', { action: 'get', merchant_id: id });
  },
  getNotes(merchant_id) {
    return request('/api/merchants', { action: 'get_notes', merchant_id });
  },
  addNote(merchant_id, content) {
    return request('/api/merchants', { action: 'add_note', merchant_id, content });
  },
  getMerchantTasks(merchant_id) {
    return request('/api/merchants', { action: 'get_tasks', merchant_id });
  },
};

// ── RETURNS ───────────────────────────────────────────────────────────────────
export const Returns = {
  list(query = '', offset = 0, limit = 20, filters = {}) {
    return request('/api/returns', { action: 'list', query, offset, limit, ...filters });
  },
};

// ── DEPLOYMENTS ───────────────────────────────────────────────────────────────
export const Deployments = {
  list(query = '', page = 1, limit = 20) {
    return request('/api/deployments', { action: 'list', query, page, limit });
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
      merchants: merchants.value?.totalCount ?? merchants.value?.count ?? '—',
      openReturns: returns.value?.metrics?.open ?? '—',
      activeDeployments: deployments.value?.metrics?.active ?? '—',
    };
  },
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
export const Notifications = {
  getCounts() {
    return request('/api/notifications', { action: 'get_counts' });
  },
  markSeen(section) {
    return request('/api/notifications', { action: 'mark_seen', section });
  },
};

// ── TASKS ─────────────────────────────────────────────────────────────────────
export const Tasks = {
  list({ view = 'mine', status, page = 1, limit = 20 } = {}) {
    return request('/api/tasks', { action: 'get_tasks', view, status, page, limit });
  },
  stats() {
    return request('/api/tasks', { action: 'get_stats' });
  },
  create(payload) {
    return request('/api/tasks', { action: 'create_task', ...payload });
  },
  update(id, fields) {
    return request('/api/tasks', { action: 'update_task', id, ...fields });
  },
  getComments(task_id) {
    return request('/api/tasks', { action: 'get_comments', task_id });
  },
  addComment(task_id, comment) {
    return request('/api/tasks', { action: 'add_comment', task_id, comment });
  },
};
