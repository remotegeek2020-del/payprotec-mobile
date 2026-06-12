import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest, StaffAuth } from '../../staff-api';

// ── API (api/partners.js + api/partner-auth.js) ───────────────────────────────
const Api = {
  // returns { data: { persons, agents, identifiers, companies } }
  getPartnersList: () => staffRequest('/api/partners', { action: 'get_partners_list' }),
  // returns { data: [{ agent_id, total_volume_sum, total_volume_90d_sum }] }
  getAllStats:     () => staffRequest('/api/partners', { action: 'get_all_stats' }),
  // returns { scorecard: { totals, companies, top_merchants } } (scorecard may be null)
  getScorecard:    (person_id) => staffRequest('/api/partners', { action: 'get_scorecard', person_id }),
  // returns { data: top-20 ranked, needs_attention, ranks, total }
  getLeaderboard:  () => staffRequest('/api/partners', { action: 'get_leaderboard' }),
  getNotes:        (person_id, hl_contact_id) => staffRequest('/api/partners', { action: 'get_notes', person_id, hl_contact_id }),
  addNote:         (payload) => staffRequest('/api/partners', { action: 'add_note', ...payload }),
  // Portal actions live on /api/partner-auth
  sendInvite:      (person_id) => staffRequest('/api/partner-auth', { action: 'send_invite', person_id }),
  togglePortal:    (person_id, active) => staffRequest('/api/partner-auth', { action: 'toggle_portal', person_id, active }),
};

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

const TREND_STYLE = {
  growth: { bg: '#d1fae5', text: '#059669', label: 'GROWTH' },
  risk:   { bg: '#fee2e2', text: '#dc2626', label: 'AT RISK' },
  stable: { bg: '#f1f5f9', text: '#64748b', label: 'STABLE' },
};

const TIER_STYLE = {
  Gold:   { bg: '#fef3c7', text: '#b45309' },
  Silver: { bg: '#e2e8f0', text: '#475569' },
  Bronze: { bg: '#fed7aa', text: '#9a3412' },
};

// Mirrors the web's processPartnerData: joins persons → agents → identifiers →
// companies, and sums merchant_stats_by_id volumes (keyed by id_string) for trend.
function buildPartners(raw, statsRaw) {
  const { persons = [], agents = [], identifiers = [], companies = [] } = raw || {};
  const companyById = new Map(companies.map(c => [c.id, c]));
  const statsByIdString = new Map((statsRaw || []).map(st => [st.agent_id, st]));

  const agentsByPersonId = new Map();
  agents.forEach(a => {
    if (!agentsByPersonId.has(a.parent_agent_id)) agentsByPersonId.set(a.parent_agent_id, []);
    agentsByPersonId.get(a.parent_agent_id).push(a);
  });

  const identifiersByAgentId = new Map();
  identifiers.forEach(i => {
    if (!identifiersByAgentId.has(i.agent_id)) identifiersByAgentId.set(i.agent_id, []);
    identifiersByAgentId.get(i.agent_id).push(i);
  });

  return persons.map(person => {
    const myAgents = agentsByPersonId.get(person.id) || [];
    if (myAgents.length === 0) return null;

    let totalCurrent = 0;
    let totalBaseline = 0;
    const companyNames = new Set();
    const idStrings = [];

    myAgents.forEach(agent => {
      const co = companyById.get(agent.company_id);
      companyNames.add(co ? co.company_name : 'Independent');
      const myIds = identifiersByAgentId.get(agent.id) || [];
      myIds.forEach(id => {
        idStrings.push(id.id_string);
        const st = statsByIdString.get(id.id_string);
        if (st) {
          totalCurrent  += parseFloat(st.total_volume_sum || 0);
          totalBaseline += parseFloat(st.total_volume_90d_sum || 0) / 3;
        }
      });
    });

    if (idStrings.length === 0) return null;

    let trend = 'stable';
    if (totalBaseline > 0) {
      const diff = ((totalCurrent - totalBaseline) / totalBaseline) * 100;
      if (diff > 5) trend = 'growth';
      else if (diff < -5) trend = 'risk';
    }

    return {
      id: person.id,
      name: person.full_name || '—',
      email: person.email || '',
      phone: person.phone_number || '',
      hl_contact_id: person.hl_contact_id || null,
      enrolled_at: person.enrolled_at || null,
      portal_active: !!person.is_portal_active,
      portal_setup: !!person.portal_password_set,
      companies: [...companyNames],
      id_strings: idStrings,
      vol30: totalCurrent,
      trend,
    };
  }).filter(Boolean);
}

