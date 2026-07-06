import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView, Linking, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../config';
import { StaffEquipment } from '../../staff-api';

const BARCODE_TYPES = ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'datamatrix'];

function statusColor(status) {
  const t = (status || '').toLowerCase();
  if (t.includes('deploy')) return { bg: '#d1fae5', text: '#059669' };
  if (t.includes('stock'))  return { bg: '#dbeafe', text: '#1d4ed8' };
  if (t.includes('repair')) return { bg: '#fef3c7', text: '#d97706' };
  if (t.includes('return')) return { bg: '#fee2e2', text: '#dc2626' };
  return { bg: '#f1f5f9', text: '#64748b' };
}

export default function StaffScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);   // { serial, units: [] }
  const [manual, setManual]     = useState('');
  const [torch, setTorch]       = useState(false);
  const lockRef = useRef(false);

  async function lookup(serial) {
    const term = (serial || '').trim();
    if (!term) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await StaffEquipment.lookupSerial(term);
      setResult({ serial: term, units: res.success ? (res.data || []) : [] });
    } catch (e) {
      setResult({ serial: term, units: [], error: true });
    }
    setLoading(false);
  }

  function onBarcodeScanned({ data }) {
    if (lockRef.current || scanned) return;
    lockRef.current = true;
    setScanned(true);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) { /* ignore */ }
    lookup(data);
  }

  function scanAgain() {
    setScanned(false);
    setResult(null);
    lockRef.current = false;
  }

  function fileRma(unit) {
    // Hand off to the deployments screen pre-filtered to this serial, where the
    // existing Log Return / RMA flow takes over.
    navigation.navigate('StaffDeployments', { serial: unit.serial_number || result?.serial });
  }

  // ── Permission states ──
  if (!permission) {
    return <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.permIcon}>📷</Text>
        <Text style={s.permTitle}>Camera access needed</Text>
        <Text style={s.permText}>Allow the camera to scan terminal serial numbers and barcodes.</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
        {!permission.canAskAgain && (
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={s.permLink}>Open Settings</Text>
          </TouchableOpacity>
        )}
        <ManualEntry manual={manual} setManual={setManual} onSubmit={lookup} />
        <ResultPanel loading={loading} result={result} onFileRma={fileRma} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {!scanned ? (
        <View style={s.cameraWrap}>
          <CameraView
            style={s.camera}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={s.reticle} pointerEvents="none" />
          <View style={s.camOverlayTop} pointerEvents="box-none">
            <Text style={s.camHint}>Point at a serial barcode or QR code</Text>
          </View>
          <TouchableOpacity style={s.torchBtn} onPress={() => setTorch(t => !t)}>
            <Text style={s.torchText}>{torch ? '🔦 On' : '🔦 Off'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.resultScroll}>
          <View style={s.scannedHeader}>
            <Text style={s.scannedLabel}>Scanned</Text>
            <Text style={s.scannedSerial}>{result?.serial || '…'}</Text>
          </View>
          <ResultPanel loading={loading} result={result} onFileRma={fileRma} />
          <TouchableOpacity style={s.againBtn} onPress={scanAgain}>
            <Text style={s.againText}>↻ Scan Another</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {!scanned && <ManualEntry manual={manual} setManual={setManual} onSubmit={lookup} floating />}
    </View>
  );
}

function ManualEntry({ manual, setManual, onSubmit, floating }) {
  return (
    <View style={[s.manualRow, floating && s.manualFloating]}>
      <TextInput
        style={s.manualInput}
        placeholder="Or type a serial…"
        placeholderTextColor={COLORS.light}
        value={manual}
        onChangeText={setManual}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => onSubmit(manual)}
      />
      <TouchableOpacity style={s.manualBtn} onPress={() => onSubmit(manual)}>
        <Text style={s.manualBtnText}>Look up</Text>
      </TouchableOpacity>
    </View>
  );
}

