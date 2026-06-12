import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';
import { Storage } from '../../storage';

// Exact values used by the web tasks dashboard / api/tasks.js
const VIEWS      = [{ value: 'mine', label: 'Mine' }, { value: 'created', label: 'Created' }, { value: 'all', label: 'All' }];
const STATUSES   = ['All', 'Pending', 'Completed'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

const PRIORITY_COLORS = {
  urgent: { bg: '#fee2e2', text: '#991b1b' },
  high:   { bg: '#fef3c7', text: '#92400e' },
  normal: { bg: '#e0f2fe', text: '#0369a1' },
  low:    { bg: '#f1f5f9', text: '#475569' },
};
function priorityColor(p) { return PRIORITY_COLORS[(p || 'normal').toLowerCase()] || PRIORITY_COLORS.normal; }
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
async function getStaffUser() {
  try {
    const raw = await Storage.get('staff_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// ── Task card ──────────────────────────────────────────────────────────────────
function TaskCard({ item, onOpen }) {
  const pc = priorityColor(item.priority);
  const completed = item.status === 'Completed';
  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={[s.taskTitle, completed && { textDecorationLine: 'line-through', color: COLORS.muted }]} numberOfLines={2}>
          {item.title || '—'}
        </Text>
        <View style={[s.badge, { backgroundColor: pc.bg }]}>
          <Text style={[s.badgeText, { color: pc.text }]}>{(item.priority || 'Normal').toUpperCase()}</Text>
        </View>
      </View>
      <View style={s.cardBottom}>
        {item.merchants?.dba_name ? <Text style={s.meta}>🏪 {item.merchants.dba_name}</Text> : null}
        <Text style={s.meta}>👤 {item.assigned_to_name || 'Unassigned'}</Text>
        <Text style={[s.meta, completed ? { color: COLORS.success } : item.is_overdue ? { color: COLORS.danger } : null]}>
          {completed ? '✅ Completed' : item.is_overdue ? '⚠️ Overdue' : '🕓 Pending'}
        </Text>
        {item.due_date ? <Text style={s.date}>Due {formatDate(item.due_date)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Create task modal ──────────────────────────────────────────────────────────
function CreateModal({ visible, staffList, me, onClose, onCreated }) {
  const [title, setTitle]           = useState('');
  const [body, setBody]             = useState('');
  const [priority, setPriority]     = useState('Normal');
  const [dueDate, setDueDate]       = useState('');
  const [assignee, setAssignee]     = useState(null); // { id, full_name }
  const [showAssign, setShowAssign] = useState(false);
  const [saving, setSaving]         = useState(false);
  // merchant search (create_task requires merchant_id)
  const [merchantQ, setMerchantQ]               = useState('');
  const [merchantResults, setMerchantResults]   = useState([]);
  const [merchant, setMerchant]                 = useState(null); // { id, dba_name, merchant_id }
  const [searchingM, setSearchingM]             = useState(false);
  const searchTimer = useRef(null);

  function reset() {
    setTitle(''); setBody(''); setPriority('Normal'); setDueDate('');
    setAssignee(null); setShowAssign(false);
    setMerchantQ(''); setMerchantResults([]); setMerchant(null);
  }

  function onMerchantQuery(q) {
    setMerchantQ(q);
    setMerchant(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q || q.trim().length < 2) { setMerchantResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchingM(true);
      try {
        // Same lookup the web dashboard uses: /api/merchants action 'list'
        const res = await staffRequest('/api/merchants', {
          action: 'list', query: q.trim(), filterBy: 'dba_name', page: 0, limit: 8,
        });
        setMerchantResults(res.data || []);
      } catch (e) { /* ignore */ }
      setSearchingM(false);
    }, 350);
  }

  async function submit() {
    if (!title.trim()) { Alert.alert('Required', 'Enter a title.'); return; }
    if (!merchant) { Alert.alert('Required', 'Select a merchant.'); return; }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    try {
      const res = await staffRequest('/api/tasks', {
        action: 'create_task',
        userid: me?.userid,
        staff_name: me?.name,
        title: title.trim(),
        body: body.trim() || null,
        merchant_id: merchant.id,
        assigned_to: assignee?.id || me?.userid,
        due_date: dueDate.trim() || null,
        priority,
      });
      if (res.success) { reset(); onCreated(); }
      else Alert.alert('Error', res.message || 'Could not create task.');
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not create task.');
    }
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Task</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={s.fieldLabel}>Title *</Text>
              <TextInput style={s.input} placeholder="What needs to be done?" placeholderTextColor={COLORS.light} value={title} onChangeText={setTitle} />

              <Text style={s.fieldLabel}>Merchant *</Text>
              {merchant ? (
                <TouchableOpacity style={[s.input, { flexDirection: 'row', justifyContent: 'space-between' }]} onPress={() => { setMerchant(null); setMerchantQ(''); }}>
                  <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: '700' }}>🏪 {merchant.dba_name}</Text>
                  <Text style={{ fontSize: 14, color: COLORS.muted }}>✕</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TextInput style={s.input} placeholder="Search by DBA name…" placeholderTextColor={COLORS.light} value={merchantQ} onChangeText={onMerchantQuery} />
                  {searchingM ? <ActivityIndicator color={COLORS.primary} style={{ margin: 8 }} /> : null}
                  {merchantResults.map(m => (
                    <TouchableOpacity key={m.id} style={s.resultRow} onPress={() => { setMerchant(m); setMerchantResults([]); }}>
                      <Text style={s.resultName}>{m.dba_name}</Text>
                      <Text style={s.resultSub}>{m.merchant_id}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <Text style={s.fieldLabel}>Description</Text>
              <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Details (optional)" placeholderTextColor={COLORS.light} value={body} onChangeText={setBody} multiline />

              <Text style={s.fieldLabel}>Assignee</Text>
              <TouchableOpacity style={s.input} onPress={() => setShowAssign(v => !v)}>
                <Text style={{ fontSize: 14, color: COLORS.text }}>
                  {assignee ? assignee.full_name : `${me?.name || 'Me'} (me)`} {showAssign ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              {showAssign && (
                <View style={s.assignList}>
                  {staffList.map(u => (
                    <TouchableOpacity key={u.id} style={s.assignRow} onPress={() => { setAssignee(u); setShowAssign(false); }}>
                      <Text style={s.assignText}>{u.full_name}{u.id === me?.userid ? ' (me)' : ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={s.fieldLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput style={s.input} placeholder="2026-06-30" placeholderTextColor={COLORS.light} value={dueDate} onChangeText={setDueDate} autoCapitalize="none" />

              <Text style={s.fieldLabel}>Priority</Text>
              <View style={s.chipRow}>
                {PRIORITIES.map(p => {
                  const pc = priorityColor(p);
                  const active = priority === p;
                  return (
                    <TouchableOpacity key={p} style={[s.chip, active && { backgroundColor: pc.bg, borderColor: pc.text }]} onPress={() => setPriority(p)}>
                      <Text style={[s.chipText, active && { color: pc.text }]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Create Task</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
function DetailModal({ task, me, onClose, onChanged }) {
  const [comments, setComments]       = useState([]);
  const [loadingC, setLoadingC]       = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting]         = useState(false);
  const [working, setWorking]         = useState(false);

  const loadComments = useCallback(async () => {
    if (!task?.id) return;
    setLoadingC(true);
    try {
      const res = await staffRequest('/api/tasks', { action: 'get_comments', task_id: task.id, userid: me?.userid });
      setComments(res.data || []);
    } catch (e) { /* ignore */ }
    setLoadingC(false);
  }, [task?.id, me?.userid]);

  useEffect(() => { loadComments(); }, [loadComments]);

  if (!task) return null;
  const pc = priorityColor(task.priority);
  const completed = task.status === 'Completed';

  async function setStatus(newStatus) {
    if (working) return;
    setWorking(true);
    try {
      const res = await staffRequest('/api/tasks', {
        action: 'update_task',
        userid: me?.userid,
        staff_name: me?.name,
        task_id: task.id,
        payload: { status: newStatus },
      });
      if (res.success) { onChanged(); onClose(); }
      else Alert.alert('Error', res.message || 'Could not update task.');
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not update task.');
    }
    setWorking(false);
  }

  function confirmDelete() {
    Alert.alert('Delete Task', `Delete "${task.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const res = await staffRequest('/api/tasks', { action: 'delete_task', task_id: task.id, userid: me?.userid });
            if (res.success) { onChanged(); onClose(); }
            else Alert.alert('Error', res.message || 'Could not delete task.');
          } catch (e) {
            if (!e?.sessionExpired) Alert.alert('Error', 'Could not delete task.');
          }
        },
      },
    ]);
  }

  async function postComment() {
    const body = commentText.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await staffRequest('/api/tasks', { action: 'add_comment', task_id: task.id, body, userid: me?.userid });
      if (res.success) { setCommentText(''); loadComments(); }
      else Alert.alert('Error', res.message || 'Could not post comment.');
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not post comment.');
    }
    setPosting(false);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>{task.title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <View style={[s.badge, { backgroundColor: pc.bg }]}>
                  <Text style={[s.badgeText, { color: pc.text }]}>{(task.priority || 'Normal').toUpperCase()}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: completed ? '#d1fae5' : '#fef3c7' }]}>
                  <Text style={[s.badgeText, { color: completed ? '#059669' : '#d97706' }]}>{(task.status || 'Pending').toUpperCase()}</Text>
                </View>
                {task.is_overdue ? (
                  <View style={[s.badge, { backgroundColor: '#fee2e2' }]}>
                    <Text style={[s.badgeText, { color: COLORS.danger }]}>OVERDUE</Text>
                  </View>
                ) : null}
              </View>

              {task.body ? <Text style={s.detailBody}>{task.body}</Text> : null}

              <View style={s.infoCard}>
                {task.merchants?.dba_name ? <Text style={s.infoLine}>🏪 {task.merchants.dba_name} <Text style={s.infoSub}>{task.merchants.merchant_id || ''}</Text></Text> : null}
                <Text style={s.infoSub}>Assigned to: {task.assigned_to_name || 'Unassigned'}</Text>
                <Text style={s.infoSub}>Created by: {task.created_by_name || 'Unknown'}</Text>
                {task.due_date ? <Text style={s.infoSub}>Due: {formatDate(task.due_date)}</Text> : null}
                {task.created_at ? <Text style={s.infoSub}>Created: {formatDate(task.created_at)}</Text> : null}
                {task.notes ? <Text style={[s.infoSub, { marginTop: 6 }]}>📝 {task.notes}</Text> : null}
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {completed ? (
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.warning }]} onPress={() => setStatus('Pending')} disabled={working}>
                    <Text style={s.actionBtnText}>↩️ Reopen (Pending)</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => setStatus('Completed')} disabled={working}>
                    <Text style={s.actionBtnText}>✅ Mark Completed</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.danger }]} onPress={confirmDelete} disabled={working}>
                  <Text style={s.actionBtnText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.fieldLabel}>Comments</Text>
              {loadingC
                ? <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} />
                : comments.length === 0
                  ? <Text style={s.emptySmall}>No comments yet</Text>
                  : comments.map((c, i) => (
                      <View key={c.id || i} style={s.commentCard}>
                        <Text style={s.commentBody}>{c.body}</Text>
                        <View style={s.commentMeta}>
                          <Text style={s.commentAuthor}>{c.author_name || 'Unknown'}</Text>
                          <Text style={s.commentDate}>{formatDate(c.created_at)}</Text>
                        </View>
                      </View>
                    ))
              }
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
                  style={[s.postBtn, (!commentText.trim() || posting) && { opacity: 0.5 }]}
                  onPress={postComment}
                  disabled={!commentText.trim() || posting}
                >
                  {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.postBtnText}>Post</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen (stack — native header provides the title) ──────────────────────────
export default function StaffTasksScreen() {
  const [tasks, setTasks]           = useState([]);
  const [stats, setStats]           = useState(null);
  const [staffList, setStaffList]   = useState([]);
  const [me, setMe]                 = useState(null); // { userid, name }
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView]             = useState('mine');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected]     = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async (user, v, st) => {
    if (!user?.userid) return;
    setLoading(true);
    try {
      const body = {
        action: 'get_tasks',
        userid: user.userid,
        view: v,
        page: 0,
        limit: 100,
      };
      if (st && st !== 'All') body.status = st;
      const [tasksRes, statsRes] = await Promise.all([
        staffRequest('/api/tasks', body),
        staffRequest('/api/tasks', { action: 'get_stats', userid: user.userid }),
      ]);
      setTasks(tasksRes.data || []);
      if (statsRes.success) setStats({ mine: statsRes.mine || 0, overdue: statsRes.overdue || 0, all: statsRes.all || 0 });
    } catch (e) { /* sessionExpired — fail quietly */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    getStaffUser().then(u => {
      const user = u ? { userid: u.userid, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Staff' } : null;
      setMe(user);
      if (user) load(user, 'mine', 'All');
    });
    staffRequest('/api/tasks', { action: 'get_staff' })
      .then(res => setStaffList(res.data || []))
      .catch(() => {});
  }, [load]);

  function changeView(v) { setView(v); load(me, v, statusFilter); }
  function changeStatus(st) { setStatusFilter(st); load(me, view, st); }

  return (
    <View style={s.root}>
      {/* Stats header (from get_stats) */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statNum}>{stats ? stats.mine : '—'}</Text>
          <Text style={s.statLabel}>My Pending</Text>
        </View>
        <View style={s.statBox}>
          <Text style={[s.statNum, stats?.overdue > 0 && { color: COLORS.danger }]}>{stats ? stats.overdue : '—'}</Text>
          <Text style={s.statLabel}>Overdue</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>{stats ? stats.all : '—'}</Text>
          <Text style={s.statLabel}>All Pending</Text>
        </View>
      </View>

      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
          {VIEWS.map(v => (
            <TouchableOpacity key={v.value} style={[s.chip, view === v.value && s.chipActive]} onPress={() => changeView(v.value)}>
              <Text style={[s.chipText, view === v.value && s.chipTextActive]}>{v.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={s.chipSep} />
          {STATUSES.map(st => (
            <TouchableOpacity key={st} style={[s.chip, statusFilter === st && s.chipActive]} onPress={() => changeStatus(st)}>
              <Text style={[s.chipText, statusFilter === st && s.chipTextActive]}>{st}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <TaskCard item={item} onOpen={setSelected} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(me, view, statusFilter); }} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No tasks found</Text> : null}
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={s.fabText}>＋</Text>
      </TouchableOpacity>

      <CreateModal
        visible={showCreate}
        staffList={staffList}
        me={me}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(me, view, statusFilter); }}
      />
      {selected ? (
        <DetailModal task={selected} me={me} onClose={() => setSelected(null)} onChanged={() => load(me, view, statusFilter)} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  statsRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  statBox:     { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statNum:     { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  statLabel:   { fontSize: 10, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  filterRow:   { paddingVertical: 10 },
  chipSep:     { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },
  list:        { paddingHorizontal: 12, paddingBottom: 90 },
  card:        { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  taskTitle:   { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  badge:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 10, fontWeight: '800' },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta:        { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  date:        { fontSize: 11, color: COLORS.light, marginLeft: 'auto' },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  emptySmall:  { color: COLORS.muted, fontSize: 12, marginBottom: 8 },
  fab:         { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 5 },
  fabText:     { color: '#fff', fontSize: 26, fontWeight: '700', lineHeight: 30 },
  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:  { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.text },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  fieldLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  chipRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  resultRow:   { backgroundColor: COLORS.bg, borderRadius: 8, padding: 10, marginBottom: 4 },
  resultName:  { fontSize: 13, fontWeight: '700', color: COLORS.text },
  resultSub:   { fontSize: 11, color: COLORS.muted, fontFamily: 'monospace' },
  assignList:  { backgroundColor: COLORS.bg, borderRadius: 10, padding: 8, marginBottom: 4 },
  assignRow:   { paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  assignText:  { fontSize: 13, fontWeight: '600', color: COLORS.text },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  actionBtn:   { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  detailBody:  { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 10 },
  infoCard:    { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12 },
  infoLine:    { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  infoSub:     { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  commentCard: { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginBottom: 8 },
  commentBody: { fontSize: 13, color: COLORS.text, lineHeight: 18, marginBottom: 5 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  commentAuthor: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  commentDate: { fontSize: 11, color: COLORS.light },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
  postBtn:     { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  postBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
