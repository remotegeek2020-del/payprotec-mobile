import * as SecureStore from 'expo-secure-store';

export const Storage = {
  async get(key) {
    try { return await SecureStore.getItemAsync(key); }
    catch (e) { return null; }
  },
  async set(key, value) {
    try { await SecureStore.setItemAsync(key, String(value)); }
    catch (e) { console.warn('SecureStore set failed:', e); }
  },
  async remove(key) {
    try { await SecureStore.deleteItemAsync(key); }
    catch (e) { /* ignore */ }
  },
};
