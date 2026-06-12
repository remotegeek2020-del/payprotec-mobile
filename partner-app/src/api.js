import { API_BASE_URL } from './config';
import { Storage } from './storage';

// The partner backend (merchant-management-console) expects the session token
// inside the POST body as `token` — it never reads the Authorization header.
async function request(path, body, { auth = true } = {}) {
  const token = auth ? await Storage.get('partner_session_token') : null;
  const payload = token ? { token, ...body } : body;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { success: false, error: `Server error (${res.status}): ${text.slice(0, 200)}` };
  }

  // A 401 on an authenticated call means the partner session is gone.
  if (res.status === 401 && token) {
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
    }, { auth: false });
    if (data.success && data.token) {
      await Storage.set('partner_session_token', data.token);
      const p = data.partner || {};
      if (p.id)    await Storage.set('partner_person_id', p.id);
      if (p.name)  await Storage.set('partner_name', p.name);
      if (p.email) await Storage.set('partner_email', p.email);
      // Normalized shape the screens already consume
      data.person = { id: p.id, full_name: p.name, email: p.email };
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
    try { await request('/api/partner-auth', { action: 'logout' }); } catch (e) { /* ignore */ }
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

  // Always responds { success: true } regardless of whether the account exists.
  forgotPassword(email) {
    return request('/api/partner-auth', {
      action: 'forgot_password',
      email:  email.trim().toLowerCase(),
    }, { auth: false });
  },
};

