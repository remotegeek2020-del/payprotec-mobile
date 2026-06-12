import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';
import { Storage } from '../../storage';

const STATUSES = ['all', 'open', 'in_progress', 'resolved', 'closed'];
const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'deployment_request', label: 'Deployments' },
  { value: 'rma_request', label: 'Returns' },
  { value: 'general', label: 'General' },
];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const STATUS_COLORS = {
  open:        { bg: '#dbeafe', text: '#1d4ed8' },
  in_progress: { bg: '#fef3c7', text: '#d97706' },
  resolved:    { bg: '#d1fae5', text: '#059669' },
  closed:      { bg: '#f1f5f9', text: '#64748b' },
};
const PRIORITY_COLORS = {
  urgent: { bg: '#fee2e2', text: '#dc2626' },
  high:   { bg: '#fee2e2', text: '#dc2626' },
  normal: { bg: '#fef3c7', text: '#d97706' },
  low:    { bg: '#d1fae5', text: '#059669' },
};

function statusColor(s) { return STATUS_COLORS[(s || '').toLowerCase()] || STATUS_COLORS.open; }
function priorityColor(p) { return PRIORITY_COLORS[(p || '').toLowerCase()] || PRIORITY_COLORS.normal; }
function statusLabel(s) { return (s || 'open').replace(/_/g, ' ').toUpperCase(); }
function stripHtml(str) { return String(str || '').replace(/<[^>]*>/g, ''); }
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

