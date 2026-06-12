import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { COLORS } from '../../config';
import { staffRequest } from '../../staff-api';
import { Storage } from '../../storage';

// POST /api/search { q, userid } → { success, results: { merchants, partners,
// agent_ids, tickets, equipment, deployments, returns, tasks } }
async function runSearch(q) {
  const raw = await Storage.get('staff_user');
  const me = raw ? JSON.parse(raw) : {};
  return staffRequest('/api/search', { q, userid: me.userid });
}

const GROUPS = [
  { key: 'merchants',   title: '🏪 Merchants',   line1: r => r.dba_name,        line2: r => `MID ${r.merchant_id || '—'} · ${r.account_status || '—'}${r.merchant_city ? ` · ${r.merchant_city}, ${r.merchant_state || ''}` : ''}` },
  { key: 'partners',    title: '🤝 Partners',    line1: r => r.full_name,       line2: r => [r.email, (r.agent_ids || []).join(', ')].filter(Boolean).join(' · ') },
  { key: 'agent_ids',   title: '🆔 Agent IDs',   line1: r => r.id_string,       line2: r => r.partner_name ? `${r.partner_name}${r.partner_email ? ` · ${r.partner_email}` : ''}` : 'Unlinked' },
  { key: 'tickets',     title: '🎫 Tickets',     line1: r => r.ticket_number ? `${r.ticket_number} — ${r.subject || ''}` : r.subject, line2: r => `${r.status || '—'} · ${r.priority || 'normal'}` },
  { key: 'equipment',   title: '📦 Equipment',   line1: r => r.serial_number,   line2: r => `${r.terminal_type || '—'} · ${r.status || '—'} · ${r.current_location || '—'}` },
  { key: 'deployments', title: '🚚 Deployments', line1: r => r.deployment_id || r.tracking_id || `#${r.id}`, line2: r => [r.merchant_name, r.status, r.tid ? `TID ${r.tid}` : null].filter(Boolean).join(' · ') },
  { key: 'returns',     title: '↩️ Returns',     line1: r => r.return_id,       line2: r => [r.merchant_name, r.status, r.return_reason].filter(Boolean).join(' · ') },
  { key: 'tasks',       title: '✅ Tasks',       line1: r => r.title,           line2: r => [r.status, r.assigned_to, r.merchant_name].filter(Boolean).join(' · ') },
];

const HIDDEN_KEYS = new Set(['_matchedBy']);

function DetailModal({ item, onClose }) {
  if (!item) return null;
  const entries = Object.entries(item.row)
    .filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && v !== '' && typeof v !== 'object');
  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={2}>{item.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            {entries.map(([k, v]) => (
              <View key={k} style={s.detailRow}>
                <Text style={s.detailLabel}>{k.replace(/_/g, ' ')}</Text>
                <Text style={s.detailValue}>{String(v)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function StaffSearchScreen() {
  const [query, setQuery]       = useState('');
  const [sections, setSections] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState(null);
  const debounceRef = useRef(null);
  const seqRef = useRef(0);

  function onChange(text) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSections([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(text.trim()), 450);
  }

  async function search(q) {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const res = await runSearch(q);
      if (seq !== seqRef.current) return; // stale response
      if (res.success && res.results) {
        const secs = GROUPS
          .map(g => ({ ...g, data: res.results[g.key] || [] }))
          .filter(g => g.data.length > 0);
        setSections(secs);
      } else {
        setSections([]);
      }
      setSearched(true);
    } catch (e) {
      if (seq === seqRef.current) { setSections([]); setSearched(true); }
    }
    if (seq === seqRef.current) setLoading(false);
  }

  return (
    <View style={s.root}>
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search merchants, partners, serials, tickets…"
          placeholderTextColor={COLORS.light}
          value={query}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => query.trim().length >= 2 && search(query.trim())}
        />
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, i) => String(item.id || item.id_string || i)}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionHeader}>{section.title} ({section.data.length})</Text>
        )}
        renderItem={({ item, section }) => (
          <TouchableOpacity
            style={s.card}
            activeOpacity={0.75}
            onPress={() => setSelected({ title: section.line1(item) || section.title, row: item })}
          >
            <Text style={s.line1} numberOfLines={1}>{section.line1(item) || '—'}</Text>
            <Text style={s.line2} numberOfLines={1}>{section.line2(item) || ''}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          !loading && searched
            ? <Text style={s.empty}>No results for “{query.trim()}”</Text>
            : !searched
              ? <Text style={s.empty}>Type at least 2 characters to search everything: merchants, partners, agent IDs, tickets, serials, deployments, returns and tasks.</Text>
              : null
        }
      />

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  searchBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 12, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:    { fontSize: 16, marginRight: 6 },
  searchInput:   { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  list:          { paddingHorizontal: 12, paddingBottom: 30 },
  sectionHeader: { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  card:          { backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  line1:         { fontSize: 14, fontWeight: '800', color: COLORS.text },
  line2:         { fontSize: 12, color: COLORS.muted, marginTop: 3 },
  empty:         { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 13, lineHeight: 20 },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:    { flex: 1, fontSize: 17, fontWeight: '900', color: COLORS.text },
  modalClose:    { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  detailLabel:   { fontSize: 12, color: COLORS.muted, fontWeight: '700', textTransform: 'capitalize' },
  detailValue:   { fontSize: 12, color: COLORS.text, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
});
