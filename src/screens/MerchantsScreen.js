import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { COLORS } from '../config';
import { Merchants } from '../api';

const STATUS_OPTIONS = [
  'Approved', 'Pending', 'Enrollment', 'Closed', 'Declined',
  'Collections', 'Approved - Collections', 'Closed - Collections',
  'Closed - Risk', 'Fraud', 'Withdrawn',
];

const FILTER_BY_OPTIONS = [
  ['dba_name',     'DBA Name'],
  ['merchant_id',  'MID'],
  ['agent_id',     'Partner ID'],
  ['company_name', 'Company'],
  ['partner_name', 'Partner Name'],
];

const HEALTH_COLORS = {
  'healthy':  { bg: '#dcfce7', text: '#16a34a' },
  'good':     { bg: '#dbeafe', text: '#2563eb' },
  'fair':     { bg: '#fef3c7', text: '#d97706' },
  'at risk':  { bg: '#ffedd5', text: '#ea580c' },
  'critical': { bg: '#fee2e2', text: '#dc2626' },
};

function statusColor(status) {
  const t = (status || '').toLowerCase();
  if (t.includes('approved')) return { bg: '#dcfce7', text: '#16a34a' };
  if (t.includes('fraud'))    return { bg: '#1e293b', text: '#f8fafc' };
  if (t.includes('closed') || t.includes('declined')) return { bg: '#fee2e2', text: '#dc2626' };
  if (t.includes('pending') || t.includes('enrollment')) return { bg: '#fef3c7', text: '#d97706' };
  return { bg: '#f1f5f9', text: '#64748b' };
}

function fmt$(n) {
  if (n == null || n === '') return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch (e) { return String(d); }
}

// ── Merchant card ─────────────────────────────────────────────────────────────

