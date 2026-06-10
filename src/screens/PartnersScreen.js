import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { COLORS } from '../config';
import { Partners } from '../api';

const TIER_COLORS = {
  gold:     { bg: '#fef3c7', text: '#d97706' },
  silver:   { bg: '#f1f5f9', text: '#64748b' },
  bronze:   { bg: '#fde8d8', text: '#b45309' },
  platinum: { bg: '#e0f2fe', text: '#0369a1' },
};

function tierStyle(tier) {
  return TIER_COLORS[(tier || '').toLowerCase()] || { bg: COLORS.bg, text: COLORS.muted };
}

function fmt$(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function AgentCard({ item, onPress }) {
  const ts = tierStyle(item.tier);
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <View style={s.rankBadge}>
          <Text style={s.rankText}>#{item.rank ?? '—'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.agentName} numberOfLines={1}>{item.name || '—'}</Text>
          <Text style={s.companyName} numberOfLines={1}>{item.company_name || ''}</Text>
        </View>
        {item.tier ? (
          <View style={[s.tierBadge, { backgroundColor: ts.bg }]}>
            <Text style={[s.tierText, { color: ts.text }]}>{item.tier.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.cardStats}>
        <View style={s.stat}>
          <Text style={s.statNum}>{item.merchant_count ?? '—'}</Text>
          <Text style={s.statLabel}>Merchants</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statNum}>{fmt$(item.volume_30_day)}</Text>
          <Text style={s.statLabel}>30-Day Vol</Text>
        </View>
        <View style={s.stat}>
          <Text style={[s.statNum, { color: item.growth_pct >= 0 ? COLORS.success : COLORS.danger }]}>
            {item.growth_pct != null ? `${item.growth_pct > 0 ? '+' : ''}${Number(item.growth_pct).toFixed(1)}%` : '—'}
          </Text>
          <Text style={s.statLabel}>Growth</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ScorecardModal({ agent, visible, onClose }) {
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (visible && agent?.person_id) {
      setLoading(true);
      Partners.getScorecard(agent.person_id)
        .then(d => setScorecard(d.scorecard || null))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setScorecard(null);
    }
  }, [visible, agent]);

  if (!agent) return null;
  const totals = scorecard?.totals || {};

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{agent.name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Rank</Text>
              <Text style={s.metaValue}>#{agent.rank ?? '—'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Tier</Text>
              <Text style={s.metaValue}>{agent.tier || '—'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Merchants</Text>
              <Text style={s.metaValue}>{agent.merchant_count ?? '—'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>30-Day Volume</Text>
              <Text style={s.metaValue}>{fmt$(agent.volume_30_day)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>90-Day Volume</Text>
              <Text style={s.metaValue}>{fmt$(agent.volume_90_day)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Growth</Text>
              <Text style={[s.metaValue, { color: agent.growth_pct >= 0 ? COLORS.success : COLORS.danger }]}>
                {agent.growth_pct != null ? `${agent.growth_pct > 0 ? '+' : ''}${Number(agent.growth_pct).toFixed(1)}%` : '—'}
              </Text>
            </View>

            {loading && <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} />}

            {scorecard && (
              <>
                <Text style={s.sectionTitle}>Scorecard Totals</Text>
                {Object.entries(totals).map(([k, v]) => (
                  <View key={k} style={s.metaRow}>
                    <Text style={s.metaLabel}>{k.replace(/_/g, ' ')}</Text>
                    <Text style={s.metaValue}>{typeof v === 'number' ? v.toLocaleString() : String(v)}</Text>
                  </View>
                ))}

                {scorecard.top_merchants?.length > 0 && (
                  <>
                    <Text style={s.sectionTitle}>Top Merchants</Text>
                    {scorecard.top_merchants.slice(0, 5).map((m, i) => (
                      <View key={i} style={s.metaRow}>
                        <Text style={s.metaLabel} numberOfLines={1}>{m.dba_name || m.merchant_id}</Text>
                        <Text style={s.metaValue}>{fmt$(m.volume)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function PartnersScreen() {
  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const d = await Partners.getLeaderboard();
      setAgents(d.data || []);
      setTotalCount(d.total ?? (d.data || []).length);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <View style={s.container}>
      <View style={s.metricsRow}>
        <View style={[s.metric, { borderLeftColor: COLORS.primary }]}>
          <Text style={[s.metricNum, { color: COLORS.primary }]}>{totalCount}</Text>
          <Text style={s.metricLabel}>Total Partners</Text>
        </View>
      </View>

      {loading
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
        : <FlatList
            data={agents}
            keyExtractor={item => String(item.person_id || item.agent_id)}
            renderItem={({ item }) => <AgentCard item={item} onPress={setSelected} />}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
            ListEmptyComponent={<Text style={s.empty}>No partners found</Text>}
          />
      }

      <ScorecardModal
        agent={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  metricsRow:  { flexDirection: 'row', padding: 14, paddingBottom: 4 },
  metric:      { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  metricNum:   { fontSize: 22, fontWeight: '900' },
  metricLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  list:        { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  rankBadge:   { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryDk, alignItems: 'center', justifyContent: 'center' },
  rankText:    { color: '#fff', fontSize: 12, fontWeight: '800' },
  agentName:   { fontSize: 14, fontWeight: '700', color: COLORS.text },
  companyName: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  tierBadge:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tierText:    { fontSize: 10, fontWeight: '800' },
  cardStats:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  stat:        { flex: 1, alignItems: 'center' },
  statNum:     { fontSize: 14, fontWeight: '800', color: COLORS.text },
  statLabel:   { fontSize: 10, color: COLORS.muted, fontWeight: '600', marginTop: 2 },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40 },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 10 },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  metaLabel:   { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  metaValue:   { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  sectionTitle:{ fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 4 },
});
