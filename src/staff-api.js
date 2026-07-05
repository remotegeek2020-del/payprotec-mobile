import { API_BASE_URL } from './config';
import { Storage } from './storage';

// Staff endpoints authenticate with `Authorization: Bearer <token>` validated
// against staff_sessions (api/_validate.js) — unlike partner endpoints, which
// take the token in the request body.
export async function staffRequest(path, body, { method = 'POST', query } = {}) {
  const token = await Storage.get('staff_session_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let url = `${API_BASE_URL}${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });

  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { success: false, error: `Server error (${res.status}): ${text.slice(0, 200)}` };
  }

  if (res.status === 401 && (data.reason === 'session_expired' || data.reason === 'no_token')) {
    await Storage.remove('staff_session_token');
    throw { sessionExpired: true };
  }

  return data;
}

const STAFF_KEYS = ['staff_session_token', 'staff_user'];

// ── STAFF AUTH (api/login.js) ─────────────────────────────────────────────────
// Flow: login → may return { needs2FA, userid } (code emailed) → verify2FA →
// { sessionToken, user, newDeviceToken }. Trusted devices skip 2FA for 30 days.
export const StaffAuth = {
  async login(email, passkey) {
    const deviceToken = await Storage.get('staff_device_token');
    const data = await staffRequest('/api/login', {
      action: 'login',
      email: email.trim().toLowerCase(),
      passkey,
      deviceToken: deviceToken || null,
    });
    if (data.success && data.sessionToken) await this._storeSession(data);
    return data;
  },

  async verify2FA(userId, code, remember = true) {
    const data = await staffRequest('/api/login', { action: 'verify2FA', userId, code, remember });
    if (data.success && data.sessionToken) {
      await this._storeSession(data);
      if (data.newDeviceToken) await Storage.set('staff_device_token', data.newDeviceToken);
    }
    return data;
  },

  async forcePasswordChange(userid, change_token, new_password) {
    const data = await staffRequest('/api/login', { action: 'force_change_password', userid, change_token, new_password });
    if (data.success && data.session_token) {
      await Storage.set('staff_session_token', data.session_token);
      if (data.user) await Storage.set('staff_user', JSON.stringify(data.user));
    }
    return data;
  },

  forgotPassword(email) {
    return staffRequest('/api/login', { action: 'forgotPassword', email });
  },

  async validate() {
    const token = await Storage.get('staff_session_token');
    if (!token) return null;
    try {
      const data = await staffRequest('/api/login', { action: 'validate' });
      if (data.success && data.user) await Storage.set('staff_user', JSON.stringify(data.user));
      return data;
    } catch (e) {
      return null;
    }
  },

  async logout() {
    try { await staffRequest('/api/login', { action: 'logout' }); } catch (e) { /* ignore */ }
    for (const k of STAFF_KEYS) await Storage.remove(k);
  },

  async getSession() {
    const token = await Storage.get('staff_session_token');
    if (!token) return null;
    const raw = await Storage.get('staff_user');
    let user = null;
    try { user = raw ? JSON.parse(raw) : null; } catch (e) { /* ignore */ }
    return { token, user };
  },

  async _storeSession(data) {
    await Storage.set('staff_session_token', data.sessionToken);
    if (data.user) await Storage.set('staff_user', JSON.stringify(data.user));
  },
};

// ── ANALYTICS (api/analytics.js) ──────────────────────────────────────────────
// Single read-only 'overview' action. Returns:
// { success, kpis:{open_tickets, open_deployments, open_returns, equip_deployed,
//   equip_stocked, utilization_pct, avg_ticket_resolution_h},
//   series:{weeks[], deployments[], returns[], tickets_created[], tickets_resolved[]},
//   breakdowns:{deployments_status{}, returns_status{}, tickets_status{}, equipment_status{}},
//   new_merchants_monthly:{labels[], counts[]} }
export const StaffAnalytics = {
  overview() {
    return staffRequest('/api/analytics', { action: 'overview' });
  },
};

// ── NOTIFICATIONS (api/notifications.js) ──────────────────────────────────────
export const StaffNotifications = {
  getCounts() {
    return staffRequest('/api/notifications', { action: 'get_counts' });
  },
  markSeen(section) {
    return staffRequest('/api/notifications', { action: 'mark_seen', section });
  },
};