function MerchantCard({ item, onPress }) {
  const sc = statusColor(item.account_status);
  const hc = HEALTH_COLORS[(item.health_label || '').toLowerCase()];
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardLeft}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(item.dba_name || '?')[0].toUpperCase()}</Text>
        </View>
      </View>
      <View style={s.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.dba} numberOfLines={1}>{item.dba_name || '—'}</Text>
          {item.is_prime49 ? (
            <View style={s.prime49Badge}><Text style={s.prime49Text}>P49</Text></View>
          ) : null}
        </View>
        <Text style={s.mid}>{item.merchant_id || ''}</Text>
        <View style={s.badgeRow}>
          {item.account_status ? (
            <View style={[s.badge, { backgroundColor: sc.bg }]}>
              <Text style={[s.badgeText, { color: sc.text }]}>{item.account_status}</Text>
            </View>
          ) : null}
          {hc ? (
            <View style={[s.badge, { backgroundColor: hc.bg }]}>
              <Text style={[s.badgeText, { color: hc.text }]}>{item.health_label}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={s.cardRight}>
        <Text style={s.cardVol}>{fmt$(item.volume_30_day)}</Text>
        <Text style={s.cardVolLabel}>30-day</Text>
        {item.merchant_phone ? (
          <TouchableOpacity
            style={s.callBtn}
            onPress={() => Linking.openURL(`tel:${item.merchant_phone}`)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={s.callBtnText}>📞</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Create merchant modal ─────────────────────────────────────────────────────

function CreateMerchantModal({ visible, onClose, onCreated }) {
  const [merchantId, setMerchantId]   = useState('');
  const [dbaName, setDbaName]         = useState('');
  const [agentId, setAgentId]         = useState('');
  const [agentName, setAgentName]     = useState('');
  const [agentLookupBusy, setAgentLookupBusy] = useState(false);
  const [status, setStatus]           = useState('');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [contact, setContact]         = useState('');
  const [address, setAddress]         = useState('');
  const [city, setCity]               = useState('');
  const [state, setState]             = useState('');
  const [zip, setZip]                 = useState('');
  const [saving, setSaving]           = useState(false);

  function reset() {
    setMerchantId(''); setDbaName(''); setAgentId(''); setAgentName('');
    setStatus(''); setPhone(''); setEmail(''); setContact('');
    setAddress(''); setCity(''); setState(''); setZip('');
  }

  async function lookupAgent() {
    if (!agentId.trim()) return;
    setAgentLookupBusy(true);
    try {
      const res = await Merchants.lookupAgent(agentId.trim());
      if (res?.found) {
        setAgentName(res.agent_name || '');
        Alert.alert('Partner found', res.agent_name || agentId.trim());
      } else {
        setAgentName('');
        Alert.alert('Not found', `No partner with ID "${agentId.trim()}".`);
      }
    } catch (e) {
      Alert.alert('Error', 'Lookup failed.');
    }
    setAgentLookupBusy(false);
  }

  async function submit() {
    if (!merchantId.trim()) { Alert.alert('Required', 'Enter a Merchant ID (MID).'); return; }
    if (!dbaName.trim())    { Alert.alert('Required', 'Enter a DBA name.'); return; }
    setSaving(true);
    try {
      const payload = { merchant_id: merchantId.trim(), dba_name: dbaName.trim() };
      if (agentId.trim())   payload.agent_id   = agentId.trim();
      if (agentName.trim()) payload.agent_name = agentName.trim();
      if (status.trim())    payload.account_status = status.trim();
      if (phone.trim())     payload.merchant_phone = phone.trim();
      if (email.trim())     payload.email = email.trim();
      if (contact.trim())   payload.merchant_primary_contact = contact.trim();
      if (address.trim())   payload.merchant_address = address.trim();
      if (city.trim())      payload.merchant_city = city.trim();
      if (state.trim())     payload.merchant_state = state.trim();
      if (zip.trim())       payload.merchant_zip = zip.trim();

      const res = await Merchants.create(payload);
      if (res.success) {
        reset();
        onCreated();
      } else {
        Alert.alert('Error', res.error || res.message || 'Could not create merchant.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not create merchant. Check your connection.');
    }
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Merchant</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={s.fieldLabel}>Merchant ID (MID) *</Text>
              <TextInput style={s.input} placeholder="e.g. ABC1234567" placeholderTextColor={COLORS.light}
                value={merchantId} onChangeText={setMerchantId} autoCapitalize="characters" autoCorrect={false} />

              <Text style={s.fieldLabel}>DBA Name *</Text>
              <TextInput style={s.input} placeholder="Doing Business As name" placeholderTextColor={COLORS.light}
                value={dbaName} onChangeText={setDbaName} />

              <Text style={s.fieldLabel}>Partner ID</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Agent ID string" placeholderTextColor={COLORS.light}
                  value={agentId} onChangeText={v => { setAgentId(v); setAgentName(''); }} autoCapitalize="characters" />
                <TouchableOpacity style={s.lookupBtn} onPress={lookupAgent} disabled={agentLookupBusy}>
                  {agentLookupBusy
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.lookupBtnText}>Lookup</Text>}
                </TouchableOpacity>
              </View>
              {agentName ? <Text style={s.agentFound}>✓ {agentName}</Text> : null}

              <Text style={s.fieldLabel}>Account Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {STATUS_OPTIONS.map(st => (
                  <TouchableOpacity key={st} style={[s.chip, status === st && s.chipActive]}
                    onPress={() => setStatus(status === st ? '' : st)}>
                    <Text style={[s.chipText, status === st && s.chipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.fieldLabel}>Primary Contact</Text>
              <TextInput style={s.input} placeholder="Contact person" placeholderTextColor={COLORS.light}
                value={contact} onChangeText={setContact} />

              <Text style={s.fieldLabel}>Phone</Text>
              <TextInput style={s.input} placeholder="(555) 000-0000" placeholderTextColor={COLORS.light}
                value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

              <Text style={s.fieldLabel}>Email</Text>
              <TextInput style={s.input} placeholder="contact@business.com" placeholderTextColor={COLORS.light}
                value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

              <Text style={s.fieldLabel}>Address</Text>
              <TextInput style={s.input} placeholder="Street address" placeholderTextColor={COLORS.light}
                value={address} onChangeText={setAddress} />

              <View style={s.rowFields}>
                <View style={{ flex: 2 }}>
                  <Text style={s.fieldLabel}>City</Text>
                  <TextInput style={s.input} placeholder="City" placeholderTextColor={COLORS.light}
                    value={city} onChangeText={setCity} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.fieldLabel}>State</Text>
                  <TextInput style={s.input} placeholder="CA" placeholderTextColor={COLORS.light}
                    value={state} onChangeText={setState} autoCapitalize="characters" maxLength={2} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.fieldLabel}>ZIP</Text>
                  <TextInput style={s.input} placeholder="90210" placeholderTextColor={COLORS.light}
                    value={zip} onChangeText={setZip} keyboardType="numeric" maxLength={10} />
                </View>
              </View>

              <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryBtnText}>Create Merchant</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Pipeline view ─────────────────────────────────────────────────────────────

const PIPELINE_PERIODS = [[7, 'Week'], [30, '30d'], [90, '90d'], [180, '6mo'], [365, '1yr']];
const STAGE_COLORS = {
  Enrollment: '#2563eb', Pending: '#d97706', Approved: '#16a34a', Declined: '#dc2626',
};

function PipelineView() {
  const [period, setPeriod] = useState(30);
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Merchants.getPipelineStats({ period })
      .then(d => setStats(d?.success ? d : null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [period]);

  const counts = stats?.period_counts || {};

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 90 }}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        {PIPELINE_PERIODS.map(([days, label]) => (
          <TouchableOpacity key={days} style={[s.chip, period === days && s.chipActive]} onPress={() => setPeriod(days)}>
            <Text style={[s.chipText, period === days && s.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} /> : (
        <>
          {/* Funnel */}
          <View style={s.funnelRow}>
            {['Enrollment', 'Pending', 'Approved', 'Declined'].map(stage => (
              <View key={stage} style={[s.funnelCard, { borderTopColor: STAGE_COLORS[stage] }]}>
                <Text style={[s.funnelNum, { color: STAGE_COLORS[stage] }]}>{counts[stage] ?? 0}</Text>
                <Text style={s.funnelLabel}>{stage}</Text>
              </View>
            ))}
          </View>

          {stats?.conversion_rate != null && (
            <View style={s.convCard}>
              <Text style={s.convNum}>{Number(stats.conversion_rate).toFixed(1)}%</Text>
              <Text style={s.convLabel}>Conversion Rate (approved vs declined)</Text>
            </View>
          )}

          {/* Top partners */}
          {(stats?.top_partners || []).length > 0 && (
            <>
              <Text style={s.sectionTitle}>Top Partners</Text>
              {(stats.top_partners || []).slice(0, 10).map((p, i) => (
                <View key={i} style={s.pipelineRow}>
                  <Text style={s.pipelineName} numberOfLines={1}>{p.name || '—'}</Text>
                  <Text style={s.pipelineCount}>{p.count}</Text>
                </View>
              ))}
            </>
          )}

          {/* Recent entries */}
          {(stats?.recent || []).length > 0 && (
            <>
              <Text style={s.sectionTitle}>Recent Entries</Text>
              {(stats.recent || []).slice(0, 15).map((m, i) => {
                const sc = statusColor(m.account_status);
                return (
                  <View key={i} style={s.pipelineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pipelineName} numberOfLines={1}>{m.dba_name || m.merchant_id}</Text>
                      <Text style={s.pipelineSub}>{m.agent_name || '—'} · {fmtDate(m.enrollment_date)}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.badgeText, { color: sc.text }]}>{m.account_status || '—'}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ── Prime49 residuals view ────────────────────────────────────────────────────

function Prime49View() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoading(true);
      Merchants.getPrime49Residuals()
        .then(d => { setRows(d?.data || []); setLoaded(true); })
        .catch(() => setLoaded(true))
        .finally(() => setLoading(false));
    }
  }, [loaded]);

  const totals = rows.reduce((acc, r) => ({
    vol:   acc.vol   + (Number(r.volume_30_day)  || 0),
    ppt:   acc.ppt   + (Number(r.ppt_residual)   || 0),
    agent: acc.agent + (Number(r.agent_residual) || 0),
  }), { vol: 0, ppt: 0, agent: 0 });

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, i) => String(item.merchant_id ?? i)}
      contentContainerStyle={{ padding: 14, paddingBottom: 90 }}
      ListHeaderComponent={
        <View style={s.funnelRow}>
          <View style={[s.funnelCard, { borderTopColor: COLORS.primary }]}>
            <Text style={[s.funnelNum, { color: COLORS.primary, fontSize: 14 }]}>{fmt$(totals.vol)}</Text>
            <Text style={s.funnelLabel}>30d Volume</Text>
          </View>
          <View style={[s.funnelCard, { borderTopColor: '#2563eb' }]}>
            <Text style={[s.funnelNum, { color: '#2563eb', fontSize: 14 }]}>{fmt$(totals.ppt)}</Text>
            <Text style={s.funnelLabel}>PPT Residual</Text>
          </View>
          <View style={[s.funnelCard, { borderTopColor: '#16a34a' }]}>
            <Text style={[s.funnelNum, { color: '#16a34a', fontSize: 14 }]}>{fmt$(totals.agent)}</Text>
            <Text style={s.funnelLabel}>Agent Residual</Text>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={{ flex: 1 }}>
            <Text style={s.dba} numberOfLines={1}>{item.dba_name || item.merchant_id}</Text>
            <Text style={s.mid}>{item.merchant_id} · {item.agent_id || '—'}</Text>
            <Text style={s.pipelineSub} numberOfLines={1}>
              {[item.agent_name, item.agent_company].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.cardVol}>{fmt$(item.volume_30_day)}</Text>
            <Text style={[s.resPpt]}>PPT {fmt$(item.ppt_residual)}</Text>
            <Text style={[s.resAgent]}>Agt {fmt$(item.agent_residual)}</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={s.empty}>No Prime49 merchants found</Text>}
    />
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MerchantsScreen({ navigation }) {
  const [view, setView]         = useState('portfolio'); // portfolio | pipeline | prime49
  const [query, setQuery]       = useState('');
  const [filterBy, setFilterBy] = useState('dba_name');
  const [statusFilter, setStatusFilter] = useState('');
  const [results, setResults]   = useState([]);
  const [metrics, setMetrics]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  async function search(q = query, pg = 1, append = false, fb = filterBy, st = statusFilter) {
    setLoading(true);
    try {
      const data = await Merchants.list(q, pg, 20, fb, st);
      const rows = data.data || data.merchants || [];
      setResults(append ? prev => [...prev, ...rows] : rows);
      setTotal(data.totalCount ?? data.count ?? 0);
      if (data.metrics) setMetrics(data.metrics);
      setPage(pg);
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }

  const onSearch = useCallback(() => search(query, 1, false), [query, filterBy, statusFilter]);

  function loadMore() {
    if (results.length < total && !loading) search(query, page + 1, true);
  }

  function onRefresh() { setRefreshing(true); search(query, 1, false); }

  useEffect(() => { search('', 1, false); }, []);

  // Re-search when the status filter changes
  useEffect(() => { search(query, 1, false, filterBy, statusFilter); }, [statusFilter]);

  return (
    <View style={s.container}>
      {/* View toggle: Portfolio | Pipeline | Prime49 */}
      <View style={s.viewTabs}>
        {[['portfolio', 'Portfolio'], ['pipeline', 'Pipeline'], ['prime49', 'Prime49']].map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.viewTab, view === key && s.viewTabActive]} onPress={() => setView(key)}>
            <Text style={[s.viewTabText, view === key && s.viewTabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === 'pipeline' && <PipelineView />}
      {view === 'prime49'  && <Prime49View />}

      {view === 'portfolio' && (
        <>
          {/* KPI cards */}
          {metrics ? (
            <View style={s.kpiRow}>
              <View style={s.kpi}>
                <Text style={s.kpiNum}>{fmt$(metrics.totalMTD)}</Text>
                <Text style={s.kpiLabel}>MTD</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiNum}>{fmt$(metrics.total30D)}</Text>
                <Text style={s.kpiLabel}>30D</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiNum}>{fmt$(metrics.total90D)}</Text>
                <Text style={s.kpiLabel}>90D</Text>
              </View>
              <View style={[s.kpi, { backgroundColor: COLORS.primary }]}>
                <Text style={[s.kpiNum, { color: '#fff' }]}>{metrics.portfolioShare ?? '—'}</Text>
                <Text style={[s.kpiLabel, { color: 'rgba(255,255,255,0.8)' }]}>Share</Text>
              </View>
            </View>
          ) : null}

          {/* Search Bar */}
          <View style={s.searchBar}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder={`Search by ${FILTER_BY_OPTIONS.find(([k]) => k === filterBy)?.[1] || 'name'}…`}
              placeholderTextColor={COLORS.light}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={onSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <TouchableOpacity onPress={() => setShowFilters(f => !f)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.filterToggle, (showFilters || statusFilter || filterBy !== 'dba_name') && { color: COLORS.primary }]}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          {showFilters && (
            <View style={s.filterPanel}>
              <Text style={s.filterLabel}>Search field</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 14 }}>
                {FILTER_BY_OPTIONS.map(([key, label]) => (
                  <TouchableOpacity key={key} style={[s.chip, filterBy === key && s.chipActive]}
                    onPress={() => setFilterBy(key)}>
                    <Text style={[s.chipText, filterBy === key && s.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.filterLabel}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 14 }}>
                <TouchableOpacity style={[s.chip, !statusFilter && s.chipActive]} onPress={() => setStatusFilter('')}>
                  <Text style={[s.chipText, !statusFilter && s.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {STATUS_OPTIONS.map(st => (
                  <TouchableOpacity key={st} style={[s.chip, statusFilter === st && s.chipActive]}
                    onPress={() => setStatusFilter(statusFilter === st ? '' : st)}>
                    <Text style={[s.chipText, statusFilter === st && s.chipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={s.countLabel}>{total} merchant{total !== 1 ? 's' : ''}</Text>

          <FlatList
            data={results}
            keyExtractor={item => item.id || item.merchant_id}
            renderItem={({ item }) => (
              <MerchantCard
                item={item}
                onPress={() => navigation.navigate('MerchantDetail', { merchant: item })}
              />
            )}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
            ListEmptyComponent={!loading ? <Text style={s.empty}>No merchants found</Text> : null}
          />

          {/* FAB */}
          <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
            <Text style={s.fabText}>＋</Text>
          </TouchableOpacity>

          <CreateMerchantModal
            visible={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); search('', 1, false); }}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },

  // View tabs
  viewTabs:    { flexDirection: 'row', margin: 14, marginBottom: 0, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  viewTab:     { flex: 1, paddingVertical: 10, alignItems: 'center' },
  viewTabActive: { backgroundColor: COLORS.primary },
  viewTabText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  viewTabTextActive: { color: '#fff' },

  // KPI cards
  kpiRow:      { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 10 },
  kpi:         { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  kpiNum:      { fontSize: 11, fontWeight: '900', color: COLORS.text },
  kpiLabel:    { fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 14, marginBottom: 0, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:  { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  filterToggle:{ fontSize: 20, color: COLORS.muted, paddingLeft: 8 },

  filterPanel: { paddingTop: 4, paddingBottom: 8 },
  filterLabel: { fontSize: 10, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 10, marginBottom: 6 },

  countLabel:  { fontSize: 11, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginVertical: 6 },
  list:        { paddingHorizontal: 14, paddingBottom: 90 },

  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLeft:    { marginRight: 12 },
  avatar:      { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontSize: 18, fontWeight: '800' },
  cardBody:    { flex: 1 },
  dba:         { fontSize: 14, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  mid:         { fontSize: 11, color: COLORS.primary, fontFamily: 'monospace', marginTop: 1 },
  badgeRow:    { flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  badge:       { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:   { fontSize: 9, fontWeight: '800' },
  prime49Badge:{ backgroundColor: '#fef3c7', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1 },
  prime49Text: { fontSize: 8, fontWeight: '900', color: '#d97706' },
  cardRight:   { alignItems: 'flex-end', marginLeft: 8 },
  cardVol:     { fontSize: 13, fontWeight: '800', color: COLORS.text },
  cardVolLabel:{ fontSize: 9, color: COLORS.muted, fontWeight: '600' },
  callBtn:     { marginTop: 6 },
  callBtnText: { fontSize: 16 },

  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },

  // Pipeline
  funnelRow:   { flexDirection: 'row', gap: 6, marginBottom: 12 },
  funnelCard:  { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 10, alignItems: 'center', borderTopWidth: 3, borderWidth: 1, borderColor: COLORS.border },
  funnelNum:   { fontSize: 18, fontWeight: '900' },
  funnelLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  convCard:    { backgroundColor: COLORS.card, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  convNum:     { fontSize: 22, fontWeight: '900', color: COLORS.success },
  convLabel:   { fontSize: 10, color: COLORS.muted, fontWeight: '600', marginTop: 2 },
  sectionTitle:{ fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 10, padding: 12, marginBottom: 6, gap: 8 },
  pipelineName:{ flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text },
  pipelineSub: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  pipelineCount:{ fontSize: 14, fontWeight: '900', color: COLORS.primary },

  // Prime49
  resPpt:      { fontSize: 10, fontWeight: '700', color: '#2563eb', marginTop: 2 },
  resAgent:    { fontSize: 10, fontWeight: '700', color: '#16a34a' },

  // Chips
  chip:        { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.card },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },

  // FAB
  fab:         { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabText:     { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 32 },

  // Create merchant modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:  { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  fieldLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  rowFields:   { flexDirection: 'row', alignItems: 'flex-start' },
  lookupBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', marginBottom: 4 },
  lookupBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  agentFound:  { fontSize: 12, color: COLORS.success, fontWeight: '700', marginTop: 2 },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
