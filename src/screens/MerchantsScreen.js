import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl,
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

export default function MerchantsScreen({ navigation }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, margin: 14, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchIcon:  { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  countLabel:  { fontSize: 11, color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 6 },
  list:        { paddingHorizontal: 14, paddingBottom: 30 },
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
});
