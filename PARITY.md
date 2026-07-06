# Mobile ↔ Web Parity Tracker

Keeps the mobile app aligned with `merchant-management-console`. Re-audit against
`origin/main` of the web repo at the start of each phase (it moves fast — 248 commits
landed between mobile v1 and this tracker).

Legend: ✅ done · 🟡 in progress · ⬜ planned · ⏸️ deferred (web-only / low mobile value)

## Phase 1 — Quick wins ✅
- ✅ Partner **My Prime49** — residuals + upgrade opportunities + request enrollment (`/api/partner-data` get_residuals, get_prime49_eligible → `/api/tickets` create)
- ✅ Prime49 badges on partner merchant list (get_merchants is_prime49 / eligible ≥ $30k)
- ✅ Staff **Analytics** dashboard — 7 KPIs, weekly series, status breakdowns (`/api/analytics` overview)

## Phase 2 — Native superpowers ✅
- ✅ Serial/barcode **scanner** (expo-camera + haptics) → equipment lookup → File RMA hands off to Deployments filtered by serial. Staff Hardware → Scan Serial. Manual-entry + torch fallback.
- 🟡 **Notifications** — permission + local notifications from a 60s poll of the existing notifications API (`notifications.js`); in-app bell already present. ⚠ True remote/background push still needs a device-token endpoint on the web repo (deferred — web is off-limits).
- ✅ **Offline read cache** (`offline.js`, AsyncStorage) — partner dashboard, partner merchant list, staff merchant list serve last-synced data with an offline banner when the network fails.

New deps (pinned to SDK 54): expo-camera 17.0.10, expo-notifications 0.32.17, expo-device 8.0.10, expo-constants 18.0.13, expo-haptics 15.0.8, @react-native-async-storage/async-storage 2.2.0. **Run `npm install` after pulling.**

## Phase 3 — Chat 2.0 ⬜
- ⬜ Group chats (create/list/thread/manage)
- ⬜ Reactions + typing indicators + presence/status
- ⬜ Image messages (expo-image-picker + signed two-step upload)
- ⬜ Edit / delete messages

## Phase 4 — ShipStation ⬜ (staff, feature-flag gated)
- ⬜ Label step on tickets (rates → create_label → print PDF via expo-print; void/reprint)
- ⬜ Deployment creation wizard (3 steps, typeaheads, address validation)
- ⬜ Return labels

## Phase 5 — Staff Prime49 & depth ⬜
- ⬜ Prime49 residuals report (`/api/merchants` get_prime49_residuals)
- ⬜ Upgrade-eligible scanner (get_upgrade_eligible)
- ⬜ Prime49 automation — recent tasks (read-only)

## Deferred ⏸️ (web-only / low mobile value)
Merge merchants · Prime49 automation config editing · Terminal Manager/vendors ·
Recycle Bin · Webhook Health · Integrations/API keys · Scheduled Reports ·
Security Check · Jarvis AI · Product Tours · Site Settings · public Merchant-Apply ·
ShipStation reconcile/bulk-link/webhook (inbound-only).

---
_Web app is reference-only; never modified from the mobile workflow._