function ResultPanel({ loading, result, onFileRma }) {
  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ margin: 24 }} />;
  if (!result) return null;
  if (result.error) return <Text style={s.empty}>Lookup failed. Check your connection and try again.</Text>;
  if (!result.units.length) return <Text style={s.empty}>No unit found for “{result.serial}”.</Text>;

  return (
    <View style={{ width: '100%' }}>
      {result.units.map((u, i) => {
        const sc = statusColor(u.status);
        const deployed = (u.status || '').toLowerCase().includes('deploy');
        return (
          <View key={u.id || i} style={s.unitCard}>
            <View style={s.unitTop}>
              <Text style={s.unitSerial} numberOfLines={1}>{u.serial_number || '—'}</Text>
              <View style={[s.badge, { backgroundColor: sc.bg }]}>
                <Text style={[s.badgeText, { color: sc.text }]}>{(u.status || '—').toUpperCase()}</Text>
              </View>
            </View>
            {[
              ['Terminal', u.terminal_type],
              ['Location', u.current_location],
              ['Merchant', u.merchants?.dba_name],
            ].filter(([, v]) => v).map(([k, v]) => (
              <View key={k} style={s.unitRow}>
                <Text style={s.unitLabel}>{k}</Text>
                <Text style={s.unitValue}>{v}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[s.rmaBtn, !deployed && s.rmaBtnMuted]}
              onPress={() => onFileRma(u)}
            >
              <Text style={[s.rmaBtnText, !deployed && s.rmaBtnTextMuted]}>
                {deployed ? '↩️  File RMA / Return' : 'Find in Deployments'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#000' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: COLORS.bg },
  cameraWrap:   { flex: 1, position: 'relative' },
  camera:       { flex: 1 },
  reticle:      { position: 'absolute', top: '30%', left: '15%', width: '70%', height: '30%', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 16 },
  camOverlayTop:{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 20, alignItems: 'center' },
  camHint:      { color: '#fff', fontSize: 14, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: 'hidden' },
  torchBtn:     { position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  torchText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  resultScroll: { padding: 16, paddingBottom: 40, backgroundColor: COLORS.bg, flexGrow: 1 },
  scannedHeader:{ alignItems: 'center', marginBottom: 16 },
  scannedLabel: { fontSize: 11, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  scannedSerial:{ fontSize: 22, fontWeight: '900', color: COLORS.text, fontFamily: 'monospace', marginTop: 4 },
  againBtn:     { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  againText:    { color: '#fff', fontSize: 15, fontWeight: '800' },
  empty:        { textAlign: 'center', color: COLORS.muted, fontSize: 14, padding: 24 },
  unitCard:     { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  unitTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 },
  unitSerial:   { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.text, fontFamily: 'monospace' },
  badge:        { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 10, fontWeight: '800' },
  unitRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  unitLabel:    { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  unitValue:    { fontSize: 13, color: COLORS.text, fontWeight: '700', maxWidth: '62%', textAlign: 'right' },
  rmaBtn:       { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  rmaBtnMuted:  { backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border },
  rmaBtnText:   { color: '#fff', fontSize: 14, fontWeight: '800' },
  rmaBtnTextMuted: { color: COLORS.ink || COLORS.text },
  manualRow:    { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: COLORS.card, alignItems: 'center' },
  manualFloating: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: COLORS.border },
  manualInput:  { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: '#fff' },
  manualBtn:    { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  manualBtnText:{ color: '#fff', fontSize: 13, fontWeight: '800' },
  permIcon:     { fontSize: 44, marginBottom: 12 },
  permTitle:    { fontSize: 18, fontWeight: '900', color: COLORS.text, marginBottom: 6 },
  permText:     { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20, marginBottom: 18, maxWidth: 300 },
  permBtn:      { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
  permBtnText:  { color: '#fff', fontSize: 15, fontWeight: '800' },
  permLink:     { color: COLORS.primary, fontWeight: '700', marginTop: 14, fontSize: 14 },
});
