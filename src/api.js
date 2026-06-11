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

// Persist the logged-in user's identity + permission flags.
async function storeUser(user) {
  if (!user) return;
  if (user.userid != null) await Storage.set('user_id', String(user.userid));
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  if (name) await Storage.set('user_name', name);
  if (user.role)  await Storage.set('user_role', user.role);
  // Granular permission flags — stored as '1' or '0'
  const flags = [
    'access_merchants','access_deployments','access_returns','access_inventory',
    'access_partners','access_admin_dashboard','access_sending_reports',
    'access_jarvis','can_delete_tickets',
  ];
  for (const f of flags) {
    await Storage.set(f, user[f] ? '1' : '0');
  }
}

// Retrieve the permission object for RBAC checks in screens.
export async function getUserPerms() {
  const role  = (await Storage.get('user_role')) || '';
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'operations admin';
  async function flag(key) { return (await Storage.get(key)) === '1'; }
  return {
    role,
    isAdmin,
    merchants:    isAdmin || await flag('access_merchants'),
    deployments:  isAdmin || await flag('access_deployments'),
    returns:      isAdmin || await flag('access_returns'),
    inventory:    isAdmin || await flag('access_inventory'),
    partners:     isAdmin || await flag('access_partners'),
    adminDash:    isAdmin || await flag('access_admin_dashboard'),
    sendReports:  isAdmin || await flag('access_sending_reports'),
  };
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
    for (const k of ['session_token','user_id','user_name','user_role',
      'access_merchants','access_deployments','access_returns','access_inventory',
      'access_partners','access_admin_dashboard','access_sending_reports',
      'access_jarvis','can_delete_tickets']) {
      await Storage.remove(k);
    }
  },
};

