import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { COLORS } from '../config';

function Row({ label, value, onPress }) {
  return value ? (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Text style={[s.rowValue, onPress && { color: COLORS.primary, textDecorationLine: 'underline' }]}>{value}</Text>
      </TouchableOpacity>
    </View>
  ) : null;
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

export default function MerchantDetailScreen({ route }) {
  const m = route.params?.merchant || {};
  const location = [m.merchant_address, m.merchant_city, m.merchant_state, m.merchant_zip].filter(Boolean).join(', ');

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(m.dba_name || '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{m.dba_name || '—'}</Text>
        <Text style={s.mid}>{m.merchant_id || ''}</Text>
      </View>

      <Section title="Business Info">
        <Row label="Legal Name"    value={m.legal_name} />
        <Row label="MID"           value={m.merchant_id} />
        <Row label="Status"        value={m.status} />
        <Row label="Agent"         value={m.agent_name} />
      </Section>

      <Section title="Contact">
        <Row label="Phone"  value={m.merchant_phone} onPress={() => m.merchant_phone && Linking.openURL(`tel:${m.merchant_phone}`)} />
        <Row label="Email"  value={m.email}          onPress={() => m.email && Linking.openURL(`mailto:${m.email}`)} />
      </Section>

      <Section title="Location">
        <Row label="Address" value={location || null} />
        <Row label="Country" value={m.merchant_country} />
      </Section>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  content:      { paddingBottom: 40 },
  header:       { backgroundColor: COLORS.primaryDk, padding: 28, alignItems: 'center', paddingTop: 36 },
  avatar:       { width: 64, height: 64, borderRadius: 16, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:   { color: COLORS.primaryDk, fontSize: 28, fontWeight: '900' },
  name:         { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  mid:          { color: 'rgba(255,255,255,.5)', fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  section:      { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  sectionCard:  { backgroundColor: COLORS.card, borderRadius: 12, overflow: 'hidden' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel:     { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  rowValue:     { fontSize: 13, color: COLORS.text, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
});
