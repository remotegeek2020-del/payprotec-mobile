import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
  FlatList, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Merchants } from '../api';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d < new Date();
}

// ── Info tab sub-components ────────────────────────────────────────────────────

function Row({ label, value, onPress }) {
  if (!value) return null;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Text style={[s.rowValue, onPress && { color: COLORS.primary, textDecorationLine: 'underline' }]}>
          {value}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

// ── Info tab ───────────────────────────────────────────────────────────────────

function InfoTab({ merchant: m }) {
  const location = [m.merchant_address, m.merchant_city, m.merchant_state, m.merchant_zip]
    .filter(Boolean)
    .join(', ');

  return (
    <ScrollView style={s.tabContent} contentContainerStyle={s.tabContentInner}>
      <Section title="Business Info">
        <Row label="Legal Name" value={m.legal_name} />
        <Row label="MID"        value={m.merchant_id} />
        <Row label="Status"     value={m.status} />
        <Row label="Agent"      value={m.agent_name} />
      </Section>

      <Section title="Contact">
        <Row
          label="Phone"
          value={m.merchant_phone}
          onPress={m.merchant_phone ? () => Linking.openURL(`tel:${m.merchant_phone}`) : undefined}
        />
        <Row
          label="Email"
          value={m.email}
          onPress={m.email ? () => Linking.openURL(`mailto:${m.email}`) : undefined}
        />
      </Section>

      <Section title="Location">
        <Row label="Address" value={location || null} />
        <Row label="Country" value={m.merchant_country} />
      </Section>
    </ScrollView>
  );
}

// ── Notes tab ──────────────────────────────────────────────────────────────────

function NoteCard({ note }) {
  const isSystem = note.type === 'system';
  const author   = note.user_name || note.created_by_name || 'Unknown';
  const date     = formatDate(note.created_at);

  return (
    <View style={[s.noteCard, isSystem && s.noteCardSystem]}>
      <Text style={[s.noteContent, isSystem && s.noteContentSystem]}>{note.content || note.note || ''}</Text>
      <View style={s.noteMeta}>
        <Text style={s.noteAuthor}>{author}</Text>
        {date ? <Text style={s.noteDate}>{date}</Text> : null}
      </View>
    </View>
  );
}

function NotesTab({ merchantId }) {
  const [notes, setNotes]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [loaded, setLoaded]         = useState(false);
  const [showInput, setShowInput]   = useState(false);
  const [noteText, setNoteText]     = useState('');
  const [posting, setPosting]       = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoading(true);
      Merchants.getNotes(merchantId)
        .then(data => {
          setNotes(data.data || data.notes || []);
          setLoaded(true);
        })
        .catch(() => setLoaded(true))
        .finally(() => setLoading(false));
    }
  }, [merchantId, loaded]);

  async function submitNote() {
    const content = noteText.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const res = await Merchants.addNote(merchantId, content);
      const newNote = res.note || res.data || { content, created_at: new Date().toISOString() };
      setNotes(prev => [newNote, ...prev]);
      setNoteText('');
      setShowInput(false);
    } catch {}
    setPosting(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={120}
    >
      <View style={s.tabContent}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item, i) => String(item.id || item.note_id || i)}
            renderItem={({ item }) => <NoteCard note={item} />}
            contentContainerStyle={s.notesList}
            ListEmptyComponent={
              <Text style={s.empty}>No notes yet</Text>
            }
            ListFooterComponent={
              showInput ? (
                <View style={s.noteInputContainer}>
                  <TextInput
                    style={s.noteInput}
                    placeholder="Write a note…"
                    placeholderTextColor={COLORS.light}
                    value={noteText}
                    onChangeText={setNoteText}
                    multiline
                    autoFocus
                  />
                  <View style={s.noteInputActions}>
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => { setShowInput(false); setNoteText(''); }}
                    >
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.postBtn, (!noteText.trim() || posting) && s.postBtnDisabled]}
                      onPress={submitNote}
                      disabled={!noteText.trim() || posting}
                    >
                      {posting
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.postBtnText}>Post</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {!showInput ? (
          <TouchableOpacity style={s.addNoteBtn} onPress={() => setShowInput(true)}>
            <Text style={s.addNoteBtnText}>+ Add Note</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Tasks tab ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS = {
  high:   { bg: '#fee2e2', text: COLORS.danger },
  medium: { bg: '#fef3c7', text: COLORS.warning },
  low:    { bg: '#d1fae5', text: COLORS.success },
};

const STATUS_COLORS = {
  pending:   { bg: '#dbeafe', text: COLORS.primary },
  completed: { bg: '#d1fae5', text: COLORS.success },
};

function MiniTaskCard({ item }) {
  const priority  = (item.priority || 'medium').toLowerCase();
  const status    = (item.status   || 'pending').toLowerCase();
  const priorityC = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  const statusC   = STATUS_COLORS[status]     || STATUS_COLORS.pending;
  const overdue   = status !== 'completed' && isOverdue(item.due_date);

  return (
    <View style={s.taskCard}>
      <View style={s.taskCardTop}>
        <Text style={s.taskTitle} numberOfLines={2}>{item.title || '—'}</Text>
        <View style={{ flexDirection: 'row', gap: 5, flexShrink: 0, marginLeft: 8 }}>
          <View style={[s.badge, { backgroundColor: priorityC.bg }]}>
            <Text style={[s.badgeText, { color: priorityC.text }]}>{priority.toUpperCase()}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: statusC.bg }]}>
            <Text style={[s.badgeText, { color: statusC.text }]}>{status.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <View style={s.taskCardBottom}>
        {item.due_date ? (
          <Text style={[s.taskDue, overdue && s.taskDueOverdue]}>
            {overdue ? 'Overdue: ' : 'Due: '}{formatDate(item.due_date)}
          </Text>
        ) : null}
        {item.assignee_name ? (
          <Text style={s.taskAssignee}>{item.assignee_name}</Text>
        ) : null}
      </View>
    </View>
  );
}

