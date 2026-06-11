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

  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { success: false, error: `Server error (${res.status}): ${text.slice(0, 200)}` };
  }

  if (res.status === 401 && data.reason === 'session_expired') {
    await Storage.remove('partner_session_token');
    throw { sessionExpired: true };
  }

  return data;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
// Endpoint: POST /api/partner-auth
// Login response: { success, token, partner: { id, name, email } }
// Validate response: { success, partner, identifiers[], is_branded }
export const Auth = {
  async login(email, password) {
    const data = await request('/api/partner-auth', {
      action:   'login',
      email:    email.trim().toLowerCase(),
      password,
    });
    if (data.success && data.token) {
      await Storage.set('partner_session_token', data.token);
      const p = data.partner || {};
      if (p.id)    await Storage.set('partner_person_id', p.id);
      if (p.name)  await Storage.set('partner_name', p.name);
      if (p.email) await Storage.set('partner_email', p.email);
    }
    return data;
  },

  async validate() {
    const token = await Storage.get('partner_session_token');
    if (!token) return null;
    const data = await request('/api/partner-auth', { action: 'validate', token });
    if (data.success) {
      const p = data.partner || {};
      if (p.id)    await Storage.set('partner_person_id', p.id);
      if (p.name)  await Storage.set('partner_name', p.name);
      if (p.email) await Storage.set('partner_email', p.email);
      if (data.identifiers) await Storage.set('partner_identifiers', JSON.stringify(data.identifiers));
    }
    return data;
  },

  async logout() {
    const token = await Storage.get('partner_session_token');
    try { await request('/api/partner-auth', { action: 'logout', token }); } catch (e) { /* ignore */ }
    for (const k of ['partner_session_token','partner_person_id','partner_name','partner_email','partner_identifiers']) {
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
  // Uses validate to get identifiers alongside partner info
  getScorecard(person_id) {
    return request('/api/partners', { action: 'get_scorecard', person_id });
  },

  // Get cached identifiers from storage (populated on login/validate)
  async getIdentifiers() {
    const raw = await Storage.get('partner_identifiers');
    try { return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  },
};

// ── MERCHANTS ─────────────────────────────────────────────────────────────────
export const Merchants = {
  getByIdentifier(identifier_id) {
    return request('/api/partners', { action: 'get_merchant_data_raw', identifier_id });
  },

  get(merchant_uuid) {
    return request('/api/merchants', { action: 'get_full_merchant', merchant_uuid });
  },
};

// ── TICKETS ───────────────────────────────────────────────────────────────────
export const Tickets = {
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

// ── COMMUNITY ─────────────────────────────────────────────────────────────────
export const Community = {
  getChannels() {
    return request('/api/community', { action: 'get_channels' });
  },
  getFeed({ channel_id, page = 0, limit = 20 } = {}) {
    const body = { action: 'get_feed', page, limit };
    if (channel_id) body.channel_id = channel_id;
    return request('/api/community', body);
  },
  async createPost(channel_id, body) {
    const partner_id   = await Storage.get('partner_person_id');
    const partner_name = await Storage.get('partner_name');
    return request('/api/community', { action: 'create_post', body, channel_id, partner_id, partner_name });
  },
  async react(post_id, emoji = '👍') {
    const partner_id = await Storage.get('partner_person_id');
    return request('/api/community', { action: 'react', post_id, emoji, partner_id });
  },
  getComments(post_id) {
    return request('/api/community', { action: 'get_comments', post_id });
  },
  async addComment(post_id, body) {
    const partner_id   = await Storage.get('partner_person_id');
    const partner_name = await Storage.get('partner_name');
    return request('/api/community', { action: 'add_comment', post_id, body, partner_id, partner_name });
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
  get(person_id) {
    return request('/api/partners', { action: 'get_scorecard', person_id });
  },

  updateField(id, field, value) {
    return request('/api/partners', { action: 'update_person_field', id, field, value });
  },

  changePassword(token, current_password, new_password) {
    return request('/api/partner-auth', { action: 'change_password', token, current_password, new_password });
  },
};
