import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../config';
import { Tasks } from '../api';

const PRIORITY_COLORS = {
  high:   { bg: '#fee2e2', text: '#dc2626' },
  medium: { bg: '#fef3c7', text: '#d97706' },
  low:    { bg: '#d1fae5', text: '#059669' },
};

const STATUS_COLORS = {
  pending:   { bg: '#dbeafe', text: '#004990' },
  completed: { bg: '#d1fae5', text: '#059669' },
};

function priorityColor(priority) {
  return PRIORITY_COLORS[(priority || '').toLowerCase()] || PRIORITY_COLORS.low;
}

function statusColor(status) {
  return STATUS_COLORS[(status || '').toLowerCase()] || STATUS_COLORS.pending;
}

function isOverdue(dueDateStr) {
  if (!dueDateStr) return false;
  return new Date(dueDateStr) < new Date();
}

function formatDate(dueDateStr) {
  if (!dueDateStr) return null;
  const d = new Date(dueDateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function TaskCard({ item, onToggle }) {
  const overdue = isOverdue(item.due_date) && (item.status || '').toLowerCase() !== 'completed';
  const pc = priorityColor(item.priority);
  const sc = statusColor(item.status);

  return (
    <TouchableOpacity style={s.card} onPress={() => onToggle(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.taskTitle} numberOfLines={2}>{item.title || '—'}</Text>
        <View style={[s.badge, { backgroundColor: sc.bg }]}>
          <Text style={[s.badgeText, { color: sc.text }]}>
            {(item.status || 'pending').toUpperCase()}
          </Text>
        </View>
      </View>

      {item.merchant_name ? (
        <Text style={s.merchantName} numberOfLines={1}>{item.merchant_name}</Text>
      ) : null}

      <View style={s.cardBottom}>
        <View style={[s.badge, { backgroundColor: pc.bg }]}>
          <Text style={[s.badgeText, { color: pc.text }]}>
            {(item.priority || 'low').toUpperCase()}
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

        {item.assignee_name ? (
          <Text style={s.assignee} numberOfLines={1}>{item.assignee_name}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function TasksScreen() {
  const [view, setView]           = useState('mine');
  const [tasks, setTasks]         = useState([]);
  const [stats, setStats]         = useState({ myPending: '—', overdue: '—', allPending: '—' });
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const PAGE = 20;

  async function loadStats() {
    try {
      const data = await Tasks.stats();
      if (data) {
        setStats({
          myPending:  data.my_pending  ?? data.myPending  ?? '—',
          overdue:    data.overdue     ?? '—',
          allPending: data.all_pending ?? data.allPending ?? '—',
        });
      }
    } catch {}
  }

  async function load(v = view, p = 1, append = false) {
    setLoading(true);
    try {
      const data = await Tasks.list({ view: v, page: p, limit: PAGE });
      const rows = data.data || data.tasks || [];
      setTasks(append ? prev => [...prev, ...rows] : rows);
      setTotal(data.totalCount ?? data.count ?? 0);
      setPage(p);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadStats();
    load(view, 1, false);
  }, []);

  function switchView(v) {
    setView(v);
    load(v, 1, false);
  }

  function onRefresh() {
    setRefreshing(true);
    loadStats();
    load(view, 1, false);
  }

  function loadMore() {
    if (tasks.length < total && !loading) {
      load(view, page + 1, true);
    }
  }

  async function handleToggle(item) {
    const newStatus = (item.status || '').toLowerCase() === 'completed' ? 'pending' : 'completed';
    const taskId = item.id || item.task_id;

    // Optimistic update
    setTasks(prev =>
      prev.map(t => (t.id || t.task_id) === taskId ? { ...t, status: newStatus } : t)
    );

    try {
      await Tasks.update(taskId, { status: newStatus });
      loadStats();
    } catch {
      // Revert on failure
      setTasks(prev =>
        prev.map(t => (t.id || t.task_id) === taskId ? { ...t, status: item.status } : t)
      );
    }
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
        renderItem={({ item }) => <TaskCard item={item} onToggle={handleToggle} />}
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
  list:           { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30 },
  card:           { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  taskTitle:      { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  badge:          { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:      { fontSize: 10, fontWeight: '800' },
  merchantName:   { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginBottom: 8 },
  cardBottom:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dueDateRow:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  overdueIcon:    { fontSize: 11 },
  dueDate:        { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  dueDateOverdue: { color: COLORS.danger },
  assignee:       { fontSize: 11, color: COLORS.light, marginLeft: 'auto' },
  empty:          { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
});