function portalStatus(p) {
  if (p.portal_active && p.portal_setup) return { label: 'PORTAL ACTIVE', bg: '#d1fae5', text: '#059669' };
  if (p.portal_active) return { label: 'INVITE SENT', bg: '#fef3c7', text: '#d97706' };
  return { label: 'NO PORTAL', bg: '#f1f5f9', text: '#64748b' };
}

// ── Partner card ───────────────────────────────────────────────────────────────
function PartnerCard({ item, onPress }) {
  const ps = portalStatus(item);
  const ts = TREND_STYLE[item.trend] || TREND_STYLE.stable;
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={s.cardTop}>
        <Text style={s.name} numberOfLines={1}>{item.name}</Text>
        <View style={[s.badge, { backgroundColor: ps.bg }]}>
          <Text style={[s.badgeText, { color: ps.text }]}>{ps.label}</Text>
        </View>
      </View>
      {item.email ? <Text style={s.metaLine} numberOfLines={1}>✉️ {item.email}</Text> : null}
      <Text style={s.metaLine} numberOfLines={1}>🏢 {item.companies.join(', ') || 'Independent'}</Text>
      <View style={s.cardBottom}>
        <Text style={s.idCount}>{item.id_strings.length} ID{item.id_strings.length === 1 ? '' : 's'}</Text>
        <Text style={s.vol}>{fmt(item.vol30)} <Text style={s.volSub}>/30d</Text></Text>
        <View style={[s.badge, { backgroundColor: ts.bg, marginLeft: 'auto' }]}>
          <Text style={[s.badgeText, { color: ts.text }]}>{ts.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Leaderboard row ────────────────────────────────────────────────────────────
function LeaderboardRow({ item }) {
  const tier = TIER_STYLE[item.tier] || TIER_STYLE.Bronze;
  const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : null;
  const growthColor = item.growth_pct > 0 ? COLORS.success : item.growth_pct < 0 ? COLORS.danger : COLORS.muted;
  return (
    <View style={s.card}>
      <View style={s.lbRow}>
        <Text style={s.lbRank}>{medal || `#${item.rank}`}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{item.name || '—'}</Text>
          <Text style={s.metaLine}>{item.merchant_count || 0} merchants</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <Text style={s.vol}>{fmt(item.volume_30_day)}</Text>
          <Text style={[s.growth, { color: growthColor }]}>
            {item.growth_pct > 0 ? '▲' : item.growth_pct < 0 ? '▼' : '•'} {Math.abs(item.growth_pct || 0)}%
          </Text>
        </View>
        <View style={[s.badge, { backgroundColor: tier.bg }]}>
          <Text style={[s.badgeText, { color: tier.text }]}>{(item.tier || '').toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────
function PartnerDetailModal({ partner, onClose, onPortalChanged }) {
  const [scorecard, setScorecard]   = useState(null);
  const [notes, setNotes]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [noteBody, setNoteBody]     = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalActive, setPortalActive] = useState(false);

  const personId = partner?.id;

  useEffect(() => {
    if (!personId) return;
    setScorecard(null); setNotes([]); setNoteBody('');
    setPortalActive(!!partner.portal_active);
    setLoading(true);
    Promise.all([
      Api.getScorecard(personId).catch(() => null),
      Api.getNotes(personId, partner.hl_contact_id).catch(() => null),
    ]).then(([sc, n]) => {
      if (sc?.success) setScorecard(sc.scorecard);
      if (n?.success)  setNotes(n.data || []);
    }).finally(() => setLoading(false));
  }, [personId]);

  async function submitNote() {
    const body = noteBody.trim();
    if (!body) { Alert.alert('Required', 'Enter a note.'); return; }
    setSavingNote(true);
    try {
      let authorId, authorName;
      try {
        const sess = await StaffAuth.getSession();
        authorId = sess?.user?.userid;
        authorName = sess?.user
          ? `${sess.user.first_name || ''} ${sess.user.last_name || ''}`.trim() || sess.user.email
          : undefined;
      } catch (e) { /* ignore */ }
      const res = await Api.addNote({
        person_id: personId,
        body,
        note_type: 'general',
        author_id: authorId,
        author_name: authorName,
        hl_contact_id: partner.hl_contact_id,
      });
      if (res?.success) {
        setNoteBody('');
        try {
          const n = await Api.getNotes(personId, partner.hl_contact_id);
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

  function confirmInvite() {
    Alert.alert(
      'Send Portal Invite',
      `Email a portal setup invite to ${partner.name}${partner.email ? ` (${partner.email})` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Invite',
          onPress: async () => {
            setPortalBusy(true);
            try {
              const res = await Api.sendInvite(personId);
              if (res?.success) {
                setPortalActive(true);
                onPortalChanged();
                Alert.alert('Invite Sent', 'The portal invite email has been sent.');
              } else {
                Alert.alert('Error', res?.message || 'Could not send invite.');
              }
            } catch (e) {
              if (!e?.sessionExpired) Alert.alert('Error', 'Could not send invite.');
            }
            setPortalBusy(false);
          },
        },
      ]
    );
  }

  function confirmToggle() {
    const next = !portalActive;
    Alert.alert(
      next ? 'Enable Portal Access' : 'Disable Portal Access',
      next
        ? `Allow ${partner.name} to access the partner portal?`
        : `Disable portal access for ${partner.name}? Their active sessions will be terminated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Enable' : 'Disable',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            setPortalBusy(true);
            try {
              const res = await Api.togglePortal(personId, next);
              if (res?.success) {
                setPortalActive(next);
                onPortalChanged();
              } else {
                Alert.alert('Error', res?.message || 'Could not update portal access.');
              }
            } catch (e) {
              if (!e?.sessionExpired) Alert.alert('Error', 'Could not update portal access.');
            }
            setPortalBusy(false);
          },
        },
      ]
    );
  }

  if (!partner) return null;
  const totals = scorecard?.totals;
  const ts = TREND_STYLE[totals?.overall_trend] || TREND_STYLE.stable;

  return (
    <Modal visible={!!partner} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>{partner.name}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
              {partner.email ? <Text style={s.contactLine}>✉️ {partner.email}</Text> : null}
              {partner.phone ? <Text style={s.contactLine}>📞 {partner.phone}</Text> : null}
              {partner.enrolled_at ? <Text style={s.contactLine}>📅 Enrolled {fmtDate(partner.enrolled_at)}</Text> : null}

              {/* Portal actions */}
              <View style={s.portalRow}>
                <TouchableOpacity
                  style={[s.portalBtn, { backgroundColor: COLORS.primary }, portalBusy && { opacity: 0.6 }]}
                  onPress={confirmInvite}
                  disabled={portalBusy}
                >
                  <Text style={s.portalBtnText}>✉️ Send Portal Invite</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.portalBtn, { backgroundColor: portalActive ? COLORS.danger : COLORS.success }, portalBusy && { opacity: 0.6 }]}
                  onPress={confirmToggle}
                  disabled={portalBusy}
                >
                  <Text style={s.portalBtnText}>{portalActive ? '🔒 Disable Portal' : '🔓 Enable Portal'}</Text>
                </TouchableOpacity>
              </View>

              {loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 20 }} /> : null}

              {/* Scorecard */}
              {!loading && totals ? (
                <View>
                  <View style={s.scoreHeader}>
                    <Text style={s.fieldLabel}>Scorecard</Text>
                    <View style={[s.badge, { backgroundColor: ts.bg }]}>
                      <Text style={[s.badgeText, { color: ts.text }]}>{ts.label}</Text>
                    </View>
                  </View>
                  <View style={s.statGrid}>
                    <View style={s.statBox}><Text style={s.statValue}>{totals.merchants}</Text><Text style={s.statLabel}>Merchants</Text></View>
                    <View style={s.statBox}><Text style={s.statValue}>{fmt(totals.volume_30)}</Text><Text style={s.statLabel}>30D Vol</Text></View>
                    <View style={s.statBox}><Text style={s.statValue}>{fmt(totals.volume_90)}</Text><Text style={s.statLabel}>90D Vol</Text></View>
                    <View style={s.statBox}><Text style={[s.statValue, { color: COLORS.warning }]}>{totals.pending}</Text><Text style={s.statLabel}>Pending</Text></View>
                    <View style={s.statBox}><Text style={[s.statValue, { color: COLORS.muted }]}>{totals.closed}</Text><Text style={s.statLabel}>Closed</Text></View>
                    <View style={s.statBox}><Text style={[s.statValue, { color: COLORS.danger }]}>{totals.at_risk}</Text><Text style={s.statLabel}>At Risk</Text></View>
                  </View>

                  <Text style={s.fieldLabel}>Companies & Identifiers</Text>
                  {(scorecard.companies || []).map((c, i) => (
                    <View key={i} style={s.subCard}>
                      <View style={s.scoreHeader}>
                        <Text style={s.subCardTitle}>{c.company_name}</Text>
                        <View style={[s.badge, { backgroundColor: (TREND_STYLE[c.trend] || TREND_STYLE.stable).bg }]}>
                          <Text style={[s.badgeText, { color: (TREND_STYLE[c.trend] || TREND_STYLE.stable).text }]}>
                            {(TREND_STYLE[c.trend] || TREND_STYLE.stable).label}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.subCardMeta}>IDs: {(c.agent_ids || []).join(', ') || '—'}</Text>
                      <Text style={s.subCardMeta}>{c.merchants} merchants · {fmt(c.vol30)} /30d · {fmt(c.vol90)} /90d</Text>
                    </View>
                  ))}

                  {(scorecard.top_merchants || []).length > 0 ? (
                    <View>
                      <Text style={s.fieldLabel}>Top Merchants</Text>
                      {scorecard.top_merchants.slice(0, 5).map((m, i) => (
                        <View key={m.merchant_id || i} style={s.subCard}>
                          <Text style={s.subCardTitle} numberOfLines={1}>{m.dba_name || '—'}</Text>
                          <Text style={s.subCardMeta}>{m.agent_id || ''} · {fmt(m.volume_30_day)} /30d</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
              {!loading && !totals ? <Text style={s.emptySmall}>No scorecard data for this partner</Text> : null}

              {/* Notes */}
              {!loading ? (
                <View>
                  <Text style={s.fieldLabel}>Add Note</Text>
                  <TextInput
                    style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
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
                        {n.is_pinned ? <Text style={s.pin}>📌 Pinned</Text> : null}
                        {n.title ? <Text style={s.noteTitle}>{n.title}</Text> : null}
                        <Text style={s.noteBody}>{n.body}</Text>
                        <View style={s.noteMeta}>
                          <Text style={s.noteAuthor}>{n.author_name || 'Staff'}{n.source === 'ghl' ? ' · GHL' : ''}</Text>
                          <Text style={s.noteDate}>{fmtDate(n.created_at)}</Text>
                        </View>
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
export default function StaffPartnersScreen({ navigation }) {
  const [view, setView]             = useState('list'); // 'list' | 'leaderboard'
  const [partners, setPartners]     = useState([]);
  const [leaders, setLeaders]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingLb, setLoadingLb]   = useState(false);
  const [lbLoaded, setLbLoaded]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery]           = useState('');
  const [selected, setSelected]     = useState(null);

  const loadPartners = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        Api.getPartnersList().catch(() => null),
        Api.getAllStats().catch(() => null),
      ]);
      if (listRes?.success) {
        setPartners(buildPartners(listRes.data, statsRes?.success ? statsRes.data : []));
      }
    } catch (e) { /* fail quietly */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoadingLb(true);
    try {
      const res = await Api.getLeaderboard();
      if (res?.success) { setLeaders(res.data || []); setLbLoaded(true); }
    } catch (e) { /* fail quietly */ }
    setLoadingLb(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadPartners(); }, [loadPartners]);

  function switchView(v) {
    setView(v);
    if (v === 'leaderboard' && !lbLoaded) loadLeaderboard();
  }

  function onRefresh() {
    setRefreshing(true);
    if (view === 'leaderboard') loadLeaderboard();
    else loadPartners();
  }

  const term = query.trim().toLowerCase();
  const filtered = term
    ? partners.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        p.companies.some(c => (c || '').toLowerCase().includes(term)) ||
        p.id_strings.some(idStr => (idStr || '').toLowerCase().includes(term)))
    : partners;

  const isLb = view === 'leaderboard';
  const busy = isLb ? loadingLb : loading;

  return (
    <View style={s.root}>
      {/* Segmented toggle */}
      <View style={s.segmentWrap}>
        <TouchableOpacity style={[s.segment, !isLb && s.segmentActive]} onPress={() => switchView('list')}>
          <Text style={[s.segmentText, !isLb && s.segmentTextActive]}>👥 List</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.segment, isLb && s.segmentActive]} onPress={() => switchView('leaderboard')}>
          <Text style={[s.segmentText, isLb && s.segmentTextActive]}>🏆 Leaderboard</Text>
        </TouchableOpacity>
      </View>

      {/* Search (list view only) */}
      {!isLb ? (
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search partners…"
            placeholderTextColor={COLORS.light}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      <FlatList
        data={isLb ? leaders : filtered}
        keyExtractor={(item, i) => String(isLb ? (item.person_id || i) : item.id)}
        renderItem={({ item }) =>
          isLb ? <LeaderboardRow item={item} /> : <PartnerCard item={item} onPress={setSelected} />
        }
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListFooterComponent={busy && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!busy ? <Text style={s.empty}>{isLb ? 'No leaderboard data' : 'No partners found'}</Text> : null}
      />

      <PartnerDetailModal
        partner={selected}
        onClose={() => setSelected(null)}
        onPortalChanged={loadPartners}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  segmentWrap:   { flexDirection: 'row', margin: 12, marginBottom: 0, backgroundColor: COLORS.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: COLORS.border },
  segment:       { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: COLORS.primary },
  segmentText:   { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  segmentTextActive: { color: '#fff' },
  searchBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 12, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:    { fontSize: 16, marginRight: 6 },
  searchInput:   { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  list:          { paddingHorizontal: 12, paddingBottom: 30, paddingTop: 4 },
  card:          { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, gap: 8 },
  name:          { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 9, fontWeight: '800' },
  metaLine:      { fontSize: 12, color: COLORS.muted, marginBottom: 3 },
  cardBottom:    { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  idCount:       { fontSize: 12, fontWeight: '700', color: COLORS.primary, fontFamily: 'monospace' },
  vol:           { fontSize: 13, fontWeight: '800', color: COLORS.text },
  volSub:        { fontSize: 10, fontWeight: '600', color: COLORS.light },
  growth:        { fontSize: 11, fontWeight: '800' },
  lbRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lbRank:        { fontSize: 16, fontWeight: '900', color: COLORS.primary, minWidth: 36 },
  empty:         { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  emptySmall:    { color: COLORS.muted, fontSize: 12, marginBottom: 8 },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
  modalTitle:    { flex: 1, fontSize: 18, fontWeight: '900', color: COLORS.text },
  modalClose:    { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  contactLine:   { fontSize: 13, color: COLORS.muted, marginBottom: 4 },
  portalRow:     { flexDirection: 'row', gap: 8, marginTop: 12 },
  portalBtn:     { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  portalBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  fieldLabel:    { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  scoreHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox:       { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, width: '31%', flexGrow: 1, alignItems: 'center' },
  statValue:     { fontSize: 15, fontWeight: '900', color: COLORS.text },
  statLabel:     { fontSize: 9, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2 },
  subCard:       { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginBottom: 8 },
  subCardTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.text },
  subCardMeta:   { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  input:         { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 8, backgroundColor: '#fff' },
  primaryBtn:    { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  primaryBtnText:{ color: '#fff', fontSize: 14, fontWeight: '800' },
  noteCard:      { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginBottom: 8 },
  pin:           { fontSize: 10, fontWeight: '800', color: COLORS.warning, marginBottom: 3 },
  noteTitle:     { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 3 },
  noteBody:      { fontSize: 13, color: COLORS.text, lineHeight: 18, marginBottom: 6 },
  noteMeta:      { flexDirection: 'row', justifyContent: 'space-between' },
  noteAuthor:    { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  noteDate:      { fontSize: 11, color: COLORS.light },
});
