import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { COLORS } from '../config';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYMD(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseYMD(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year: y, month: m - 1, day: d };
}

// Build a 6x7 grid of day numbers (null for blanks) for a given month.
function buildGrid(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);
  const rows = [];
  for (let r = 0; r < 6; r++) rows.push(cells.slice(r * 7, r * 7 + 7));
  return rows;
}

export default function DatePickerModal({ visible, value, onSelect, onClose, title }) {
  const now = new Date();
  const parsed = parseYMD(value);
  const [year, setYear]   = useState(parsed ? parsed.year : now.getFullYear());
  const [month, setMonth] = useState(parsed ? parsed.month : now.getMonth());

  // Re-sync the displayed month whenever the picker is opened
  useEffect(() => {
    if (!visible) return;
    const p = parseYMD(value);
    const d = new Date();
    setYear(p ? p.year : d.getFullYear());
    setMonth(p ? p.month : d.getMonth());
  }, [visible, value]);

  const todayStr = toYMD(now.getFullYear(), now.getMonth(), now.getDate());
  const rows = buildGrid(year, month);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function pick(day) {
    onSelect(toYMD(year, month, day));
    onClose();
  }

  function clear() {
    onSelect('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>{title || 'Select Date'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.monthNav}>
            <TouchableOpacity style={s.navBtn} onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.monthTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity style={s.navBtn} onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={s.weekRow}>
            {WEEKDAYS.map(d => (
              <View key={d} style={s.cell}>
                <Text style={s.weekday}>{d}</Text>
              </View>
            ))}
          </View>

          {rows.map((row, ri) => (
            <View key={ri} style={s.weekRow}>
              {row.map((day, ci) => {
                if (!day) return <View key={ci} style={s.cell} />;
                const dateStr = toYMD(year, month, day);
                const isSelected = value === dateStr;
                const isToday = dateStr === todayStr;
                return (
                  <View key={ci} style={s.cell}>
                    <TouchableOpacity
                      style={[s.dayBtn, isToday && s.dayBtnToday, isSelected && s.dayBtnSelected]}
                      onPress={() => pick(day)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dayText, isToday && s.dayTextToday, isSelected && s.dayTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={s.footer}>
            <TouchableOpacity style={s.clearBtn} onPress={clear}>
              <Text style={s.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  card:           { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title:          { fontSize: 15, fontWeight: '800', color: COLORS.text },
  close:          { fontSize: 18, color: COLORS.muted, fontWeight: '700' },
  monthNav:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  navBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  navArrow:       { fontSize: 22, color: COLORS.primary, fontWeight: '700', lineHeight: 24 },
  monthTitle:     { fontSize: 15, fontWeight: '800', color: COLORS.primaryDk },
  weekRow:        { flexDirection: 'row' },
  cell:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  weekday:        { fontSize: 11, fontWeight: '800', color: COLORS.muted, paddingVertical: 4, textTransform: 'uppercase' },
  dayBtn:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayBtnToday:    { borderWidth: 1.5, borderColor: COLORS.primary },
  dayBtnSelected: { backgroundColor: COLORS.primary },
  dayText:        { fontSize: 13, fontWeight: '600', color: COLORS.text },
  dayTextToday:   { color: COLORS.primary, fontWeight: '800' },
  dayTextSelected:{ color: '#fff', fontWeight: '800' },
  footer:         { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  clearBtn:       { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border },
  clearBtnText:   { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  cancelBtn:      { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: COLORS.bg },
  cancelBtnText:  { fontSize: 13, fontWeight: '700', color: COLORS.muted },
});