function TasksTab({ merchantId }) {
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoading(true);
      Merchants.getMerchantTasks(merchantId)
        .then(data => {
          setTasks(data.data || data.tasks || []);
          setLoaded(true);
        })
        .catch(() => setLoaded(true))
        .finally(() => setLoading(false));
    }
  }, [merchantId, loaded]);

  if (loading) {
    return <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />;
  }

  return (
    <FlatList
      data={tasks}
      keyExtractor={(item, i) => String(item.id || item.task_id || i)}
      renderItem={({ item }) => <MiniTaskCard item={item} />}
      contentContainerStyle={s.tasksList}
      ListEmptyComponent={
        !loading ? <Text style={s.empty}>No tasks for this merchant</Text> : null
      }
    />
  );
}

// ── MerchantDetailScreen ───────────────────────────────────────────────────────

const TABS = ['Info', 'Notes', 'Tasks'];

export default function MerchantDetailScreen({ route }) {
  const m          = route.params?.merchant || {};
  const merchantId = m.merchant_id || m.id;
  const [activeTab, setActiveTab] = useState('Info');

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(m.dba_name || '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{m.dba_name || '—'}</Text>
        <Text style={s.mid}>{m.merchant_id || ''}</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'Info'  && <InfoTab  merchant={m} />}
        {activeTab === 'Notes' && <NotesTab merchantId={merchantId} />}
        {activeTab === 'Tasks' && <TasksTab merchantId={merchantId} />}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header:       { backgroundColor: COLORS.primaryDk, padding: 28, alignItems: 'center', paddingTop: 36 },
  avatar:       { width: 64, height: 64, borderRadius: 16, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:   { color: COLORS.primaryDk, fontSize: 28, fontWeight: '900' },
  name:         { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  mid:          { color: 'rgba(255,255,255,.5)', fontSize: 12, fontFamily: 'monospace', marginTop: 4 },

  // Tab bar
  tabBar:       { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabBtnText:   { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  tabBtnTextActive: { color: COLORS.primary },

  // Info tab
  tabContent:      { flex: 1 },
  tabContentInner: { paddingBottom: 40 },
  section:      { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  sectionCard:  { backgroundColor: COLORS.card, borderRadius: 12, overflow: 'hidden' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel:     { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  rowValue:     { fontSize: 13, color: COLORS.text, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },

  // Notes tab
  notesList:    { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 20 },
  noteCard:     { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  noteCardSystem: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border },
  noteContent:  { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 8 },
  noteContentSystem: { color: COLORS.muted, fontSize: 13 },
  noteMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteAuthor:   { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  noteDate:     { fontSize: 11, color: COLORS.light },

  noteInputContainer: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginHorizontal: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  noteInput:    { fontSize: 14, color: COLORS.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10 },
  noteInputActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  postBtn:      { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.primary, minWidth: 64, alignItems: 'center' },
  postBtnDisabled: { backgroundColor: COLORS.light },
  postBtnText:  { fontSize: 13, fontWeight: '800', color: '#fff' },

  addNoteBtn:   { margin: 14, marginTop: 4, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addNoteBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Tasks tab
  tasksList:    { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 30 },
  taskCard:     { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  taskCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  taskTitle:    { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  badge:        { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 9, fontWeight: '800' },
  taskCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskDue:      { fontSize: 11, color: COLORS.muted },
  taskDueOverdue: { color: COLORS.danger, fontWeight: '700' },
  taskAssignee: { fontSize: 11, color: COLORS.light },

  empty:        { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
});