async function getStaffUser() {
  try {
    const raw = await Storage.get('staff_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// ── Ticket card ────────────────────────────────────────────────────────────────
function TicketCard({ item, unread, onOpen }) {
  const sc = statusColor(item.status);
  const pc = priorityColor(item.priority);
  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.ticketNum}>{item.ticket_number || item.id || '—'}</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {unread > 0 && (
            <View style={s.unreadBadge}><Text style={s.unreadText}>{unread}</Text></View>
          )}
          <View style={[s.badge, { backgroundColor: pc.bg }]}>
            <Text style={[s.badgeText, { color: pc.text }]}>{(item.priority || 'normal').toUpperCase()}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: sc.bg }]}>
            <Text style={[s.badgeText, { color: sc.text }]}>{statusLabel(item.status)}</Text>
          </View>
        </View>
      </View>
      <Text style={s.subject} numberOfLines={2}>{item.subject || '—'}</Text>
      <View style={s.cardBottom}>
        {item.persons?.full_name ? <Text style={s.meta}>🤝 {item.persons.full_name}</Text> : null}
        {item.merchants?.dba_name ? <Text style={s.meta}>🏪 {item.merchants.dba_name}</Text> : null}
        {item.assigned_to ? <Text style={s.meta}>👤 {item.assigned_to}</Text> : null}
        {item.created_at ? <Text style={s.date}>{formatDate(item.created_at)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
function DetailModal({ ticketId, staffList, staffName, onClose, onChanged }) {
  const [ticket, setTicket]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [comments, setComments]       = useState([]);
  const [loadingC, setLoadingC]       = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal]   = useState(false);
  const [posting, setPosting]         = useState(false);
  // edit state
  const [editStatus, setEditStatus]     = useState(null);
  const [editPriority, setEditPriority] = useState(null);
  const [editAssignee, setEditAssignee] = useState('');
  const [showAssign, setShowAssign]     = useState(false);
  const [saving, setSaving]             = useState(false);

  const loadDetail = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await staffRequest('/api/tickets', { action: 'get_detail', ticket_id: ticketId });
      if (res.success && res.ticket) {
        setTicket(res.ticket);
        setEditStatus(res.ticket.status || 'open');
        setEditPriority(res.ticket.priority || 'normal');
        setEditAssignee(res.ticket.assigned_to || '');
      }
    } catch (e) { /* sessionExpired — fail quietly */ }
    setLoading(false);
  }, [ticketId]);

  const loadComments = useCallback(async () => {
    if (!ticketId) return;
    setLoadingC(true);
    try {
      const res = await staffRequest('/api/tickets', { action: 'get_comments', ticket_id: ticketId });
      setComments(res.comments || []);
    } catch (e) { /* ignore */ }
    setLoadingC(false);
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) return;
    loadDetail();
    loadComments();
    // Mark staff-side unread as read on open
    staffRequest('/api/tickets', { action: 'mark_read', ticket_id: ticketId }).catch(() => {});
  }, [ticketId, loadDetail, loadComments]);

  if (!ticketId) return null;

  async function saveChanges() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await staffRequest('/api/tickets', {
        action: 'update_status',
        ticket_id: ticketId,
        status: editStatus,
        priority: editPriority,
        assigned_to: editAssignee || null,
        staff_name: staffName,
      });
      if (res.success) {
        await loadDetail();
        await loadComments();
        onChanged && onChanged();
      } else {
        Alert.alert('Error', res.message || res.error || 'Could not update ticket.');
      }
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not update ticket.');
    }
    setSaving(false);
  }

  async function postComment() {
    const body = commentText.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await staffRequest('/api/tickets', {
        action: 'add_comment',
        ticket_id: ticketId,
        body,
        is_internal: isInternal,
        staff_name: staffName,
      });
      if (res.success) {
        setCommentText('');
        loadComments();
      } else {
        Alert.alert('Error', res.message || res.error || 'Could not post comment.');
      }
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not post comment.');
    }
    setPosting(false);
  }

  const sc = statusColor(ticket?.status);
  const pc = priorityColor(ticket?.priority);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>
                {ticket ? (ticket.ticket_number || ticket.subject) : 'Ticket'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {loading && !ticket ? (
              <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
            ) : !ticket ? (
              <Text style={s.empty}>Ticket not found</Text>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
                <Text style={s.subject}>{ticket.subject}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <View style={[s.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.badgeText, { color: sc.text }]}>{statusLabel(ticket.status)}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: pc.bg }]}>
                    <Text style={[s.badgeText, { color: pc.text }]}>{(ticket.priority || 'normal').toUpperCase()}</Text>
                  </View>
                  {ticket.type ? (
                    <View style={[s.badge, { backgroundColor: COLORS.bg }]}>
                      <Text style={[s.badgeText, { color: COLORS.muted }]}>{String(ticket.type).replace(/_/g, ' ').toUpperCase()}</Text>
                    </View>
                  ) : null}
                </View>
                {ticket.description ? <Text style={s.detailBody}>{ticket.description}</Text> : null}

                {/* Partner / merchant info */}
                <Text style={s.fieldLabel}>Contact</Text>
                <View style={s.infoCard}>
                  {ticket.persons ? (
                    <>
                      <Text style={s.infoLine}>🤝 {ticket.persons.full_name || '—'}</Text>
                      {ticket.persons.email ? <Text style={s.infoSub}>{ticket.persons.email}</Text> : null}
                      {ticket.persons.phone_number ? <Text style={s.infoSub}>{ticket.persons.phone_number}</Text> : null}
                    </>
                  ) : <Text style={s.infoSub}>No partner linked</Text>}
                  {ticket.merchants ? (
                    <>
                      <Text style={[s.infoLine, { marginTop: 8 }]}>🏪 {ticket.merchants.dba_name || '—'}</Text>
                      <Text style={s.infoSub}>
                        {[ticket.merchants.merchant_id,
                          [ticket.merchants.merchant_city, ticket.merchants.merchant_state].filter(Boolean).join(', '),
                          ticket.merchants.merchant_phone].filter(Boolean).join(' · ')}
                      </Text>
                    </>
                  ) : null}
                  {ticket.equipment_serial ? <Text style={[s.infoSub, { marginTop: 6 }]}>🖥️ {ticket.equipment_serial}</Text> : null}
                  {ticket.linked_deployment_id ? <Text style={s.infoSub}>🚚 {ticket.linked_deployment_id}</Text> : null}
                  {ticket.linked_return_id ? <Text style={s.infoSub}>📦 {ticket.linked_return_id}</Text> : null}
                  {ticket.created_at ? <Text style={[s.infoSub, { marginTop: 6 }]}>Created {formatDateTime(ticket.created_at)}</Text> : null}
                </View>

                {/* Edit section */}
                <Text style={s.fieldLabel}>Status</Text>
                <View style={s.chipRow}>
                  {STATUSES.filter(x => x !== 'all').map(st => (
                    <TouchableOpacity key={st} style={[s.chip, editStatus === st && s.chipActive]} onPress={() => setEditStatus(st)}>
                      <Text style={[s.chipText, editStatus === st && s.chipTextActive]}>{st.replace(/_/g, ' ')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLabel}>Priority</Text>
                <View style={s.chipRow}>
                  {PRIORITIES.map(p => {
                    const cc = priorityColor(p);
                    const active = editPriority === p;
                    return (
                      <TouchableOpacity key={p} style={[s.chip, active && { backgroundColor: cc.bg, borderColor: cc.text }]} onPress={() => setEditPriority(p)}>
                        <Text style={[s.chipText, active && { color: cc.text }]}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={s.fieldLabel}>Assigned To</Text>
                <TouchableOpacity style={s.input} onPress={() => setShowAssign(v => !v)}>
                  <Text style={{ fontSize: 14, color: editAssignee ? COLORS.text : COLORS.light }}>
                    {editAssignee || '— Unassigned —'} {showAssign ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                {showAssign && (
                  <View style={s.assignList}>
                    <TouchableOpacity style={s.assignRow} onPress={() => { setEditAssignee(''); setShowAssign(false); }}>
                      <Text style={[s.assignText, { color: COLORS.muted }]}>— Unassigned —</Text>
                    </TouchableOpacity>
                    {staffList.map(u => (
                      <TouchableOpacity key={u.id} style={s.assignRow} onPress={() => { setEditAssignee(u.full_name); setShowAssign(false); }}>
                        <Text style={s.assignText}>{u.full_name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TextInput
                      style={[s.input, { marginTop: 6 }]}
                      placeholder="Or type a name…"
                      placeholderTextColor={COLORS.light}
                      value={editAssignee}
                      onChangeText={setEditAssignee}
                    />
                  </View>
                )}

                <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={saveChanges} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save Changes</Text>}
                </TouchableOpacity>

                {/* Comments */}
                <Text style={s.fieldLabel}>Activity & Comments</Text>
                {loadingC
                  ? <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} />
                  : comments.length === 0
                    ? <Text style={s.emptySmall}>No activity yet</Text>
                    : comments.map((c, i) => (
                        <View key={c.id || i} style={[s.commentCard, c.is_internal && s.commentInternal]}>
                          {c.change_summary
                            ? <Text style={s.commentSystem}>{stripHtml(c.change_summary)}</Text>
                            : <Text style={s.commentBody}>{c.body}</Text>}
                          <View style={s.commentMeta}>
                            <Text style={s.commentAuthor}>
                              {c.author_name || 'Unknown'}
                              {c.author_type ? ` · ${c.author_type}` : ''}
                              {c.is_internal ? ' · 🔒 internal' : ''}
                            </Text>
                            <Text style={s.commentDate}>{formatDateTime(c.created_at)}</Text>
                          </View>
                        </View>
                      ))
                }

                <TouchableOpacity style={s.internalToggle} onPress={() => setIsInternal(v => !v)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 14 }}>{isInternal ? '🔒' : '💬'}</Text>
                  <Text style={s.internalToggleText}>
                    {isInternal ? 'Internal note (hidden from partner)' : 'Public comment (partner notified)'}
                  </Text>
                  <View style={[s.toggleDot, isInternal && { backgroundColor: COLORS.warning }]} />
                </TouchableOpacity>
                <View style={s.commentInputRow}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    placeholder={isInternal ? 'Add internal note…' : 'Add a comment…'}
                    placeholderTextColor={COLORS.light}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                  />
                  <TouchableOpacity
                    style={[s.postBtn, (!commentText.trim() || posting) && { opacity: 0.5 }]}
                    onPress={postComment}
                    disabled={!commentText.trim() || posting}
                  >
                    {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.postBtnText}>Post</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen (tab — renders its own compact header) ──────────────────────────────
export default function StaffTicketsScreen() {
  const [tickets, setTickets]       = useState([]);
  const [unreadMap, setUnreadMap]   = useState({});
  const [staffList, setStaffList]   = useState([]);
  const [staffName, setStaffName]   = useState('Staff');
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState('all');

  async function load() {
    setLoading(true);
    try {
      const [listRes, unreadRes] = await Promise.all([
        staffRequest('/api/tickets', { action: 'list_for_staff', limit: 200 }),
        staffRequest('/api/tickets', { action: 'get_unread_counts' }),
      ]);
      setTickets(listRes.data || []);
      const map = {};
      (unreadRes.counts || []).forEach(c => { map[c.id] = c.unread_count || 0; });
      setUnreadMap(map);
    } catch (e) { /* sessionExpired — fail quietly */ }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    getStaffUser().then(u => {
      if (u) setStaffName(`${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Staff');
    });
    staffRequest('/api/tasks', { action: 'get_staff' })
      .then(res => setStaffList(res.data || []))
      .catch(() => {});
  }, []);

  let filtered = tickets;
  if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
  if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);
  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(t =>
      (t.subject || '').toLowerCase().includes(q) ||
      (t.ticket_number || '').toLowerCase().includes(q) ||
      (t.assigned_to || '').toLowerCase().includes(q) ||
      (t.merchants?.dba_name || '').toLowerCase().includes(q) ||
      (t.persons?.full_name || '').toLowerCase().includes(q)
    );
  }

  function openTicket(t) {
    setSelectedId(t.id);
    // Optimistically clear unread badge — mark_read fires inside the modal
    setUnreadMap(m => ({ ...m, [t.id]: 0 }));
  }

  return (
    <View style={s.root}>
      <View style={s.headerBar}>
        <Text style={s.headerTitle}>🎫 Tickets</Text>
      </View>
      <View style={s.topBar}>
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search tickets…"
            placeholderTextColor={COLORS.light}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
          {STATUSES.map(st => (
            <TouchableOpacity key={st} style={[s.chip, statusFilter === st && s.chipActive]} onPress={() => setStatusFilter(st)}>
              <Text style={[s.chipText, statusFilter === st && s.chipTextActive]}>
                {st === 'all' ? 'All' : st.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={s.chipSep} />
          {TYPES.map(t => (
            <TouchableOpacity key={t.value} style={[s.chip, typeFilter === t.value && s.chipActive]} onPress={() => setTypeFilter(t.value)}>
              <Text style={[s.chipText, typeFilter === t.value && s.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <TicketCard item={item} unread={unreadMap[item.id] || 0} onOpen={openTicket} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No tickets found</Text> : null}
      />

      {selectedId ? (
        <DetailModal
          ticketId={selectedId}
          staffList={staffList}
          staffName={staffName}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  headerBar:     { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingHorizontal: 16, paddingBottom: 4, backgroundColor: COLORS.bg },
  headerTitle:   { fontSize: 22, fontWeight: '900', color: COLORS.text },
  topBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  searchBar:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:    { fontSize: 16, marginRight: 6 },
  searchInput:   { flex: 1, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  filterRow:     { paddingVertical: 10 },
  chipSep:       { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },
  list:          { paddingHorizontal: 12, paddingBottom: 30 },
  card:          { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  ticketNum:     { fontSize: 13, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 10, fontWeight: '800' },
  unreadBadge:   { backgroundColor: COLORS.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText:    { color: '#fff', fontSize: 11, fontWeight: '800' },
  subject:       { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  cardBottom:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta:          { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  date:          { fontSize: 11, color: COLORS.light, marginLeft: 'auto' },
  empty:         { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  emptySmall:    { color: COLORS.muted, fontSize: 12, marginBottom: 8 },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:    { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.text },
  modalClose:    { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  fieldLabel:    { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:          { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:      { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'capitalize' },
  chipTextActive:{ color: '#fff' },
  input:         { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  primaryBtn:    { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText:{ color: '#fff', fontSize: 14, fontWeight: '800' },
  detailBody:    { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 8 },
  infoCard:      { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12 },
  infoLine:      { fontSize: 13, fontWeight: '700', color: COLORS.text },
  infoSub:       { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  assignList:    { backgroundColor: COLORS.bg, borderRadius: 10, padding: 8, marginBottom: 4 },
  assignRow:     { paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  assignText:    { fontSize: 13, fontWeight: '600', color: COLORS.text },
  commentCard:   { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginBottom: 8 },
  commentInternal: { backgroundColor: '#fef9ec', borderWidth: 1, borderColor: '#fde68a' },
  commentBody:   { fontSize: 13, color: COLORS.text, lineHeight: 18, marginBottom: 5 },
  commentSystem: { fontSize: 12, color: COLORS.muted, fontStyle: 'italic', lineHeight: 17, marginBottom: 5 },
  commentMeta:   { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  commentAuthor: { fontSize: 11, fontWeight: '700', color: COLORS.primary, flexShrink: 1 },
  commentDate:   { fontSize: 11, color: COLORS.light },
  internalToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginTop: 4 },
  internalToggleText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.muted },
  toggleDot:     { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.border },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
  postBtn:       { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  postBtnText:   { color: '#fff', fontSize: 13, fontWeight: '800' },
});
