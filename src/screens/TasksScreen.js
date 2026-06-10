import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Tasks, Merchants } from '../api';
import DatePickerModal from '../components/DatePickerModal';

const PRIORITIES = ['Low', 'Normal', 'High'];

const PRIORITY_COLORS = {
  high:   { bg: '#fee2e2', text: '#dc2626' },
  normal: { bg: '#fef3c7', text: '#d97706' },
  medium: { bg: '#fef3c7', text: '#d97706' },
  low:    { bg: '#d1fae5', text: '#059669' },
};

const STATUS_COLORS = {
  pending:   { bg: '#dbeafe', text: '#004990' },
  completed: { bg: '#d1fae5', text: '#059669' },
};

function priorityColor(priority) {
  return PRIORITY_COLORS[(priority || '').toLowerCase()] || PRIORITY_COLORS.normal;
}

function statusColor(status) {
  return STATUS_COLORS[(status || '').toLowerCase()] || STATUS_COLORS.pending;
}

function isCompleted(status) {
  return (status || '').toLowerCase() === 'completed';
}

function isOverdue(dueDateStr) {
  if (!dueDateStr) return false;
  return new Date(dueDateStr) < new Date();
}

function formatDate(dueDateStr) {
  if (!dueDateStr) return null;
  const d = new Date(dueDateStr);
  if (isNaN(d.getTime())) return dueDateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Task card ──────────────────────────────────────────────────────────────────

function TaskCard({ item, onToggle, onOpen }) {
  const done    = isCompleted(item.status);
  const overdue = isOverdue(item.due_date) && !done;
  const pc = priorityColor(item.priority);
  const sc = statusColor(item.status);
  const merchantName = item.merchants?.dba_name || item.merchant_name;

  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <TouchableOpacity
          style={[s.checkCircle, done && s.checkCircleDone]}
          onPress={() => onToggle(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {done ? <Text style={s.checkMark}>✓</Text> : null}
        </TouchableOpacity>
        <Text style={[s.taskTitle, done && s.taskTitleDone]} numberOfLines={2}>{item.title || '—'}</Text>
        <View style={[s.badge, { backgroundColor: sc.bg }]}>
          <Text style={[s.badgeText, { color: sc.text }]}>
            {(item.status || 'Pending').toUpperCase()}
          </Text>
        </View>
      </View>

      {merchantName ? (
        <Text style={s.merchantName} numberOfLines={1}>{merchantName}</Text>
      ) : null}

      <View style={s.cardBottom}>
        <View style={[s.badge, { backgroundColor: pc.bg }]}>
          <Text style={[s.badgeText, { color: pc.text }]}>
            {(item.priority || 'Normal').toUpperCase()}
          </Text>
        </View>

        {item.due_date ? (
          <View style={s.dueDateRow}>
            {overdue ? <Text style={s.overdueIcon}>⚠️</Text> : null}
            <Text style={[s.dueDate, overdue && s.dueDateOverdue]}>
              {formatDate(item.due_date)}
            </Text>
          </View>
        ) : null}

        {item.assigned_to_name ? (
          <Text style={s.assignee} numberOfLines={1}>{item.assigned_to_name}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Create task modal ──────────────────────────────────────────────────────────

function CreateTaskModal({ visible, staff, onClose, onCreated }) {
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [priority, setPriority]   = useState('Normal');
  const [dueDate, setDueDate]     = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assignee, setAssignee]   = useState(null);
  const [merchantQuery, setMerchantQuery] = useState('');
  const [merchantResults, setMerchantResults] = useState([]);
  const [merchant, setMerchant]   = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving]       = useState(false);

  function reset() {
    setTitle(''); setBody(''); setPriority('Normal'); setDueDate('');
    setAssignee(null); setMerchantQuery(''); setMerchantResults([]); setMerchant(null);
  }

  async function searchMerchants() {
    const q = merchantQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const data = await Merchants.list(q, 1, 8);
      setMerchantResults(data.data || []);
    } catch {}
    setSearching(false);
  }

  async function submit() {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!merchant)     { Alert.alert('Required', 'Please link a merchant (search above).'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        merchant_id: merchant.id,
        priority,
      };
      if (body.trim())    payload.body = body.trim();
      if (dueDate.trim()) payload.due_date = dueDate.trim();
      if (assignee)       payload.assigned_to = assignee.id;
      const res = await Tasks.create(payload);
      if (res.success) {
        reset();
        onCreated();
      } else {
        Alert.alert('Error', res.error || res.message || 'Could not create task.');
      }
    } catch {
      Alert.alert('Error', 'Could not create task. Check your connection.');
    }
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Task</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={s.fieldLabel}>Title *</Text>
              <TextInput
                style={s.input}
                placeholder="What needs doing?"
                placeholderTextColor={COLORS.light}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={s.fieldLabel}>Merchant *</Text>
              {merchant ? (
                <View style={s.selectedRow}>
                  <Text style={s.selectedText} numberOfLines={1}>{merchant.dba_name} ({merchant.merchant_id})</Text>
                  <TouchableOpacity onPress={() => setMerchant(null)}>
                    <Text style={s.selectedClear}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={s.searchRow}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Search merchants…"
                      placeholderTextColor={COLORS.light}
                      value={merchantQuery}
                      onChangeText={setMerchantQuery}
                      onSubmitEditing={searchMerchants}
                      returnKeyType="search"
                    />
                    <TouchableOpacity style={s.searchBtn} onPress={searchMerchants}>
                      {searching
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.searchBtnText}>Search</Text>}
                    </TouchableOpacity>
                  </View>
                  {merchantResults.map(m => (
                    <TouchableOpacity key={m.id} style={s.resultRow} onPress={() => { setMerchant(m); setMerchantResults([]); }}>
                      <Text style={s.resultName} numberOfLines={1}>{m.dba_name}</Text>
                      <Text style={s.resultMid}>{m.merchant_id}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Details (optional)"
                placeholderTextColor={COLORS.light}
                value={body}
                onChangeText={setBody}
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

              <Text style={s.fieldLabel}>Due date</Text>
              <TouchableOpacity style={s.dateField} onPress={() => setShowDatePicker(true)}>
                <Text style={dueDate ? s.dateFieldText : s.dateFieldPlaceholder}>
                  {dueDate || 'Select a date…'}
                </Text>
                <Text style={s.dateFieldIcon}>📅</Text>
              </TouchableOpacity>
              <DatePickerModal
                visible={showDatePicker}
                value={dueDate}
                onSelect={setDueDate}
                onClose={() => setShowDatePicker(false)}
                title="Due Date"
              />

              {staff.length > 0 ? (
                <View>
                  <Text style={s.fieldLabel}>Assign to</Text>
                  <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                    {staff.map(u => {
                      const active = assignee?.id === u.id;
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[s.chip, active && s.chipActive]}
                          onPress={() => setAssignee(active ? null : u)}
                        >
                          <Text style={[s.chipText, active && s.chipTextActive]}>{u.full_name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

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

// ── Task detail modal ──────────────────────────────────────────────────────────

function TaskDetailModal({ task, onClose, onUpdated, onDeleted }) {
  const [comments, setComments]         = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [posting, setPosting]           = useState(false);
  const taskId = task?.id || task?.task_id;

  useEffect(() => {
    if (!taskId) return;
    setComments([]);
    setLoadingComments(true);
    Tasks.getComments(taskId)
      .then(data => setComments(data.data || []))
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, [taskId]);

  if (!task) return null;

  const done = isCompleted(task.status);
  const merchantName = task.merchants?.dba_name || task.merchant_name;

  async function changeField(field, value) {
    const prev = task[field];
    onUpdated({ ...task, [field]: value });
    try {
      const res = await Tasks.update(taskId, { [field]: value });
      if (!res.success) throw new Error();
    } catch {
      onUpdated({ ...task, [field]: prev });
      Alert.alert('Error', `Could not update ${field}.`);
    }
  }

  async function postComment() {
    const body = commentText.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await Tasks.addComment(taskId, body);
      if (res.success) {
        setCommentText('');
        const data = await Tasks.getComments(taskId);
        setComments(data.data || []);
      } else {
        Alert.alert('Error', res.error || 'Could not post comment.');
      }
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
    setPosting(false);
  }

  function confirmDelete() {
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const res = await Tasks.remove(taskId);
            if (res.success) onDeleted(taskId);
            else Alert.alert('Error', res.error || 'Could not delete task.');
          } catch {
            Alert.alert('Error', 'Could not delete task.');
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={!!task} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>{task.title || 'Task'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              {merchantName ? <Text style={s.detailMerchant}>{merchantName}</Text> : null}
              {task.body ? <Text style={s.detailBody}>{task.body}</Text> : null}

              <View style={s.detailMetaRow}>
                {task.due_date ? <Text style={s.detailMeta}>Due {formatDate(task.due_date)}</Text> : null}
                {task.assigned_to_name ? <Text style={s.detailMeta}>Assigned: {task.assigned_to_name}</Text> : null}
                {task.created_by_name ? <Text style={s.detailMeta}>By: {task.created_by_name}</Text> : null}
              </View>

              <Text style={s.fieldLabel}>Status</Text>
              <View style={s.chipRow}>
                {['Pending', 'Completed'].map(st => {
                  const active = (task.status || 'Pending').toLowerCase() === st.toLowerCase();
                  const sc = statusColor(st);
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[s.chip, active && { backgroundColor: sc.bg, borderColor: sc.text }]}
                      onPress={() => !active && changeField('status', st)}
                    >
                      <Text style={[s.chipText, active && { color: sc.text }]}>{st}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Priority</Text>
              <View style={s.chipRow}>
                {PRIORITIES.map(p => {
                  const active = (task.priority || 'Normal').toLowerCase() === p.toLowerCase();
                  const pc = priorityColor(p);
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[s.chip, active && { backgroundColor: pc.bg, borderColor: pc.text }]}
                      onPress={() => !active && changeField('priority', p)}
                    >
                      <Text style={[s.chipText, active && { color: pc.text }]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Comments</Text>
              {loadingComments ? (
                <ActivityIndicator color={COLORS.primary} style={{ margin: 12 }} />
              ) : comments.length === 0 ? (
                <Text style={s.emptySmall}>No comments yet</Text>
              ) : (
                comments.map(c => (
                  <View key={c.id} style={s.commentCard}>
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

              <TouchableOpacity
                style={[s.primaryBtn, done && { backgroundColor: COLORS.muted }]}
                onPress={() => changeField('status', done ? 'Pending' : 'Completed')}
              >
                <Text style={s.primaryBtnText}>{done ? 'Reopen Task' : 'Mark Completed'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete}>
                <Text style={s.deleteBtnText}>Delete Task</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const [view, setView]           = useState('mine');
  const [tasks, setTasks]         = useState([]);
  const [stats, setStats]         = useState({ myPending: '—', overdue: '—', allPending: '—' });
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]           = useState(0); // 0-based, per backend
  const [total, setTotal]         = useState(0);
  const [staff, setStaff]         = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]   = useState(null);
  const PAGE = 20;

  async function loadStats() {
    try {
      const data = await Tasks.stats();
      if (data?.success) {
        setStats({
          myPending:  data.mine    ?? '—',
          overdue:    data.overdue ?? '—',
          allPending: data.all     ?? '—',
        });
      }
    } catch {}
  }

  async function loadStaff() {
    try {
      const data = await Tasks.getStaff();
      if (data?.success) setStaff(data.data || []);
    } catch {}
  }

  async function load(v = view, p = 0, append = false) {
    setLoading(true);
    try {
      const data = await Tasks.list({ view: v, page: p, limit: PAGE });
      const rows = data.data || [];
      setTasks(prev => (append ? [...prev, ...rows] : rows));
      setTotal(data.count ?? 0);
      setPage(p);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadStats();
    loadStaff();
    load(view, 0, false);
  }, []);

  function switchView(v) {
    setView(v);
    load(v, 0, false);
  }

  function onRefresh() {
    setRefreshing(true);
    loadStats();
    load(view, 0, false);
  }

  function loadMore() {
    if (tasks.length < total && !loading) {
      load(view, page + 1, true);
    }
  }

  async function handleToggle(item) {
    const newStatus = isCompleted(item.status) ? 'Pending' : 'Completed';
    const taskId = item.id || item.task_id;

    // Optimistic update
    setTasks(prev =>
      prev.map(t => (t.id || t.task_id) === taskId ? { ...t, status: newStatus } : t)
    );

    try {
      const res = await Tasks.update(taskId, { status: newStatus });
      if (!res.success) throw new Error();
      loadStats();
    } catch {
      // Revert on failure
      setTasks(prev =>
        prev.map(t => (t.id || t.task_id) === taskId ? { ...t, status: item.status } : t)
      );
    }
  }

  function handleUpdated(updatedTask) {
    const taskId = updatedTask.id || updatedTask.task_id;
    setSelected(updatedTask);
    setTasks(prev =>
      prev.map(t => (t.id || t.task_id) === taskId ? { ...t, ...updatedTask } : t)
    );
    loadStats();
  }

  function handleDeleted(taskId) {
    setSelected(null);
    setTasks(prev => prev.filter(t => (t.id || t.task_id) !== taskId));
    setTotal(t => Math.max(0, t - 1));
    loadStats();
  }

  function handleCreated() {
    setShowCreate(false);
    loadStats();
    load(view, 0, false);
  }

  return (
    <View style={s.container}>
      {/* Stats row */}
      <View style={s.metricsRow}>
        <View style={[s.metric, { borderLeftColor: COLORS.primary }]}>
          <Text style={[s.metricNum, { color: COLORS.primary }]}>{stats.myPending}</Text>
          <Text style={s.metricLabel}>My Pending</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.danger }]}>
          <Text style={[s.metricNum, { color: COLORS.danger }]}>{stats.overdue}</Text>
          <Text style={s.metricLabel}>Overdue</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.muted }]}>
          <Text style={[s.metricNum, { color: COLORS.muted }]}>{stats.allPending}</Text>
          <Text style={s.metricLabel}>All Pending</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, view === 'mine' && s.tabActive]}
          onPress={() => switchView('mine')}
        >
          <Text style={[s.tabText, view === 'mine' && s.tabTextActive]}>My Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, view === 'all' && s.tabActive]}
          onPress={() => switchView('all')}
        >
          <Text style={[s.tabText, view === 'all' && s.tabTextActive]}>All Tasks</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={item => String(item.id || item.task_id)}
        renderItem={({ item }) => (
          <TaskCard item={item} onToggle={handleToggle} onOpen={setSelected} />
        )}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading && !refreshing
            ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} />
            : null
        }
        ListEmptyComponent={
          !loading
            ? <Text style={s.empty}>No tasks found</Text>
            : null
        }
      />

      {/* Floating add button */}
      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={s.fabText}>＋</Text>
      </TouchableOpacity>

      <CreateTaskModal
        visible={showCreate}
        staff={staff}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />

      <TaskDetailModal
        task={selected}
        onClose={() => setSelected(null)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },
  metricsRow:     { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 4 },
  metric:         { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  metricNum:      { fontSize: 22, fontWeight: '900' },
  metricLabel:    { fontSize: 10, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  tabs:           { flexDirection: 'row', marginHorizontal: 14, marginTop: 10, marginBottom: 2, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  tab:            { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:      { backgroundColor: COLORS.primary },
  tabText:        { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  tabTextActive:  { color: '#fff' },
  list:           { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 },
  card:           { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  checkCircle:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.light, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkCircleDone:{ backgroundColor: COLORS.success, borderColor: COLORS.success },
  checkMark:      { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  taskTitle:      { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  taskTitleDone:  { textDecorationLine: 'line-through', color: COLORS.muted },
  badge:          { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:      { fontSize: 10, fontWeight: '800' },
  merchantName:   { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginBottom: 8, marginLeft: 30 },
  cardBottom:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 30 },
  dueDateRow:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  overdueIcon:    { fontSize: 11 },
  dueDate:        { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  dueDateOverdue: { color: COLORS.danger },
  assignee:       { fontSize: 11, color: COLORS.light, marginLeft: 'auto' },
  empty:          { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  emptySmall:     { color: COLORS.muted, fontSize: 12, marginBottom: 8 },

  // FAB
  fab:            { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabText:        { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 32 },

  // Modal shared
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalWrap:      { width: '100%' },
  modalCard:      { backgroundColor: COLORS.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '88%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:     { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalClose:     { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  fieldLabel:     { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input:          { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  chipRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:           { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },
  searchRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBtn:      { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  searchBtnText:  { color: '#fff', fontSize: 13, fontWeight: '800' },
  resultRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resultName:     { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  resultMid:      { fontSize: 11, color: COLORS.muted, fontFamily: 'monospace', marginLeft: 8 },
  selectedRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 10, padding: 12 },
  selectedText:   { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.primary },
  selectedClear:  { fontSize: 12, fontWeight: '700', color: COLORS.danger, marginLeft: 10 },
  primaryBtn:     { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  deleteBtn:      { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  deleteBtnText:  { color: COLORS.danger, fontSize: 13, fontWeight: '700' },

  // Detail modal
  detailMerchant: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 6 },
  detailBody:     { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 8 },
  detailMetaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailMeta:     { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  commentCard:    { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginBottom: 8 },
  commentBody:    { fontSize: 13, color: COLORS.text, lineHeight: 18, marginBottom: 5 },
  commentMeta:    { flexDirection: 'row', justifyContent: 'space-between' },
  commentAuthor:  { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  commentDate:    { fontSize: 11, color: COLORS.light },
  commentInputRow:{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
  dateField:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 14, backgroundColor: '#fff' },
  dateFieldText:      { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  dateFieldPlaceholder: { fontSize: 14, color: COLORS.light },
  dateFieldIcon:      { fontSize: 16 },
});