// ── DASHBOARD (api/partner-data.js) ───────────────────────────────────────────
export const Dashboard = {
  // Combines get_dashboard + get_my_rank into the scorecard shape the screens use.
  // Returns: { success, person, identifiers[], scorecard: { merchant_count, volume_30d, volume_90d, volume_mtd, rank, tier, companies[] } }
  async getScorecard() {
    const [dash, rank] = await Promise.all([
      request('/api/partner-data', { action: 'get_dashboard' }),
      request('/api/partner-data', { action: 'get_my_rank' }).catch(() => ({})),
    ]);
    if (!dash.success) return dash;

    const ov = dash.overview || {};
    const companiesMap = dash.companies || {};
    const identifiers = (dash.identifiers || []).map(id => ({
      ...id,
      company_name: companiesMap[id.agent_id] || '',
    }));
    const companies = [...new Set(Object.values(companiesMap))].map(name => ({ company_name: name }));

    return {
      success: true,
      person: dash.partner,
      identifiers,
      // trends: { growth, stable, at_risk, no_data, chart[] }
      trends: dash.trends || null,
      // new_enrollments this week: [{ id, merchant_id, dba_name, account_status, agent_id, enrollment_date }]
      newEnrollments: dash.new_enrollments?.data || [],
      scorecard: {
        merchant_count: ov.merchants,
        approved:       ov.approved,
        pending:        ov.pending,
        volume_30d:     ov.vol30,
        volume_90d:     ov.vol90,
        volume_mtd:     ov.mtd,
        open_rmas:      ov.open_rmas,
        rank:           rank?.rank ?? null,
        tier:           rank?.tier ?? null,
        companies,
      },
    };
  },

  // Real overview numbers (get_dashboard always returns open_rmas: 0; this one is accurate).
  // Returns: { success, data: { merchants, approved, pending, closed, mtd, vol30, vol90, open_rmas, identifiers[] } }
  getOverview() {
    return request('/api/partner-data', { action: 'get_overview' });
  },

  // Get cached identifiers from storage (populated on login/validate)
  async getIdentifiers() {
    const raw = await Storage.get('partner_identifiers');
    try { return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  },
};

// ── NOTIFICATIONS (api/partner-data.js) ───────────────────────────────────────
export const Notifications = {
  // Returns: { success, notifications: [{ id, type, title, body, actor_name, is_read, created_at, link }], unread }
  get() {
    return request('/api/partner-data', { action: 'get_notifications' });
  },
  markRead() {
    return request('/api/partner-data', { action: 'mark_notifications_read' });
  },
};

// ── MERCHANTS (api/partner-data.js) ───────────────────────────────────────────
export const Merchants = {
  // Get merchants for one agent identifier string (e.g. the partner's agent ID).
  // The backend returns all of the partner's merchants; we filter by agent_id.
  async getByIdentifier(id_string) {
    const res = await request('/api/partner-data', { action: 'get_merchants', page: 0, limit: 1000 });
    if (!res.success) return res;
    const data = id_string ? (res.data || []).filter(m => m.agent_id === id_string) : (res.data || []);
    return { ...res, data };
  },

  // Full merchant detail: { success, data: { merchant, equipment, legacyEquipment, notes, rmas } }
  get(merchant_uuid) {
    return request('/api/partner-data', { action: 'get_merchant_detail', merchant_uuid });
  },

  // Add a partner note to a merchant record. Returns: { success }
  addNote(merchant_uuid, title, body) {
    return request('/api/partner-data', { action: 'add_note', merchant_uuid, title, body });
  },

  // Submit an RMA request. NOTE: the backend expects the merchant *string* ID
  // (merchants.merchant_id), not the uuid. equipment_serial and notes are optional.
  requestRma({ merchant_id, equipment_serial, reason, notes }) {
    return request('/api/partner-data', { action: 'request_rma', merchant_id, equipment_serial, reason, notes });
  },
};

// ── SUB-PARTNERS (api/partner-data.js) ────────────────────────────────────────
export const SubPartners = {
  // Returns: { success, data: [{ person_id, full_name, email, is_portal_active,
  //   agent_ids: [{ id, id_string, rev_share }], merchant_count, volume_30_day }] }
  list() {
    return request('/api/partner-data', { action: 'get_sub_partners' });
  },

  // Returns: { success, data: [{ merchant_id, dba_name, account_status, volume_30_day, enrollment_date }] }
  getMerchants(sub_person_id) {
    return request('/api/partner-data', { action: 'get_sub_partner_merchants', sub_person_id });
  },

  // Backend requires email, full_name, agent_id_string and a parent identifier;
  // we pass parent_id_string and the server resolves it to the identifier UUID.
  invite({ email, full_name, agent_id_string, rev_share, parent_id_string }) {
    return request('/api/partner-data', {
      action: 'invite_sub_partner',
      email, full_name, agent_id_string, rev_share, parent_id_string,
    });
  },
};

// ── TICKETS (api/tickets.js — partner actions, token in body) ─────────────────
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

// ── COMMUNITY (api/community.js — partner identified via body token) ──────────
export const Community = {
  getChannels() {
    return request('/api/community', { action: 'get_channels' });
  },
  getFeed({ channel_id, page = 0, limit = 20 } = {}) {
    const body = { action: 'get_feed', page, limit };
    if (channel_id) body.channel_id = channel_id;
    return request('/api/community', body);
  },
  createPost(channel_id, body) {
    return request('/api/community', { action: 'create_post', body, channel_id });
  },
  react(post_id, emoji = '👍') {
    return request('/api/community', { action: 'react', post_id, emoji });
  },
  getComments(post_id) {
    return request('/api/community', { action: 'get_comments', post_id });
  },
  addComment(post_id, body) {
    return request('/api/community', { action: 'add_comment', post_id, body });
  },
};

// ── MESSAGES (api/partner-data.js) ────────────────────────────────────────────
// The partner portal has a single message thread with PayProTec staff
// (get_messages / send_message), not per-user conversations.
const SUPPORT_USER = { id: 'support', name: 'PayProTec Support', role: 'Staff' };

export const Chat = {
  async getUserList() {
    return { success: true, users: [SUPPORT_USER] };
  },

  async getHistory() {
    // Response: { success, data: [{ id, sender_id, recipient_id, subject, body, created_at }] }
    const res = await request('/api/partner-data', { action: 'get_messages' });
    if (!res.success) return res;
    // Backend returns newest-first; the thread renders oldest-first
    const data = [...(res.data || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return { ...res, data };
  },

  sendMessage(_recipient_id, message) {
    return request('/api/partner-data', { action: 'send_message', body: message });
  },
};

// ── PROFILE (api/partner-data.js) ─────────────────────────────────────────────
export const Profile = {
  // Returns: { success, person, identifiers[] }
  async get() {
    const res = await request('/api/partner-data', { action: 'get_dashboard' });
    if (!res.success) return res;
    return { success: true, person: res.partner, identifiers: res.identifiers || [] };
  },

  // Backend only supports full_name and phone_number via update_profile.
  updateField(_id, field, value) {
    return request('/api/partner-data', { action: 'update_profile', [field]: value });
  },

  async changePassword(current_password, new_password) {
    const partner_id = await Storage.get('partner_person_id');
    return request('/api/partner-auth', { action: 'change_password', partner_id, current_password, new_password });
  },
};
