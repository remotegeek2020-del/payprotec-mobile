import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest, StaffAuth } from '../../staff-api';
import { withCache, OfflineBanner } from '../../offline';

const PAGE_SIZE = 20;

// ── API (api/merchants.js) ────────────────────────────────────────────────────
const Api = {
  // page is 0-based; query searches the column mapped by filterBy
  list: ({ page, query, statusFilter }) =>
    staffRequest('/api/merchants', {
      action: 'list',
      page,
      limit: PAGE_SIZE,
      query: query || '',
      filterBy: 'dba_name',
      statusFilter: statusFilter || '',
      sort_by: 'volume_30_day',
      sort_dir: 'desc',
    }),
  getStatsForFilter: () => staffRequest('/api/merchants', { action: 'get_stats_for_filter' }),
  getFullMerchant:   (merchant_uuid) => staffRequest('/api/merchants', { action: 'get_full_merchant', merchant_uuid }),
  getEquipment:      (merchant_uuid) => staffRequest('/api/merchants', { action: 'get_merchant_equipment', merchant_uuid }),
  getNotes:          (merchant_uuid) => staffRequest('/api/merchants', { action: 'get_notes', merchant_uuid, type: 'manual' }),
  addNote:           (merchant_uuid, title, body, created_by) =>
    staffRequest('/api/merchants', { action: 'add_note', merchant_uuid, title, body, created_by }),
  // get_merchant_history queries equipment_logs by merchant uuid
  getHistory:        (merchant_id) => staffRequest('/api/merchants', { action: 'get_merchant_history', merchant_id }),
};

const STATUS_FILTERS = ['', 'Approved', 'Pending', 'Enrollment', 'Closed', 'Declined', 'Collections', 'Withdrawn', 'Fraud'];

const STATUS_COLORS = {
  approved:    { bg: '#d1fae5', text: '#059669' },
  pending:     { bg: '#fef3c7', text: '#d97706' },
  enrollment:  { bg: '#dbeafe', text: '#1d4ed8' },
  declined:    { bg: '#fee2e2', text: '#dc2626' },
  closed:      { bg: '#f1f5f9', text: '#64748b' },
  collections: { bg: '#fce7f3', text: '#9d174d' },
  withdrawn:   { bg: '#f1f5f9', text: '#64748b' },
  fraud:       { bg: '#fee2e2', text: '#7f1d1d' },
};
function statusColor(status) {
  return STATUS_COLORS[(status || '').toLowerCase().split(' ')[0]] || STATUS_COLORS.pending;
}

