import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, TextInput, Alert,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';

const STAGES = ['Received', 'Diagnosis', 'Under Repair', 'Testing'];

const STAGE_COLORS = {
  received:       { bg: '#dbeafe', text: '#1d4ed8' },
  diagnosis:      { bg: '#fef3c7', text: '#d97706' },
  'under repair': { bg: '#fee2e2', text: '#dc2626' },
  testing:        { bg: '#d1fae5', text: '#059669' },
};

function stageColor(stage) {
  return STAGE_COLORS[(stage || 'received').toLowerCase()] || STAGE_COLORS.received;
}

const RepairApi = {
  list:      ()                                       => staffRequest('/api/equipments', { action: 'list_repair_queue' }),
  logAction: (equipment_id, repair_stage, repair_notes) => staffRequest('/api/equipments', { action: 'log_repair_action', equipment_id, repair_stage, repair_notes }),
  close:     (equipment_id, outcome)                  => staffRequest('/api/equipments', { action: 'close_repair', equipment_id, outcome }),
};

function DetailModal({ item, onClose, onChanged }) {
  const [stage, setStage] = useState(item?.repair_stage || 'Received');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStage(item?.repair_stage || 'Received');
    setNotes('');
  }, [item?.id]);

  if (!item) return null;

  async function logAction() {
    setSaving(true);
    try {
      const combined = notes.trim()
        ? `${item.repair_notes ? item.repair_notes + '\n' : ''}[${new Date().toLocaleDateString()}] ${notes.trim()}`
        : item.repair_notes;
      const res = await RepairApi.logAction(item.id, stage, combined);
      if (res.success) { onChanged(); onClose(); }
      else Alert.alert('Error', res.message || res.error || 'Could not log action.');
    } catch (e) { Alert.alert('Error', 'Could not log action.'); }
    setSaving(false);
  }

  function close(outcome) {
    const label = outcome === 'scrap' ? 'Scrap (decommission)' : 'Repaired (back to stock)';
    Alert.alert('Close Repair', `Close this repair as: ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: outcome === 'scrap' ? 'destructive' : 'default', onPress: async () => {
        try {
          const res = await RepairApi.close(item.id, outcome);
          if (res.success) { onChanged(); onClose(); }
          else Alert.alert('Error', res.message || res.error || 'Could not close repair.');
        } catch (e) { Alert.alert('Error', 'Could not close repair.'); }
      }},
    ]);
  }

  const sc = stageColor(item.repair_stage);

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>{item.serial_number}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <View style={[s.badge, { backgroundColor: sc.bg }]}>
                <Text style={[s.badgeText, { color: sc.text }]}>{(item.repair_stage || 'Received').toUpperCase()}</Text>
              </View>
              {item.days_in_repair != null && (
                <View style={[s.badge, { backgroundColor: item.days_in_repair > 14 ? '#fee2e2' : '#f1f5f9' }]}>
                  <Text style={[s.badgeText, { color: item.days_in_repair > 14 ? '#dc2626' : '#64748b' }]}>
                    {item.days_in_repair} DAYS
                  </Text>
                </View>
              )}
            </View>

            {[
              ['Terminal', item.terminal_type],
              ['Status', item.status],
              ['Condition', item.condition],
              ['Received', item.received_date ? new Date(item.received_date).toLocaleDateString() : null],
            ].filter(([, v]) => v).map(([label, value]) => (
              <View key={label} style={s.detailRow}>
                <Text style={s.detailLabel}>{label}</Text>
                <Text style={s.detailValue}>{value}</Text>
              </View>
            ))}

            {item.repair_notes ? (
              <>
                <Text style={s.fieldLabel}>Repair History</Text>
                <View style={s.notesBox}>
                  <Text style={s.notesText}>{item.repair_notes}</Text>
                </View>
              </>
            ) : null}

            <Text style={s.fieldLabel}>Stage</Text>
            <View style={s.chipRow}>
              {STAGES.map(st => (
                <TouchableOpacity key={st} style={[s.chip, stage === st && s.chipActive]} onPress={() => setStage(st)}>
                  <Text style={[s.chipText, stage === st && s.chipTextActive]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Add Note</Text>
            <TextInput
              style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
              placeholder="What was done? (optional)"
              placeholderTextColor={COLORS.light}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.6 }]} onPress={logAction} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Log Repair Action</Text>}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[s.outcomeBtn, { backgroundColor: '#d1fae5' }]} onPress={() => close('repaired')}>
                <Text style={[s.outcomeText, { color: '#059669' }]}>✓ Repaired</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.outcomeBtn, { backgroundColor: '#fee2e2' }]} onPress={() => close('scrap')}>
                <Text style={[s.outcomeText, { color: '#dc2626' }]}>🗑 Scrap</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function StaffRepairQueueScreen() {
  const [items, setItems]         = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [stageFilter, setStageFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await RepairApi.list();
      if (res.success) {
        setItems(res.data || []);
        setSummary(res.summary || null);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = stageFilter
    ? items.filter(i => (i.repair_stage || 'Received') === stageFilter)
    : items;

  return (
    <View style={s.root}>
      {summary && (
        <View style={s.summaryRow}>
          <View style={s.sumCard}><Text style={s.sumValue}>{summary.total}</Text><Text style={s.sumLabel}>In Repair</Text></View>
          <View style={s.sumCard}><Text style={[s.sumValue, summary.critical_count > 0 && { color: COLORS.danger }]}>{summary.critical_count}</Text><Text style={s.sumLabel}>Critical {'>'}{summary.critical_threshold_days}d</Text></View>
          <View style={s.sumCard}><Text style={s.sumValue}>{summary.avg_days_in_repair}d</Text><Text style={s.sumLabel}>Avg Days</Text></View>
        </View>
      )}

      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
          <TouchableOpacity style={[s.chip, !stageFilter && s.chipActive]} onPress={() => setStageFilter('')}>
            <Text style={[s.chipText, !stageFilter && s.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {STAGES.map(st => (
            <TouchableOpacity key={st} style={[s.chip, stageFilter === st && s.chipActive]} onPress={() => setStageFilter(stageFilter === st ? '' : st)}>
              <Text style={[s.chipText, stageFilter === st && s.chipTextActive]}>
                {st}{summary?.stage_counts?.[st] != null ? ` (${summary.stage_counts[st]})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => {
          const sc = stageColor(item.repair_stage);
          const critical = item.days_in_repair != null && item.days_in_repair > (summary?.critical_threshold_days || 14);
          return (
            <TouchableOpacity style={[s.card, critical && s.cardCritical]} onPress={() => setSelected(item)} activeOpacity={0.8}>
              <View style={s.cardTop}>
                <Text style={s.serial} numberOfLines={1}>{item.serial_number || '—'}</Text>
                <View style={[s.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.badgeText, { color: sc.text }]}>{(item.repair_stage || 'Received').toUpperCase()}</Text>
                </View>
              </View>
              <View style={s.cardBottom}>
                <Text style={s.meta}>{item.terminal_type || '—'}</Text>
                {item.days_in_repair != null && (
                  <Text style={[s.days, critical && { color: COLORS.danger }]}>{item.days_in_repair}d in repair</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>Repair queue is empty 🎉</Text> : null}
      />

      <DetailModal item={selected} onClose={() => setSelected(null)} onChanged={load} />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  summaryRow:  { flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 4 },
  sumCard:     { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  sumValue:    { fontSize: 18, fontWeight: '900', color: COLORS.text },
  sumLabel:    { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2 },
  filterBar:   { paddingVertical: 8 },
  list:        { paddingHorizontal: 12, paddingBottom: 30 },
  card:        { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardCritical:{ borderLeftWidth: 4, borderLeftColor: COLORS.danger },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  serial:      { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text, fontFamily: 'monospace' },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between' },
  meta:        { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  days:        { fontSize: 12, color: COLORS.light, fontWeight: '700' },
  badge:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 10, fontWeight: '800' },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:  { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.text, fontFamily: 'monospace' },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  detailValue: { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  fieldLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  notesBox:    { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12 },
  notesText:   { fontSize: 13, color: COLORS.text, lineHeight: 19 },
  chipRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chipTextActive: { color: '#fff' },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: '#fff' },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  outcomeBtn:  { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  outcomeText: { fontSize: 14, fontWeight: '800' },
});
