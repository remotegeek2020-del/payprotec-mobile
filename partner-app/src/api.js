import { API_BASE_URL } from './config';
import { Storage } from './storage';

async function request(path, body) {
  const token = await Storage.get('partner_session_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (res.status === 401) {
    await Storage.remove('partner_session_token');
    throw { sessionExpired: true };
  }

  return data;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const Auth = {
  async login(email, password) {
    // Try /api/partner-login first; fallback action name partner_login
    let data;
    try {
      data = await request('/api/partner-login', { email, password });
    } catch (e) {
      data = await request('/api/login', { action: 'partner_login', email, password });
    }
    if (data.success && data.sessionToken) {
      await Storage.set('partner_session_token', data.sessionToken);
      const p = data.person || {};
      if (p.id)         await Storage.set('partner_person_id', p.id);
      if (p.full_name)  await Storage.set('partner_name', p.full_name);
      if (p.email)      await Storage.set('partner_email', p.email);
    }
    return data;
  },

  async logout() {
    try { await request('/api/partner-login', { action: 'logout' }); } catch (e) { /* ignore */ }
    for (const k of ['partner_session_token','partner_person_id','partner_name','partner_email']) {
      await Storage.remove(k);
    }
  },

  async getSession() {
    const token = await Storage.get('partner_session_token');
    if (!token) return null;
    return {
      token,
      person_id: await Storage.get('partner_person_id'),
      name:      await Storage.get('partner_name'),
      email:     await Storage.get('partner_email'),
    };
  },
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const Dashboard = {
  // Response: { success, person, companies[], identifiers[], scorecard: { merchant_count, volume_30d, volume_90d, volume_mtd, rank, tier } }
  getScorecard(person_id) {
    return request('/api/partners', { action: 'get_scorecard', person_id });
  },
};

// ── MERCHANTS ─────────────────────────────────────────────────────────────────
export const Merchants = {
  // Get merchants for a specific agent identifier.
  // Response: { success, data: [{ merchant_id, dba_name, account_status, volume_30_day, volume_90_day, volume_mtd, last_batch_date, ... }] }
  getByIdentifier(identifier_id) {
    return request('/api/partners', { action: 'get_merchant_data_raw', identifier_id });
  },

  // Get full merchant detail.
  get(merchant_uuid) {
    return request('/api/merchants', { action: 'get_full_merchant', merchant_uuid });
  },
};

// ── TICKETS ───────────────────────────────────────────────────────────────────
export const Tickets = {
  // List tickets for authenticated partner. Optional: merchant_uuid to scope.
  list(merchant_uuid) {
    const body = { action: 'list_for_partner' };
    if (merchant_uuid) body.merchant_uuid = merchant_uuid;
    return request('/api/tickets', body);
  },

  get(ticket_id) {
    return request('/api/tickets', { action: 'get_detail', ticket_id });
  },

  create(payload) {
    return request('/api/tickets', { action: 'create', ...payload });
  },

  getComments(ticket_id) {
    return request('/api/tickets', { action: 'get_comments', ticket_id });
  },

  addComment(ticket_id, body) {
    return request('/api/tickets', { action: 'add_comment', ticket_id, body });
  },

  getUnreadTotal() {
    return request('/api/tickets', { action: 'get_unread_total' });
  },
};

// ── MESSAGES ──────────────────────────────────────────────────────────────────
export const Chat = {
  getUserList() {
    return request('/api/chat', { action: 'get_user_list' });
  },

  getHistory(other_user_id) {
    return request('/api/chat', { action: 'get_history', other_user_id });
  },

  sendMessage(recipient_id, message) {
    return request('/api/chat', { action: 'send_message', recipient_id, message });
  },
};

// ── PROFILE ───────────────────────────────────────────────────────────────────
export const Profile = {
  // Get full person record + identifiers + companies.
  get(person_id) {
    return request('/api/partners', { action: 'get_scorecard', person_id });
  },

  updateField(id, field, value) {
    return request('/api/partners', { action: 'update_person_field', id, field, value });
  },
};