function fmt(n) {
  if (n == null) return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Merchant card ──────────────────────────────────────────────────────────────
function MerchantCard({ item, onPress }) {
  const sc = statusColor(item.account_status);
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={s.cardTop}>
        <Text style={s.dba} numberOfLines={1}>{item.dba_name || '—'}</Text>
        <View style={[s.badge, { backgroundColor: sc.bg }]}>
          <Text style={[s.badgeText, { color: sc.text }]}>{(item.account_status || 'Pending').toUpperCase()}</Text>
        </View>
      </View>
      <View style={s.cardMid}>
        <Text style={s.mid}>MID: {item.merchant_id || '—'}</Text>
        {item.merchant_city ? (
          <Text style={s.meta}>{item.merchant_city}{item.merchant_state ? `, ${item.merchant_state}` : ''}</Text>
        ) : null}
      </View>
      {item.partner_name && item.partner_name !== '---' ? (
        <Text style={s.agentLine}>🤝 {item.partner_name}{item.agent_id ? ` (${item.agent_id})` : ''}</Text>
      ) : item.agent_id ? (
        <Text style={s.agentLine}>🤝 {item.agent_id}</Text>
      ) : null}
      <View style={s.cardBottom}>
        <View style={s.volItem}>
          <Text style={s.volLabel}>30D</Text>
          <Text style={s.volValue}>{fmt(item.volume_30_day)}</Text>
        </View>
        <View style={s.volItem}>
          <Text style={s.volLabel}>90D</Text>
          <Text style={s.volValue}>{fmt(item.volume_90_day)}</Text>
        </View>
        <View style={s.volItem}>
          <Text style={s.volLabel}>MTD</Text>
          <Text style={s.volValue}>{fmt(item.volume_mtd)}</Text>
        </View>
        {item.merchant_phone ? (
          <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${item.merchant_phone}`)}>
            <Text style={s.callText}>📞</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
const DETAIL_TABS = ['Info', 'Equipment', 'Notes', 'History'];

function DetailModal({ merchant, onClose }) {
  const [tab, setTab]                 = useState('Info');
  const [full, setFull]               = useState(null);
  const [equipment, setEquipment]     = useState({ current: [], past: [] });
  const [notes, setNotes]             = useState([]);
  const [history, setHistory]         = useState(null); // null = not loaded yet
  const [loading, setLoading]         = useState(false);
  const [loadingHist, setLoadingHist] = useState(false);
  const [noteTitle, setNoteTitle]     = useState('');
  const [noteBody, setNoteBody]       = useState('');
  const [savingNote, setSavingNote]   = useState(false);

  const uuid = merchant?.id;

  useEffect(() => {
    if (!uuid) return;
    setTab('Info'); setFull(null); setEquipment({ current: [], past: [] });
    setNotes([]); setHistory(null); setNoteTitle(''); setNoteBody('');
    setLoading(true);
    Promise.all([
      Api.getFullMerchant(uuid).catch(() => null),
      Api.getEquipment(uuid).catch(() => null),
      Api.getNotes(uuid).catch(() => null),
    ]).then(([f, eq, n]) => {
      if (f?.success)  setFull(f.data);
      if (eq?.success) setEquipment({ current: eq.current || [], past: eq.past || [] });
      if (n?.success)  setNotes(n.data || []);
    }).finally(() => setLoading(false));
  }, [uuid]);

  async function loadHistory() {
    if (loadingHist) return;
    setLoadingHist(true);
    try {
      const res = await Api.getHistory(uuid);
      setHistory(res?.success ? (res.data || []) : []);
    } catch (e) { setHistory([]); }
    setLoadingHist(false);
  }

  async function submitNote() {
    const body = noteBody.trim();
    if (!body) { Alert.alert('Required', 'Enter a note.'); return; }
    setSavingNote(true);
    try {
      let createdBy;
      try {
        const sess = await StaffAuth.getSession();
        createdBy = sess?.user?.userid;
      } catch (e) { /* ignore */ }
      const res = await Api.addNote(uuid, noteTitle.trim() || null, body, createdBy);
      if (res?.success) {
        setNoteTitle(''); setNoteBody('');
        try {
          const n = await Api.getNotes(uuid);
          if (n?.success) setNotes(n.data || []);
        } catch (e) { /* ignore */ }
      } else {
        Alert.alert('Error', res?.message || 'Could not add note.');
      }
    } catch (e) {
      if (!e?.sessionExpired) Alert.alert('Error', 'Could not add note.');
    }
    setSavingNote(false);
  }

  if (!merchant) return null;
  const m = full || merchant;
  const sc = statusColor(m.account_status);

  return (
    <Modal visible={!!merchant} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>{m.dba_name || '—'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={s.chipRow}>
              {DETAIL_TABS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.chip, tab === t && s.chipActive]}
                  onPress={() => { setTab(t); if (t === 'History' && history === null) loadHistory(); }}
                >
                  <Text style={[s.chipText, tab === t && s.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20, paddingTop: 12 }}>
              {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} /> : null}

              {tab === 'Info' && !loading ? (
                <View>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <View style={[s.badge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.badgeText, { color: sc.text }]}>{(m.account_status || '—').toUpperCase()}</Text>
                    </View>
                  </View>
                  {[
                    ['MID',           m.merchant_id],
                    ['DBA Name',      m.dba_name],
                    ['Legal Name',    m.legal_name],
                    ['Agent ID',      m.agent_id],
                    ['Agent',         m.agent_name],
                    ['Address',       m.merchant_address],
                    ['City',          m.merchant_city],
                    ['State',         m.merchant_state],
                    ['Zip',           m.merchant_zip],
                    ['Phone',         m.merchant_phone],
                    ['Email',         m.email],
                    ['Enrolled',      m.enrollment_date ? fmtDate(m.enrollment_date) : null],
                    ['Approved',      m.approved_date ? fmtDate(m.approved_date) : null],
                    ['Last Batch',    m.last_batch_date ? fmtDate(m.last_batch_date) : null],
                    ['30-Day Vol',    fmt(m.volume_30_day)],
                    ['90-Day Vol',    fmt(m.volume_90_day)],
                    ['MTD Vol',       fmt(m.volume_mtd)],
                  ].filter(([, v]) => v && v !== '—').map(([label, value]) => (
                    <View key={label} style={s.detailRow}>
                      <Text style={s.detailLabel}>{label}</Text>
                      <Text style={s.detailValue}>{value}</Text>
                    </View>
                  ))}
                  {m.merchant_phone ? (
                    <TouchableOpacity style={s.callFullBtn} onPress={() => Linking.openURL(`tel:${m.merchant_phone}`)}>
                      <Text style={s.callFullText}>📞  Call Merchant</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {tab === 'Equipment' && !loading ? (
                <View>
                  <Text style={s.fieldLabel}>Current Equipment</Text>
                  {equipment.current.length === 0 ? <Text style={s.emptySmall}>No equipment deployed</Text> :
                    equipment.current.map((e, i) => (
                      <View key={e.id || i} style={s.subCard}>
                        <Text style={s.subCardTitle}>{e.terminal_type || 'Terminal'}</Text>
                        <Text style={s.subCardMeta}>SN: {e.serial_number || '—'}</Text>
                        {e.deployment_date || e.deployed_at ? (
                          <Text style={s.subCardMeta}>Deployed {fmtDate(e.deployment_date || e.deployed_at)}</Text>
                        ) : null}
                      </View>
                    ))}
                  <Text style={s.fieldLabel}>Past Equipment</Text>
                  {equipment.past.length === 0 ? <Text style={s.emptySmall}>No past equipment</Text> :
                    equipment.past.map((e, i) => (
                      <View key={i} style={[s.subCard, { opacity: 0.75 }]}>
                        <Text style={s.subCardTitle}>{e.terminal_type || 'Terminal'}</Text>
                        <Text style={s.subCardMeta}>SN: {e.serial_number || '—'}</Text>
                        <Text style={s.subCardMeta}>
                          {e.deployment_display_id ? `Deployment ${e.deployment_display_id}` : ''}
                          {e.return_display_id ? ` · Return ${e.return_display_id}` : ''}
                        </Text>
                      </View>
                    ))}
                </View>
              ) : null}

              {tab === 'Notes' && !loading ? (
                <View>
                  <Text style={s.fieldLabel}>Add Note</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Title (optional)"
                    placeholderTextColor={COLORS.light}
                    value={noteTitle}
                    onChangeText={setNoteTitle}
                  />
                  <TextInput
                    style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                    placeholder="Write a note…"
                    placeholderTextColor={COLORS.light}
                    value={noteBody}
                    onChangeText={setNoteBody}
                    multiline
                  />
                  <TouchableOpacity
                    style={[s.primaryBtn, (savingNote || !noteBody.trim()) && { opacity: 0.5 }]}
                    onPress={submitNote}
                    disabled={savingNote || !noteBody.trim()}
                  >
                    {savingNote ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save Note</Text>}
                  </TouchableOpacity>

                  <Text style={s.fieldLabel}>Notes</Text>
                  {notes.length === 0 ? <Text style={s.emptySmall}>No notes yet</Text> :
                    notes.map((n, i) => (
                      <View key={n.id || i} style={s.noteCard}>
                        {n.title ? <Text style={s.noteTitle}>{n.title}</Text> : null}
                        <Text style={s.noteBody}>{n.body}</Text>
                        <View style={s.noteMeta}>
                          <Text style={s.noteAuthor}>{n.display_name || 'Staff'}</Text>
                          <Text style={s.noteDate}>{fmtDate(n.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                </View>
              ) : null}

              {tab === 'History' && !loading ? (
                <View>
                  {loadingHist ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> :
                    history === null || history.length === 0 ? <Text style={s.emptySmall}>No equipment history</Text> :
                      history.map((h, i) => (
                        <View key={h.id || i} style={s.subCard}>
                          <Text style={s.subCardTitle}>{h.action || h.event || h.log_type || 'Event'}</Text>
                          {h.equipments ? (
                            <Text style={s.subCardMeta}>
                              {h.equipments.terminal_type || '—'} · SN: {h.equipments.serial_number || '—'}
                            </Text>
                          ) : null}
                          {h.notes || h.details ? <Text style={s.subCardMeta}>{h.notes || h.details}</Text> : null}
                          <Text style={s.noteDate}>{fmtDate(h.created_at)}</Text>
                        </View>
                      ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function StaffMerchantsScreen({ navigation }) {
  const [merchants, setMerchants]   = useState([]);
  const [count, setCount]           = useState(0);
  const [metrics, setMetrics]       = useState(null);
  const [page, setPage]             = useState(0);
  const [loading, setLoading]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery]           = useState('');
  const [status, setStatus]         = useState('');
  const [selected, setSelected]     = useState(null);
  const [offline, setOffline]       = useState(false);
  const [cachedAt, setCachedAt]     = useState(null);
  const searchTimer = useRef(null);
  const reqId = useRef(0);

  const load = useCallback(async (pageNum, q, st, append) => {
    const myReq = ++reqId.current;
    if (append) setLoadingMore(true); else setLoading(true);
    const isDefault = pageNum === 0 && !q && !st;
    try {
      const res = isDefault
        ? await withCache('staff_merchants', () => Api.list({ page: 0, query: '', statusFilter: '' }))
        : await Api.list({ page: pageNum, query: q, statusFilter: st });
      if (myReq !== reqId.current) return; // stale response
      if (res?.success) {
        setMerchants(prev => (append ? [...prev, ...(res.data || [])] : (res.data || [])));
        setCount(res.count || 0);
        setMetrics(res.metrics || null);
        setPage(pageNum);
        setOffline(isDefault ? !!res.fromCache : false);
        setCachedAt(isDefault ? (res.cachedAt || null) : null);
      }
    } catch (e) { /* fail quietly */ }
    if (myReq === reqId.current) {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(0, '', '', false); }, [load]);

  function onSearch(text) {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(0, text.trim(), status, false), 400);
  }

  function onStatus(st) {
    setStatus(st);
    load(0, query.trim(), st, false);
  }

  function onEndReached() {
    if (loading || loadingMore) return;
    if (merchants.length >= count) return;
    load(page + 1, query.trim(), status, true);
  }

  return (
    <View style={s.root}>
      {/* Search */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search by DBA name…"
          placeholderTextColor={COLORS.light}
          value={query}
          onChangeText={onSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterBarContent}>
        {STATUS_FILTERS.map(st => {
          const active = st === status;
          return (
            <TouchableOpacity key={st || 'all'} style={[s.chip, active && s.chipActive]} onPress={() => onStatus(st)}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{st || 'All'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {offline && <View style={{ paddingHorizontal: 12, paddingTop: 8 }}><OfflineBanner cachedAt={cachedAt} /></View>}

      {/* Metrics strip */}
      {metrics ? (
        <View style={s.metricsBar}>
          <Text style={s.metricsText}>{count} merchants</Text>
          <Text style={s.metricsText}>MTD {fmt(metrics.totalMTD)}</Text>
          <Text style={s.metricsText}>30D {fmt(metrics.total30D)}</Text>
          <Text style={s.metricsText}>{metrics.portfolioShare}% share</Text>
        </View>
      ) : null}

      <FlatList
        data={merchants}
        keyExtractor={(item, i) => String(item.id || item.merchant_id || i)}
        renderItem={({ item }) => <MerchantCard item={item} onPress={setSelected} />}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(0, query.trim(), status, false); }}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={(loading || loadingMore) && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No merchants found</Text> : null}
      />

      <DetailModal merchant={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  searchBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, marginHorizontal: 12, marginTop: 12, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:    { fontSize: 16, marginRight: 6 },
  searchInput:   { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  filterBar:     { maxHeight: 48, marginTop: 10 },
  filterBarContent: { paddingHorizontal: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  metricsBar:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  metricsText:   { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  list:          { paddingHorizontal: 12, paddingBottom: 30 },
  card:          { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 },
  dba:           { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 10, fontWeight: '800' },
  cardMid:       { flexDirection: 'row', gap: 10, marginBottom: 4 },
  mid:           { fontSize: 12, color: COLORS.primary, fontWeight: '700', fontFamily: 'monospace' },
  meta:          { fontSize: 12, color: COLORS.muted },
  agentLine:     { fontSize: 11, color: COLORS.muted, marginBottom: 8 },
  cardBottom:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  volItem:       { alignItems: 'center' },
  volLabel:      { fontSize: 9, fontWeight: '700', color: COLORS.light, textTransform: 'uppercase' },
  volValue:      { fontSize: 13, fontWeight: '800', color: COLORS.text },
  callBtn:       { marginLeft: 'auto', padding: 6 },
  callText:      { fontSize: 20 },
  empty:         { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  emptySmall:    { color: COLORS.muted, fontSize: 12, marginBottom: 8 },
  // Chips
  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:          { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:      { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive:{ color: '#fff' },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:    { flex: 1, fontSize: 18, fontWeight: '900', color: COLORS.text },
  modalClose:    { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  fieldLabel:    { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel:   { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  detailValue:   { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  callFullBtn:   { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  callFullText:  { color: '#fff', fontSize: 15, fontWeight: '800' },
  input:         { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 8, backgroundColor: '#fff' },
  primaryBtn:    { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  primaryBtnText:{ color: '#fff', fontSize: 14, fontWeight: '800' },
  subCard:       { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginBottom: 8 },
  subCardTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.text },
  subCardMeta:   { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  noteCard:      { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginBottom: 8 },
  noteTitle:     { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 3 },
  noteBody:      { fontSize: 13, color: COLORS.text, lineHeight: 18, marginBottom: 6 },
  noteMeta:      { flexDirection: 'row', justifyContent: 'space-between' },
  noteAuthor:    { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  noteDate:      { fontSize: 11, color: COLORS.light, marginTop: 2 },
});