// ── MERCHANTS ─────────────────────────────────────────────────────────────────
export const Merchants = {
  // Response: { success, data[], count, metrics }
  // Backend only filters when BOTH query and filterBy are sent; page is 0-based.
  list(query = '', page = 1, limit = 20, filterBy = 'dba_name') {
    const body = { action: 'list', page: Math.max(0, page - 1), limit };
    if (query) { body.query = query; body.filterBy = filterBy; }
    return request('/api/merchants', body);
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
  // Required: merchant_id (string), dba_name (string).
  // Optional: email, merchant_phone, merchant_primary_contact,
  //           merchant_address, merchant_city, merchant_state, merchant_zip,
  //           merchant_country, agent_id, account_status, source
  // Response: { success, merchant_id }
  create(payload) {
    return request('/api/merchants', { action: 'create', ...payload });
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
  // Add equipment items to an existing open RMA.
  // Required: return_uuid (string), equipment_ids (array of IDs)
  // Response: { success, added, message }
  addItems(return_uuid, equipment_ids) {
    return request('/api/returns', { action: 'add_items', return_uuid, equipment_ids });
  },
  // Retrieve unprocessed deployment items eligible to be added to a bulk RMA.
  // Required: (none beyond auth) — optional: merchant_id to scope results
  getAddableItems(merchant_id) {
    const body = { action: 'get_addable_items' };
    if (merchant_id) body.merchant_id = merchant_id;
    return request('/api/returns', body);
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
  // Create a single-unit deployment.
  // Required: payload.merchant_id (UUID), payload.equipment_id (UUID), payload.target_date (ISO date string)
  // Optional: payload.tid, payload.tracking_id, payload.notes, payload.purchase_type
  // Response: { success, data[] } on 200; { success: false, message } on 409/400
  create(payload) {
    return request('/api/deployments', { action: 'create', payload });
  },
  // Search for merchants and stocked equipment. query: string
  // Response: { success, merchants[{id,dba_name,merchant_id}], inventory[{id,serial_number,terminal_type,status}] }
  getLookups(query = '') {
    return request('/api/deployments', { action: 'getLookups', query });
  },
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const Dashboard = {
  async stats() {
    const [merchants, returns, deployments, taskStats] = await Promise.allSettled([
      Merchants.list('', 1, 1),
      Returns.list('', 0, 1),
      Deployments.list('', 1, 1),
      Tasks.stats(),
    ]);
    return {
      merchants: merchants.value?.count ?? '—',
      openReturns: returns.value?.metrics?.open ?? '—',
      activeDeployments: deployments.value?.metrics?.active ?? '—',
      openTasks: taskStats.value?.all ?? '—',
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

// ── TICKETS ───────────────────────────────────────────────────────────────────
export const Tickets = {
  // List tickets for the authenticated partner.
  // Optional: merchant_uuid to filter by merchant.
  // Response: { success, data: [{ id, ticket_number, type, category, subject, status, priority, created_at, updated_at }] }
  list(merchant_uuid) {
    const body = { action: 'list_for_partner' };
    if (merchant_uuid) body.merchant_uuid = merchant_uuid;
    return request('/api/tickets', body);
  },
  // Create a new ticket.
  // Required: type (string), subject (string)
  // Optional: merchant_id, category, description, priority, deployment_id, equipment_serial
  // Response: { success, ticket: { id, ticket_number, status, created_at } }
  create(payload) {
    return request('/api/tickets', { action: 'create', ...payload });
  },
  // Get full ticket details.
  // Required: ticket_id
  // Response: { success, ticket: { full ticket data } }
  get(ticket_id) {
    return request('/api/tickets', { action: 'get_detail', ticket_id });
  },
  // Get comments on a ticket.
  // Required: ticket_id
  // Response: { success, comments: [] }
  getComments(ticket_id) {
    return request('/api/tickets', { action: 'get_comments', ticket_id });
  },
  // Add a comment to a ticket.
  // Required: ticket_id, body
  // Response: { success, comment: { id, ticket_id, author_type, author_name, body, created_at } }
  addComment(ticket_id, body) {
    return request('/api/tickets', { action: 'add_comment', ticket_id, body });
  },
  // Get total unread count for authenticated partner.
  // Response: { success, total }
  getUnreadTotal() {
    return request('/api/tickets', { action: 'get_unread_total' });
  },
};

// ── EQUIPMENTS ────────────────────────────────────────────────────────────────
export const Equipments = {
  // List equipment with optional search/filters.
  // Optional: query, filterLocation, filterStatus, limit (default 50), page (default 0)
  // Response: { success, data[], count, metrics: { total, inOffice, inRepair, deployed, retired, alerts } }
  list({ query = '', filterLocation, filterStatus, limit = 50, page = 0 } = {}) {
    const body = { action: 'list', query, limit, page };
    if (filterLocation) body.filterLocation = filterLocation;
    if (filterStatus)   body.filterStatus   = filterStatus;
    return request('/api/equipments', body);
  },
  // Create a single equipment unit.
  // Required: payload.serial_number
  // Optional: all other equipment fields (terminal_type, condition, received_date, current_location, notes)
  // Response: { success, data: Equipment }
  create(payload) {
    return request('/api/equipments', { action: 'create', payload });
  },
  // Get all unique serial numbers.
  // Response: { success, serials: string[] }
  getAllSerials() {
    return request('/api/equipments', { action: 'getAllSerials' });
  },
  // Get equipment activity/history logs.
  // Required: equipment_id
  // Response: { success, data: EquipmentLog[] }
  getHistory(equipment_id) {
    return request('/api/equipments', { action: 'getHistory', equipment_id });
  },
  // List available terminal types.
  // Response: { success, terminal_types: [{ id, name, sort_order, is_active }] }
  listTerminalTypes() {
    return request('/api/equipments', { action: 'list_terminal_types' });
  },
  // Update an equipment unit.
  // Required: id. payload may contain: serial_number, terminal_type, condition,
  //           notes, received_date, current_location
  // Response: { success, data[] }
  update(id, payload) {
    return request('/api/equipments', { action: 'update', id, payload });
  },
  // List units currently at the Warsaw Repairs location.
  // Response: { success, data[] (rows include repair_stage, repair_notes, days_in_repair),
  //             summary: { total, critical_count, avg_days_in_repair, stage_counts,
  //                        model_counts, critical_threshold_days } }
  listRepairQueue() {
    return request('/api/equipments', { action: 'list_repair_queue' });
  },
  // Log a repair stage change / note on a unit in the repair queue.
  // Required: equipment_id, repair_stage. Optional: repair_notes
  // Response: { success }
  logRepairAction(equipment_id, repair_stage, repair_notes) {
    return request('/api/equipments', { action: 'log_repair_action', equipment_id, repair_stage, repair_notes });
  },
  // Close out a repair. outcome: 'scrap' → decommissioned/Retired,
  // anything else → stocked/Warsaw Office. Required: equipment_id, outcome
  // Response: { success }
  closeRepair(equipment_id, outcome) {
    return request('/api/equipments', { action: 'close_repair', equipment_id, outcome });
  },
  // Fleet ROI / utilization stats.
  // Optional: idle_threshold_days (default 90)
  // Response: { success, idle_threshold_days, summary, model_stats[], idle_serials[], location_breakdown[] }
  getRoiStats(idle_threshold_days) {
    const body = { action: 'get_roi_stats' };
    if (idle_threshold_days) body.idle_threshold_days = idle_threshold_days;
    return request('/api/equipments', body);
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

// ── PARTNERS ──────────────────────────────────────────────────────────────────
export const Partners = {
  // Leaderboard of all agents.
  // Response: { success, data: [{person_id, name, merchant_count, volume_30_day, volume_90_day, rank, tier, growth_pct}],
  //             needs_attention: [], total }
  getLeaderboard() {
    return request('/api/partners', { action: 'get_leaderboard' });
  },
  // Scorecard for a specific agent.
  // Required: person_id. Optional: from_date, to_date.
  // Response: { success, scorecard: { totals, companies, top_merchants } }
  getScorecard(person_id, from_date, to_date) {
    const body = { action: 'get_scorecard', person_id };
    if (from_date) body.from_date = from_date;
    if (to_date)   body.to_date   = to_date;
    return request('/api/partners', body);
  },
  // List of all agents (for admin transfers).
  // Response: { success, data: [{agent_id, person_name, person_email, company_name, identifier_count}] }
  getAllAgents() {
    return request('/api/partners', { action: 'get_all_agents_for_transfer' });
  },
  // Complete unfiltered roster — every person record, plus agents/identifiers/companies.
  // (The leaderboard only contains partners with merchant activity, so it under-counts.)
  // Response: { success, data: { persons[], agents[], identifiers[], companies[] } }
  getList() {
    return request('/api/partners', { action: 'get_partners_list' });
  },
  // Companies with agent counts.
  // Response: { success, data: [{id, company_name, agent_count}] }
  getCompaniesFull() {
    return request('/api/partners', { action: 'get_companies_full' });
  },
  // Agents (and their identifiers) for a company.
  // Required: company_id.
  // Response: { success, data: [{agent_id, person_id, person_name, person_email,
  //             identifiers: [{id, id_string, rev_share}] }] }
  getCompanyAgents(company_id) {
    return request('/api/partners', { action: 'get_company_agents', company_id });
  },
  // Identifiers not tied to any company.
  // Response: { success, data: [{id, id_string, rev_share, prime49, person_name, person_email, person_id}] }
  getIndependentIdentifiers() {
    return request('/api/partners', { action: 'get_independent_identifiers' });
  },
  // Update one field on a person record.
  // Required: id (person id), field, value.
  // field MUST be one of: full_name, email, phone_number, is_branded, enrolled_at.
  // Response: { success }
  updatePersonField(id, field, value) {
    return request('/api/partners', { action: 'update_person_field', id, field, value });
  },
  // Update an identifier's rev_share / prime49 / parent company.
  // Required: id (identifier id). NOTE: the id_string itself is IMMUTABLE —
  // the backend has no action to rename an agent ID.
  // Response: { success }
  updateIdentifier(id, { rev_share, prime49, new_parent_id } = {}) {
    return request('/api/partners', { action: 'update_identifier_all', id, rev_share, prime49, new_parent_id });
  },
  // Create a partner (full onboarding).
  // payload: { person: {name, email, phone, hl_id, is_branded, enrolled_at},
  //            company: {id, name, isIndependent},   // existing: id; new: name only; none: isIndependent=true
  //            identifiers: [{string, rev, prime}],
  //            isQuickAdd, allowNoEmail }
  // person.name required; email required unless allowNoEmail=true.
  // Response: { success, message? }
  createPartner(payload) {
    return request('/api/partners', { action: 'complete_onboarding', ...payload });
  },
  // Lightweight companies list (for pickers).
  // Response: { success, data: [{id, company_name}] }
  getCompanies() {
    return request('/api/partners', { action: 'get_companies' });
  },
};

// ── COMMUNITY ─────────────────────────────────────────────────────────────────
export const Community = {
  // Response: { success, data: channels[] }
  getChannels() {
    return request('/api/community', { action: 'get_channels' });
  },
  // Response: { success, data: posts[], count, has_more }
  getFeed({ channel_id, page = 0, limit = 20 } = {}) {
    const body = { action: 'get_feed', page, limit };
    if (channel_id) body.channel_id = channel_id;
    return request('/api/community', body);
  },
  // Required: body, channel_id.
  async createPost(channel_id, body) {
    const staff_id = await Storage.get('user_id');
    const staff_name = await Storage.get('user_name');
    return request('/api/community', { action: 'create_post', body, channel_id, staff_id, staff_name });
  },
  // Toggle reaction on a post.
  async react(post_id, emoji = '👍') {
    const staff_id = await Storage.get('user_id');
    return request('/api/community', { action: 'react', post_id, emoji, staff_id });
  },
  // Response: { success, data: comments[] }
  getComments(post_id) {
    return request('/api/community', { action: 'get_comments', post_id });
  },
  // Required: post_id, body.
  async addComment(post_id, body) {
    const staff_id = await Storage.get('user_id');
    const staff_name = await Storage.get('user_name');
    return request('/api/community', { action: 'add_comment', post_id, body, staff_id, staff_name });
  },
  // Response: { success, data: users[] }
  getMembers() {
    return request('/api/community', { action: 'community_members' });
  },
  // Response: { success, dms: int, notifications: int }
  getUnreadCounts() {
    return request('/api/community', { action: 'get_unread_counts' });
  },
};

// ── CHAT (Direct Messages) ────────────────────────────────────────────────────
export const Chat = {
  // List of users you can DM (staff + partners with portal).
  // Response: array of { id, full_name, last_message, unread_count, last_seen }
  getUserList() {
    return request('/api/chat', { action: 'getUserList' });
  },
  // Full conversation thread with another user.
  // Required: other_id. Response: { messages[], other_profile }
  getHistory(other_id) {
    return request('/api/chat', { action: 'getHistory', other_id });
  },
  // Send a DM. Required: recipient_id, body.
  sendMessage(recipient_id, body) {
    return request('/api/chat', { action: 'sendMessage', recipient_id, body });
  },
  // Response: { count: number }
  getUnreadCount() {
    return request('/api/chat', { action: 'getUnreadCount' });
  },
};
