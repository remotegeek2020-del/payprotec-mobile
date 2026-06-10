import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Tickets } from '../api';

const TICKET_TYPES = ['General', 'Deployment', 'RMA', 'Billing', 'Technical'];

const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

const STATUS_COLORS = {
  open:        { bg: '#dbeafe', text: '#1d4ed8' },
  'in progress':{ bg: '#fef3c7', text: '#d97706' },
  pending:     { bg: '#fef3c7', text: '#d97706' },
  resolved:    { bg: '#d1fae5', text: '#059669' },
  closed:      { bg: '#f1f5f9', text: '#64748b' },
};

const PRIORITY_COLORS = {
  urgent: { bg: '#fee2e2', text: '#dc2626' },
  high:   { bg: '#fee2e2', text: '#dc2626' },
  normal: { bg: '#fef3c7', text: '#d97706' },
  low:    { bg: '#d1fae5', text: '#059669' },
};

function statusColor(status) {
  return STATUS_COLORS[(status || '').toLowerCase()] || STATUS_COLORS.open;
}

function priorityColor(priority) {
  return PRIORITY_COLORS[(priority || '').toLowerCase()] || PRIORITY_COLORS.normal;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Ticket card ────────────────────────────────────────────────────────────────

function TicketCard({ item, onOpen }) {
  const sc = statusColor(item.status);
  const pc = priorityColor(item.priority);

  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.ticketNum}>{item.ticket_number || item.id || '—'}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[s.badge, { backgroundColor: pc.bg }]}>
            <Text style={[s.badgeText, { color: pc.text }]}>
              {(item.priority || 'Normal').toUpperCase()}
            </Text>
          </View>
          <View style={[s.badge, { backgroundColor: sc.bg }]}>
            <Text style={[s.badgeText, { color: sc.text }]}>
              {(item.status || 'Open').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={s.subject} numberOfLines={2}>{item.subject || '—'}</Text>

      <View style={s.cardBottom}>
        {item.type ? <Text style={s.meta}>{item.type}</Text> : null}
        {item.category ? <Text style={s.meta}>{item.category}</Text> : null}
        {item.created_at ? <Text style={s.date}>{formatDate(item.created_at)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Create ticket modal ────────────────────────────────────────────────────────

function CreateTicketModal({ visible, onClose, onCreated }) {
  const [type, setType]             = useState('General');
  const [subject, setSubject]       = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]     = useState('Normal');
  const [saving, setSaving]         = useState(false);

  function reset() {
    setType('General'); setSubject(''); setDescription(''); setPriority('Normal');
  }

  async function submit() {
    if (!subject.trim()) { Alert.alert('Required', 'Enter a subject for the ticket.'); return; }
    setSaving(true);
    try {
      const payload = {
        type,
        subject: subject.trim(),
        priority,
      };
      if (description.trim()) payload.description = description.trim();

      const res = await Tickets.create(payload);
      if (res.success) {
        reset();
        onCreated();
      } else {
        Alert.alert('Error', res.error || res.message || 'Could not create ticket.');
      }
    } catch {
      Alert.alert('Error', 'Could not create ticket. Check your connection.');
    }
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Ticket</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={s.fieldLabel}>Type *</Text>
              <View style={s.chipRow}>
                {TICKET_TYPES.map(t => {
                  const active = type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setType(t)}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Subject *</Text>
              <TextInput
                style={s.input}
                placeholder="Brief description of the issue"
                placeholderTextColor={COLORS.light}
                value={subject}
                onChangeText={setSubject}
              />

              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Detailed description (optional)"
                placeholderTextColor={COLORS.light}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text style={s.fieldLabel}>Priority</Text>
              <View style={s.chipRow}>
                {PRIORITIES.map(p => {
                  const active = priority === p;
                  const pc = priorityColor(p);
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[s.chip, active && { backgroundColor: pc.bg, borderColor: pc.text }]}
                      onPress={() => setPriority(p)}
                    >
                      <Text style={[s.chipText, active && { color: pc.text }]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[s.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={submit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryBtnText}>Create Ticket</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Ticket detail modal ────────────────────────────────────────────────────────

function TicketDetailModal({ ticket, onClose }) {
  const [comments, setComments]           = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText]     = useState('');
  const [posting, setPosting]             = useState(false);

  const ticketId = ticket?.id;

  useEffect(() => {
    if (!ticketId) return;
    setComments([]);
    setLoadingComments(true);
    Tickets.getComments(ticketId)
      .then(data => setComments(data.comments || []))
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, [ticketId]);

  if (!ticket) return null;

  const sc = statusColor(ticket.status);
  const pc = priorityColor(ticket.priority);

  async function postComment() {
    const body = commentText.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await Tickets.addComment(ticketId, body);
      if (res.success) {
        setCommentText('');
        const data = await Tickets.getComments(ticketId);
        setComments(data.comments || []);
      } else {
        Alert.alert('Error', res.error || 'Could not post comment.');
      }
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
    setPosting(false);
  }

  return (
    <Modal visible={!!ticket} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>{ticket.ticket_number || ticket.subject || 'Ticket'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={s.subject}>{ticket.subject}</Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <View style={[s.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.badgeText, { color: sc.text }]}>{(ticket.status || 'Open').toUpperCase()}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: pc.bg }]}>
                  <Text style={[s.badgeText, { color: pc.text }]}>{(ticket.priority || 'Normal').toUpperCase()}</Text>
                </View>
                {ticket.type ? (
                  <View style={[s.badge, { backgroundColor: COLORS.bg }]}>
                    <Text style={[s.badgeText, { color: COLORS.muted }]}>{ticket.type.toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>

              {ticket.description ? (
                <Text style={s.detailBody}>{ticket.description}</Text>
              ) : null}

              <View style={s.detailMetaRow}>
                {ticket.created_at ? <Text style={s.detailMeta}>Created {formatDate(ticket.created_at)}</Text> : null}
                {ticket.updated_at ? <Text style={s.detailMeta}>Updated {formatDate(ticket.updated_at)}</Text> : null}
                {ticket.category   ? <Text style={s.detailMeta}>Category: {ticket.category}</Text> : null}
              </View>

              <Text style={s.fieldLabel}>Comments</Text>
              {loadingComments ? (
                <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} />
              ) : comments.length === 0 ? (
                <Text style={s.emptySmall}>No comments yet</Text>
              ) : (
                comments.map((c, i) => (
                  <View key={c.id || i} style={s.commentCard}>
                    <Text style={s.commentBody}>{c.body}</Text>
                    <View style={s.commentMeta}>
                      <Text style={s.commentAuthor}>{c.author_name || 'Unknown'}</Text>
                      <Text style={s.commentDate}>{formatDate(c.created_at)}</Text>
                    </View>
                  </View>
                ))
              )}

              <View style={s.commentInputRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Add a comment…"
                  placeholderTextColor={COLORS.light}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity
                  style={[s.searchBtn, (!commentText.trim() || posting) && { opacity: 0.5 }]}
                  onPress={postComment}
                  disabled={!commentText.trim() || posting}
                >
                  {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.searchBtnText}>Post</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function TicketsScreen() {
  const [tickets, setTickets]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [selected, setSelected]       = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [query, setQuery]             = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await Tickets.list();
      setTickets(data.data || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function onRefresh() { setRefreshing(true); load(); }

  // Client-side filtering since list_for_partner doesn't accept a query param
  const filtered = query.trim()
    ? tickets.filter(t =>
        (t.subject || '').toLowerCase().includes(query.toLowerCase()) ||
        (t.ticket_number || '').toLowerCase().includes(query.toLowerCase()) ||
        (t.type || '').toLowerCase().includes(query.toLowerCase()) ||
        (t.category || '').toLowerCase().includes(query.toLowerCase())
      )
    : tickets;

  return (
    <View style={s.container}>
      {/* Search */}
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

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <TicketCard item={item} onOpen={setSelected} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No tickets found</Text> : null}
      />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={s.fabText}>＋</Text>
      </TouchableOpacity>

      <CreateTicketModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
      />

      <TicketDetailModal
        ticket={selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 14, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:  { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  list:        { paddingHorizontal: 14, paddingBottom: 90 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  ticketNum:   { fontSize: 13, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  badge:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 10, fontWeight: '800' },
  subject:     { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta:        { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  date:        { fontSize: 11, color: COLORS.light, marginLeft: 'auto' },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  emptySmall:  { color: COLORS.muted, fontSize: 12, marginBottom: 8 },

  // FAB
  fab:         { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabText:     { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 32 },

  // Modal shared
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalWrap:   { width: '100%' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:  { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  fieldLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  chipRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  searchBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Detail modal
  detailBody:     { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 8 },
  detailMetaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  detailMeta:     { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  commentCard:    { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginBottom: 8 },
  commentBody:    { fontSize: 13, color: COLORS.text, lineHeight: 18, marginBottom: 5 },
  commentMeta:    { flexDirection: 'row', justifyContent: 'space-between' },
  commentAuthor:  { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  commentDate:    { fontSize: 11, color: COLORS.light },
  commentInputRow:{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
});
