import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
  Linking, Modal, Alert,
} from 'react-native';
import { COLORS } from '../config';
import { Dashboard, Merchants } from '../api';

const STATUS_COLORS = {
  approved:     { bg: '#d1fae5', text: '#059669' },
  pending:      { bg: '#fef3c7', text: '#d97706' },
  enrollment:   { bg: '#dbeafe', text: '#1d4ed8' },
  declined:     { bg: '#fee2e2', text: '#dc2626' },
  closed:       { bg: '#f1f5f9', text: '#64748b' },
  collections:  { bg: '#fce7f3', text: '#9d174d' },
  fraud:        { bg: '#fee2e2', text: '#7f1d1d' },
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

function MerchantCard({ item, onPress }) {
  const sc = statusColor(item.account_status);
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={s.cardTop}>
        <Text style={s.dba} numberOfLines={1}>{item.dba_name || '—'}</Text>
        <View style={[s.badge, { backgroundColor: sc.bg }]}>
          <Text style={[s.badgeText, { color: sc.text }]}>
            {(item.account_status || 'Pending').toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={s.cardMid}>
        <Text style={s.mid}>MID: {item.merchant_id || '—'}</Text>
        {item.merchant_city ? <Text style={s.meta}>{item.merchant_city}{item.merchant_state ? `, ${item.merchant_state}` : ''}</Text> : null}
        {item.is_prime49 ? (
          <View style={s.prime49}><Text style={s.prime49Text}>💎 PRIME49</Text></View>
        ) : (parseFloat(item.volume_30_day) >= 30000 ? (
          <View style={s.prime49Elig}><Text style={s.prime49EligText}>PRIME49 ELIGIBLE</Text></View>
        ) : null)}
      </View>
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

function MerchantDetailModal({ item, onClose }) {
  if (!item) return null;
  const sc = statusColor(item.account_status);

  return (
    <Modal visible={!!item} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={2}>{item.dba_name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <View style={[s.badge, { backgroundColor: sc.bg }]}>
                <Text style={[s.badgeText, { color: sc.text }]}>{(item.account_status || '—').toUpperCase()}</Text>
              </View>
            </View>

            {[
              ['MID',           item.merchant_id],
              ['DBA Name',      item.dba_name],
              ['City',          item.merchant_city],
              ['State',         item.merchant_state],
              ['Phone',         item.merchant_phone],
              ['Email',         item.email],
              ['Enrolled',      item.enrollment_date],
              ['Last Batch',    item.last_batch_date],
              ['30-Day Vol',    fmt(item.volume_30_day)],
              ['90-Day Vol',    fmt(item.volume_90_day)],
              ['MTD Vol',       fmt(item.volume_mtd)],
            ].filter(([, v]) => v).map(([label, value]) => (
              <View key={label} style={s.detailRow}>
                <Text style={s.detailLabel}>{label}</Text>
                <Text style={s.detailValue}>{value}</Text>
              </View>
            ))}

            {item.merchant_phone ? (
              <TouchableOpacity style={s.callFullBtn} onPress={() => Linking.openURL(`tel:${item.merchant_phone}`)}>
                <Text style={s.callFullText}>📞  Call Merchant</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function MerchantsScreen() {
  const [identifiers, setIdentifiers]   = useState([]);
  const [activeId, setActiveId]         = useState(null);
  const [merchants, setMerchants]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [selected, setSelected]         = useState(null);
  const [query, setQuery]               = useState('');

  async function loadIdentifiers() {
    const res = await Dashboard.getScorecard();
    const ids = (res.identifiers || []).map(id => ({
      id:        id.id,
      id_string: id.id_string || '—',
      company:   id.company_name || '',
    }));
    setIdentifiers(ids);
    if (ids.length > 0) {
      setActiveId(ids[0].id_string);
      loadMerchants(ids[0].id_string);
    }
  }

  async function loadMerchants(id_string) {
    setLoading(true);
    try {
      const res = await Merchants.getByIdentifier(id_string);
      setMerchants(res.data || res.merchants || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }

  function onRefresh() {
    setRefreshing(true);
    if (activeId) loadMerchants(activeId);
    else loadIdentifiers();
  }

  useEffect(() => { loadIdentifiers(); }, []);

  function selectId(id) {
    setActiveId(id);
    setQuery('');
    loadMerchants(id);
  }

  const filtered = query.trim()
    ? merchants.filter(m =>
        (m.dba_name || '').toLowerCase().includes(query.toLowerCase()) ||
        (m.merchant_id || '').toLowerCase().includes(query.toLowerCase()) ||
        (m.account_status || '').toLowerCase().includes(query.toLowerCase())
      )
    : merchants;

  return (
    <View style={s.root}>
      {/* ID selector */}
      {identifiers.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.idBar} contentContainerStyle={s.idBarContent}>
          {identifiers.map(id => {
            const active = id.id_string === activeId;
            return (
              <TouchableOpacity
                key={id.id || id.id_string}
                style={[s.idChip, active && s.idChipActive]}
                onPress={() => selectId(id.id_string)}
              >
                <Text style={[s.idChipText, active && s.idChipTextActive]}>{id.id_string}</Text>
                {id.company ? <Text style={[s.idChipSub, active && { color: 'rgba(255,255,255,0.75)' }]}>{id.company}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Search */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search merchants…"
          placeholderTextColor={COLORS.light}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.merchant_id || item.id)}
        renderItem={({ item }) => <MerchantCard item={item} onPress={setSelected} />}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListFooterComponent={loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No merchants found</Text> : null}
      />

      <MerchantDetailModal item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: COLORS.bg },
  idBar:         { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border, maxHeight: 70 },
  idBarContent:  { padding: 10, gap: 8, flexDirection: 'row' },
  idChip:        { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff', alignItems: 'center' },
  idChipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  idChipText:    { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  idChipTextActive: { color: '#fff' },
  idChipSub:     { fontSize: 10, color: COLORS.light, marginTop: 1 },
  searchBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 12, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:    { fontSize: 16, marginRight: 6 },
  searchInput:   { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  list:          { paddingHorizontal: 12, paddingBottom: 30 },
  card:          { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 },
  dba:           { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
  badge:         { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 10, fontWeight: '800' },
  cardMid:       { flexDirection: 'row', gap: 10, marginBottom: 8 },
  mid:           { fontSize: 12, color: COLORS.primary, fontWeight: '700', fontFamily: 'monospace' },
  meta:          { fontSize: 12, color: COLORS.muted },
  prime49:       { backgroundColor: '#eef2fb', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  prime49Text:   { fontSize: 10, fontWeight: '800', color: '#004990' },
  prime49Elig:   { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  prime49EligText: { fontSize: 10, fontWeight: '800', color: '#d97706' },
  cardBottom:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  volItem:       { alignItems: 'center' },
  volLabel:      { fontSize: 9, fontWeight: '700', color: COLORS.light, textTransform: 'uppercase' },
  volValue:      { fontSize: 13, fontWeight: '800', color: COLORS.text },
  callBtn:       { marginLeft: 'auto', padding: 6 },
  callText:      { fontSize: 20 },
  empty:         { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  modalTitle:    { flex: 1, fontSize: 18, fontWeight: '900', color: COLORS.text },
  modalClose:    { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel:   { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  detailValue:   { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  callFullBtn:   { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  callFullText:  { color: '#fff', fontSize: 15, fontWeight: '800' },
});
