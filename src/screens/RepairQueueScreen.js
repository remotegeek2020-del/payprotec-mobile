import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Equipments } from '../api';

// Stages tracked by the backend's repair queue summary
const REPAIR_STAGES = ['Received', 'Diagnosis', 'Under Repair', 'Testing'];

const STAGE_COLORS = {
  'Received':     { bg: '#dbeafe', text: '#2563eb' },
  'Diagnosis':    { bg: '#fef3c7', text: '#d97706' },
  'Under Repair': { bg: '#fee2e2', text: '#dc2626' },
  'Testing':      { bg: '#d1fae5', text: '#059669' },
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RepairCard({ item, critical, onOpen }) {
  const stageC = STAGE_COLORS[item.repair_stage] || { bg: '#f1f5f9', text: '#64748b' };
  return (
    <TouchableOpacity style={[s.card, critical && s.cardCritical]} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <Text style={s.serial}>{item.serial_number || '—'}</Text>
        <View style={[s.stageBadge, { backgroundColor: stageC.bg }]}>
          <Text style={[s.stageText, { color: stageC.text }]}>{(item.repair_stage || 'RECEIVED').toUpperCase()}</Text>
        </View>
      </View>
      <Text style={s.terminalType} numberOfLines={1}>{item.terminal_type || '—'}</Text>
      <View style={s.cardBottom}>
        <Text style={[s.days, critical && { color: COLORS.danger }]}>
          ⏱ {item.days_in_repair ?? '—'} days in repair{critical ? ' • CRITICAL' : ''}
        </Text>
      </View>
      {item.repair_notes ? <Text style={s.notes} numberOfLines={1}>{item.repair_notes}</Text> : null}
    </TouchableOpacity>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

function RepairDetailModal({ item, onClose, onChanged }) {
  const [stage, setStage]         = useState(null);
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [closing, setClosing]     = useState(false);

  useEffect(() => {
    setStage(item?.repair_stage || null);
    setNotes('');
    setSaving(false);
    setClosing(false);
  }, [item?.id]);

  if (!item) return null;

  async function submitLog() {
    if (!stage) { Alert.alert('Required', 'Select a repair stage.'); return; }
    setSaving(true);
    try {
      const res = await Equipments.logRepairAction(item.id, stage, notes.trim() || undefined);
      if (res.success) {
        onChanged();
      } else {
        Alert.alert('Error', res.error || res.message || 'Could not log repair action.');
      }
    } catch {
      Alert.alert('Error', 'Could not log repair action. Check your connection.');
    }
    setSaving(false);
  }

  function confirmClose(outcome) {
    const isScrap = outcome === 'scrap';
    Alert.alert(
      isScrap ? 'Scrap unit?' : 'Return to stock?',
      isScrap
        ? `${item.serial_number} will be decommissioned and moved to Retired.`
        : `${item.serial_number} will be marked stocked and moved to Warsaw Office.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isScrap ? 'Scrap' : 'Back to Stock',
          style: isScrap ? 'destructive' : 'default',
          onPress: async () => {
            setClosing(true);
            try {
              const res = await Equipments.closeRepair(item.id, outcome);
              if (res.success) onChanged();
              else Alert.alert('Error', res.error || res.message || 'Could not close repair.');
            } catch {
              Alert.alert('Error', 'Could not close repair. Check your connection.');
            }
            setClosing(false);
          },
        },
      ],
    );
  }

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{item.serial_number || 'Repair'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <DetailRow label="Terminal Type"  value={item.terminal_type} />
              <DetailRow label="Stage"          value={item.repair_stage} />
              <DetailRow label="Condition"      value={item.condition} />
              <DetailRow label="Days in Repair" value={item.days_in_repair} />
              <DetailRow label="Received"       value={formatDate(item.received_date)} />
              <DetailRow label="Repair Notes"   value={item.repair_notes} />

              <Text style={s.sectionLabel}>Update Stage</Text>
              {REPAIR_STAGES.map(st => {
                const active = stage === st;
                return (
                  <TouchableOpacity key={st} style={[s.stageChip, active && s.stageChipActive]} onPress={() => setStage(st)}>
                    <Text style={[s.stageChipText, active && s.stageChipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={s.sectionLabel}>Notes (optional)</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="What was done?"
                placeholderTextColor={COLORS.light}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <TouchableOpacity
                style={[s.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={submitLog}
                disabled={saving || closing}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Log Repair Action</Text>}
              </TouchableOpacity>

              <Text style={s.sectionLabel}>Close Repair</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[s.successBtn, closing && { opacity: 0.6 }]}
                  onPress={() => confirmClose('repaired')}
                  disabled={saving || closing}
                >
                  <Text style={s.primaryBtnText}>✓ Back to Stock</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.dangerBtn, closing && { opacity: 0.6 }]}
                  onPress={() => confirmClose('scrap')}
                  disabled={saving || closing}
                >
                  <Text style={s.primaryBtnText}>🗑 Scrap</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function RepairQueueScreen() {
  const [results, setResults]       = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]     = useState(null);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await Equipments.listRepairQueue();
      if (data.success) {
        setResults(data.data || []);
        setSummary(data.summary || null);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  function handleChanged() {
    setSelected(null);
    load();
  }

  const threshold = summary?.critical_threshold_days ?? 14;

  return (
    <View style={s.container}>
      {/* Summary metrics */}
      <View style={s.metricsRow}>
        <View style={[s.metric, { borderLeftColor: COLORS.primary }]}>
          <Text style={[s.metricNum, { color: COLORS.primary }]}>{summary?.total ?? '—'}</Text>
          <Text style={s.metricLabel}>In Repair</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.danger }]}>
          <Text style={[s.metricNum, { color: COLORS.danger }]}>{summary?.critical_count ?? '—'}</Text>
          <Text style={s.metricLabel}>Critical ({threshold}d+)</Text>
        </View>
        <View style={[s.metric, { borderLeftColor: COLORS.warning }]}>
          <Text style={[s.metricNum, { color: COLORS.warning }]}>{summary?.avg_days_in_repair ?? '—'}</Text>
          <Text style={s.metricLabel}>Avg Days</Text>
        </View>
      </View>

      {/* Stage counts */}
      {summary?.stage_counts ? (
        <View style={s.stageRow}>
          {REPAIR_STAGES.map(st => (
            <View key={st} style={s.stagePill}>
              <Text style={s.stagePillNum}>{summary.stage_counts[st] ?? 0}</Text>
              <Text style={s.stagePillLabel}>{st}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <RepairCard item={item} critical={(item.days_in_repair ?? 0) >= threshold} onOpen={setSelected} />
          )}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
          ListEmptyComponent={<Text style={s.empty}>Repair queue is empty 🎉</Text>}
        />
      )}

      <RepairDetailModal item={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  metricsRow:  { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 4 },
  metric:      { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  metricNum:   { fontSize: 22, fontWeight: '900' },
  metricLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase' },
  stageRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  stagePill:   { flex: 1, backgroundColor: COLORS.card, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  stagePillNum:{ fontSize: 15, fontWeight: '900', color: COLORS.text },
  stagePillLabel:{ fontSize: 8, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  list:        { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 30 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardCritical:{ borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  serial:      { fontSize: 14, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  stageBadge:  { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  stageText:   { fontSize: 10, fontWeight: '800' },
  terminalType:{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between' },
  days:        { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  notes:       { fontSize: 11, color: COLORS.light, marginTop: 4 },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },

  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.primary, fontFamily: 'monospace' },
  modalClose:  { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  detailValue: { fontSize: 12, color: COLORS.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  sectionLabel:{ fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  stageChip:   { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 8, backgroundColor: '#fff' },
  stageChipActive: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  stageChipText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  stageChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  input:       { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 4, backgroundColor: '#fff' },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  successBtn:  { flex: 1, backgroundColor: COLORS.success, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  dangerBtn:   { flex: 1, backgroundColor: COLORS.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
});
