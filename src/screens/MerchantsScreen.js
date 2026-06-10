import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config';
import { Merchants } from '../api';

function MerchantCard({ item, onPress }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardLeft}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(item.dba_name || '?')[0].toUpperCase()}</Text>
        </View>
      </View>
      <View style={s.cardBody}>
        <Text style={s.dba} numberOfLines={1}>{item.dba_name || '—'}</Text>
        <Text style={s.mid}>{item.merchant_id || ''}</Text>
        <Text style={s.location} numberOfLines={1}>
          {[item.merchant_city, item.merchant_state].filter(Boolean).join(', ') || 'No location'}
        </Text>
      </View>
      <Text style={s.arrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Create merchant modal ──────────────────────────────────────────────────────

function CreateMerchantModal({ visible, onClose, onCreated }) {
  const [merchantId, setMerchantId]   = useState('');
  const [dbaName, setDbaName]         = useState('');
  const [legalName, setLegalName]     = useState('');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [address, setAddress]         = useState('');
  const [city, setCity]               = useState('');
  const [state, setState]             = useState('');
  const [zip, setZip]                 = useState('');
  const [saving, setSaving]           = useState(false);

  function reset() {
    setMerchantId(''); setDbaName(''); setLegalName('');
    setPhone(''); setEmail(''); setAddress('');
    setCity(''); setState(''); setZip('');
  }

  async function submit() {
    if (!merchantId.trim()) { Alert.alert('Required', 'Enter a Merchant ID (MID).'); return; }
    if (!dbaName.trim())    { Alert.alert('Required', 'Enter a DBA name.'); return; }
    setSaving(true);
    try {
      const payload = {
        merchant_id: merchantId.trim(),
        dba_name: dbaName.trim(),
      };
      if (legalName.trim())  payload.legal_name           = legalName.trim();
      if (phone.trim())      payload.merchant_phone        = phone.trim();
      if (email.trim())      payload.email                 = email.trim();
      if (address.trim())    payload.merchant_address       = address.trim();
      if (city.trim())       payload.merchant_city          = city.trim();
      if (state.trim())      payload.merchant_state         = state.trim();
      if (zip.trim())        payload.merchant_zip           = zip.trim();

      const res = await Merchants.create(payload);
      if (res.success) {
        reset();
        onCreated();
      } else {
        Alert.alert('Error', res.error || res.message || 'Could not create merchant.');
      }
    } catch {
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
              <TextInput
                style={s.input}
                placeholder="e.g. ABC1234567"
                placeholderTextColor={COLORS.light}
                value={merchantId}
                onChangeText={setMerchantId}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Text style={s.fieldLabel}>DBA Name *</Text>
              <TextInput
                style={s.input}
                placeholder="Doing Business As name"
                placeholderTextColor={COLORS.light}
                value={dbaName}
                onChangeText={setDbaName}
              />

              <Text style={s.fieldLabel}>Legal Name</Text>
              <TextInput
                style={s.input}
                placeholder="Legal business name (if different)"
                placeholderTextColor={COLORS.light}
                value={legalName}
                onChangeText={setLegalName}
              />

              <Text style={s.fieldLabel}>Phone</Text>
              <TextInput
                style={s.input}
                placeholder="(555) 000-0000"
                placeholderTextColor={COLORS.light}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                style={s.input}
                placeholder="contact@business.com"
                placeholderTextColor={COLORS.light}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={s.fieldLabel}>Address</Text>
              <TextInput
                style={s.input}
                placeholder="Street address"
                placeholderTextColor={COLORS.light}
                value={address}
                onChangeText={setAddress}
              />

              <View style={s.rowFields}>
                <View style={{ flex: 2 }}>
                  <Text style={s.fieldLabel}>City</Text>
                  <TextInput
                    style={s.input}
                    placeholder="City"
                    placeholderTextColor={COLORS.light}
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.fieldLabel}>State</Text>
                  <TextInput
                    style={s.input}
                    placeholder="CA"
                    placeholderTextColor={COLORS.light}
                    value={state}
                    onChangeText={setState}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.fieldLabel}>ZIP</Text>
                  <TextInput
                    style={s.input}
                    placeholder="90210"
                    placeholderTextColor={COLORS.light}
                    value={zip}
                    onChangeText={setZip}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[s.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={submit}
                disabled={saving}
              >
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

export default function MerchantsScreen({ navigation }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function search(q = query, pg = 1, append = false) {
    setLoading(true);
    try {
      const data = await Merchants.list(q, pg, 20);
      const rows = data.data || data.merchants || [];
      setResults(append ? prev => [...prev, ...rows] : rows);
      setTotal(data.totalCount ?? data.count ?? 0);
      setPage(pg);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  const onSearch = useCallback(() => search(query, 1, false), [query]);

  function loadMore() {
    if (results.length < total && !loading) search(query, page + 1, true);
  }

  function onRefresh() { setRefreshing(true); search(query, 1, false); }

  // Load on mount
  React.useEffect(() => { search('', 1, false); }, []);

  return (
    <View style={s.container}>
      {/* Search Bar */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search by name, MID, phone…"
          placeholderTextColor={COLORS.light}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

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
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 14, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:  { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  countLabel:  { fontSize: 11, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 6 },
  list:        { paddingHorizontal: 14, paddingBottom: 90 },
  card:        { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLeft:    { marginRight: 12 },
  avatar:      { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontSize: 18, fontWeight: '800' },
  cardBody:    { flex: 1 },
  dba:         { fontSize: 14, fontWeight: '700', color: COLORS.text },
  mid:         { fontSize: 11, color: COLORS.primary, fontFamily: 'monospace', marginTop: 1 },
  location:    { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  arrow:       { fontSize: 20, color: COLORS.light },
  empty:       { textAlign: 'center', color: COLORS.muted, padding: 40, fontSize: 14 },

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
  primaryBtn:  { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
