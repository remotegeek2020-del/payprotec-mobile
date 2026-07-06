import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Foreground behaviour: show a banner + list entry, set the badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function ensurePermission() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch (e) { return false; }
}

// Best-effort Expo push token. Returns null in simulators, when denied, or when
// running somewhere push isn't available. NOTE: delivering *remote* push needs a
// backend endpoint to store this token and call Expo's push API — pending on the
// web side. Until then we raise local notifications from polling (below).
export async function registerForPush() {
  try {
    if (!Device.isDevice) return null;
    if (!(await ensurePermission())) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return res?.data || null;
  } catch (e) { return null; }
}

async function raiseLocal(title, body) {
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch (e) { /* ignore — local notifications unavailable in this runtime */ }
}

// Raise local notifications for notification items we haven't alerted on yet.
// items: [{ id, title, body, type, is_read }]
const SEEN_KEY = 'notif_seen_ids';
export async function notifyNewItems(items) {
  try {
    if (!Array.isArray(items) || items.length === 0) return;
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const seen = new Set(raw ? JSON.parse(raw) : []);
    const fresh = items.filter(n => n && n.id != null && !seen.has(String(n.id)) && !n.is_read);
    for (const n of fresh.slice(0, 5)) {
      await raiseLocal(n.title || 'PayProTec', n.body || n.type || 'You have a new notification');
    }
    const merged = [...seen, ...items.map(n => String(n.id)).filter(Boolean)].slice(-500);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(merged));
  } catch (e) { /* ignore */ }
}

// Raise a notification when an unread *count* increases (used for staff, whose
// API returns counts rather than items). Persists the last count per key.
export async function notifyCountIncrease(key, count, label) {
  try {
    const storeKey = `notif_count:${key}`;
    const prevRaw = await AsyncStorage.getItem(storeKey);
    const prev = prevRaw ? parseInt(prevRaw) : 0;
    const n = parseInt(count) || 0;
    if (n > prev) {
      const delta = n - prev;
      await raiseLocal('PayProTec', `${delta} new ${label}${delta > 1 ? 's' : ''}`);
    }
    await AsyncStorage.setItem(storeKey, String(n));
  } catch (e) { /* ignore */ }
}
