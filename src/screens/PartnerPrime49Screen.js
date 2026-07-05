import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Prime49 } from '../api';

function money(n) {
  const num = parseFloat(n);
  if (n == null || isNaN(num)) return '—';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function money0(n) {
  const num = parseFloat(n);
  if (n == null || isNaN(num)) return '$0';
  return `$${Math.round(num).toLocaleString()}`;
}

export default function PartnerPrime49Screen() {
  const [residuals, setResiduals]   = useState(null);
  const [eligible, setEligible]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requested, setRequested]   = useState({}); // merchant_uuid -> true

  async function load() {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([
        Prime49.getResiduals().catch(() => null),
        Prime49.getEligible().catch(() => null),
      ]);
      if (r?.success) setResiduals(r.data || null);
      if (e?.success) setEligible(e.data || null);
    } catch (err) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function requestEnroll(row) {
    Alert.alert(
      'Request Prime49 Enrollment',
      `Submit an enrollment request for ${row.dba_name || 'this merchant'}? Our team will review and follow up.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request', onPress: async () => {
          try {
            const res = await Prime49.requestEnrollment({
              merchant_uuid: row.merchant_uuid,
              dba_name: row.dba_name,
              merchant_id: row.merchant_id,
            });
            if (res.success) {
              setRequested(prev => ({ ...prev, [row.merchant_uuid]: true }));
              Alert.alert('Requested', 'Your enrollment request was submitted as a support ticket.');
            } else {
              Alert.alert('Error', res.message || res.error || 'Could not submit request.');
            }
          } catch (e) { Alert.alert('Error', 'Could not submit request.'); }
        }},
      ]
    );
  }

  const res = residuals || {};
  const elig = eligible || {};
  const rows = res.rows || [];
  const eRows = elig.rows || [];

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
    >
      <View style={s.disclaimer}>
        <Text style={s.disclaimerText}>💎 Estimated residuals for your Prime49 merchants. Figures are estimates for reference only and may differ from final statements.</Text>
      </View>

      {loading && !residuals
        ? <ActivityIndicator color={COLORS.primary} style={{ margin: 40 }} />
        : (
          <>
            {/* KPI tiles */}
            <View style={s.kpiRow}>
              <View style={s.kpi}>
                <Text style={s.kpiVal}>{money(res.total_payout)}</Text>
                <Text style={s.kpiLabel}>Est. Payout / mo</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiVal}>{money(res.total_volume)}</Text>
                <Text style={s.kpiLabel}>Volume (30d)</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiVal}>{res.merchant_count ?? 0}</Text>
                <Text style={s.kpiLabel}>Prime49 Merchants</Text>
              </View>
            </View>

            {/* Residuals list */}
            <Text style={s.sectionTitle}>My Residuals</Text>
            {rows.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>
                  {res.has_prime49
                    ? 'Your Prime49 merchants have no earning volume in the last 30 days yet.'
                    : 'You have no Prime49 merchants yet. See the upgrade opportunities below.'}
                </Text>
              </View>
            ) : (
              rows.map((r, i) => (
                <View key={r.merchant_id || i} style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName} numberOfLines={1}>{r.dba_name || '—'}</Text>
                    <Text style={s.rowMeta}>
                      MID {r.merchant_id || '—'} · {money(r.volume_30d)} vol · {r.rev_share != null ? `${r.rev_share}%` : '—'}
                    </Text>
                  </View>
                  <Text style={s.rowValue}>{money(r.residual)}</Text>
                </View>
              ))
            )}

            {/* Upgrade opportunities */}
            {eRows.length > 0 && (
              <>
                <View style={s.oppHeader}>
                  <Text style={s.sectionTitle}>Upgrade Opportunities</Text>
                  <Text style={s.oppSub}>{elig.count || eRows.length} eligible · {money0(elig.potential_total)}/mo potential</Text>
                </View>
                {eRows.map((r, i) => {
                  const done = requested[r.merchant_uuid];
                  return (
                    <View key={r.merchant_uuid || i} style={s.oppRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{r.dba_name || '—'}</Text>
                        <Text style={s.rowMeta}>{money(r.volume_30d)} vol · ~{money(r.potential)}/mo potential</Text>
                      </View>
                      <TouchableOpacity
                        style={[s.enrollBtn, done && s.enrollBtnDone]}
                        onPress={() => !done && requestEnroll(r)}
                        disabled={done}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.enrollText, done && s.enrollTextDone]}>{done ? '✓ Requested' : 'Request'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )
      }
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { padding: 16, paddingBottom: 40 },
  disclaimer:  { backgroundColor: '#eef2fb', borderRadius: 12, padding: 12, marginBottom: 16 },
  disclaimerText: { fontSize: 12.5, color: '#3b4a63', lineHeight: 18 },
  kpiRow:      { flexDirection: 'row', gap: 10, marginBottom: 8 },
  kpi:         { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kpiVal:      { fontSize: 18, fontWeight: '900', color: COLORS.text },
  kpiLabel:    { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 4, textAlign: 'center' },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 22 },
  emptyCard:   { backgroundColor: COLORS.card, borderRadius: 12, padding: 16 },
  emptyText:   { fontSize: 13, color: COLORS.muted, lineHeight: 19, textAlign: 'center' },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  rowName:     { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowMeta:     { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  rowValue:    { fontSize: 15, fontWeight: '900', color: COLORS.success },
  oppHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  oppSub:      { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 10, marginTop: 22 },
  oppRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  enrollBtn:   { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  enrollBtnDone: { backgroundColor: '#d1fae5' },
  enrollText:  { color: '#fff', fontSize: 13, fontWeight: '800' },
  enrollTextDone: { color: '#059669' },
});
