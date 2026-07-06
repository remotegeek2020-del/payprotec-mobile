import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from './config';

// Lightweight read-through cache so key screens still render the last synced
// data with no signal. Opt-in per screen via withCache().
const PREFIX = 'cache:';

export async function cacheSet(key, data) {
  try { await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), data })); }
  catch (e) { /* ignore */ }
}

export async function cacheGet(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null; // { t, data }
  } catch (e) { return null; }
}

// Run fetchFn; on success cache the result and return it with fromCache:false.
// On network failure fall back to the cached copy (fromCache:true) if present.
// Session-expiry errors are re-thrown so auth handling still works.
export async function withCache(key, fetchFn) {
  try {
    const res = await fetchFn();
    if (res && res.success !== false) {
      await cacheSet(key, res);
      return { ...res, fromCache: false };
    }
    return { ...(res || {}), fromCache: false };
  } catch (e) {
    if (e && e.sessionExpired) throw e;
    const cached = await cacheGet(key);
    if (cached) return { ...cached.data, fromCache: true, cachedAt: cached.t };
    throw e;
  }
}

function ago(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function OfflineBanner({ cachedAt }) {
  return (
    <View style={s.banner}>
      <Text style={s.text}>📴 Offline — showing last synced data{cachedAt ? ` (${ago(cachedAt)})` : ''}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: '#fef3c7', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, marginBottom: 12 },
  text:   { fontSize: 12.5, color: '#92620a', fontWeight: '700', textAlign: 'center' },
});
