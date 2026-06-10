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
