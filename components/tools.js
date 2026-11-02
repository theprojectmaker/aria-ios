import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

/* ── small icons ─────────────────────────────────────────────── */
const I = {
  photo: (c) => <><Rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke={c} strokeWidth={1.7} /><Path d="M3 16l5-5 4 4 3-3 6 6" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" /><Circle cx="8" cy="9.5" r="1.3" fill={c} /></>,
  calc: (c) => <><Rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke={c} strokeWidth={1.7} /><Rect x="8" y="6" width="8" height="3" rx="1" fill={c} /><Path d="M9 13h.01M12 13h.01M15 13h.01M9 16.5h.01M12 16.5h.01M15 16.5h.01" stroke={c} strokeWidth={2} strokeLinecap="round" /></>,
  convert: (c) => <><Path d="M4 8h13l-3-3M20 16H7l3 3" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></>,
  tip: (c) => <><Circle cx="12" cy="12" r="8.5" fill="none" stroke={c} strokeWidth={1.7} /><Path d="M14.5 9.2c-.6-.8-1.6-1.2-2.6-1.2-1.5 0-2.6.8-2.6 2 0 2.6 5.2 1.4 5.2 4 0 1.2-1.1 2-2.6 2-1 0-2-.4-2.6-1.2M12 6.5v1.5M12 16v1.5" stroke={c} strokeWidth={1.6} strokeLinecap="round" fill="none" /></>,
  count: (c) => <><Path d="M5 5h14M5 9.5h14M5 14h9M5 18.5h11" stroke={c} strokeWidth={1.8} strokeLinecap="round" /></>,
  pencil: (c) => <Path d="M15.5 5l3.5 3.5L10 17.5 6 18.5 7 14.5 15.5 5Z" fill="none" stroke={c} strokeWidth={1.7} strokeLinejoin="round" />,
  bulb: (c) => <Path d="M9 17h6M10 20.5h4M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1.1-.9 1.8H9.3c0-.7-.3-1.3-.9-1.8A6 6 0 0 1 12 3Z" fill="none" stroke={c} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />,
  globe: (c) => <><Circle cx="12" cy="12" r="8.5" fill="none" stroke={c} strokeWidth={1.6} /><Path d="M3.5 12h17M12 3.5c2.4 2.3 2.4 14.7 0 17M12 3.5c-2.4 2.3-2.4 14.7 0 17" fill="none" stroke={c} strokeWidth={1.4} /></>,
  check: (c) => <Path d="M5 13l4 4L19 7" fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />,
  close: (c) => <Path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth={2} strokeLinecap="round" />,
};
const Ico = ({ name, c, s = 22 }) => <Svg width={s} height={s} viewBox="0 0 24 24">{I[name] ? I[name](c) : null}</Svg>;

/* Writing presets prefill the chat with a strong prompt scaffold. */
export const WRITING_PRESETS = [
  { key: 'summarize', title: 'Summarize', icon: 'count', value: 'Summarize this clearly and briefly:\n\n' },
  { key: 'rewrite', title: 'Rewrite', icon: 'pencil', value: 'Rewrite this to be clearer and more polished, keeping my meaning:\n\n' },
  { key: 'proofread', title: 'Proofread', icon: 'check', value: 'Proofread this and return the corrected text, fixing spelling and grammar:\n\n' },
  { key: 'translate', title: 'Translate', icon: 'globe', value: 'Translate this to Spanish:\n\n' },
  { key: 'brainstorm', title: 'Brainstorm', icon: 'bulb', value: 'Brainstorm 10 creative ideas for: ' },
  { key: 'explain', title: 'Explain simply', icon: 'bulb', value: "Explain this simply, like I'm five: " },
];

const UTILS = [
  { key: 'calc', title: 'Calculator', icon: 'calc' },
  { key: 'convert', title: 'Converter', icon: 'convert' },
  { key: 'tip', title: 'Tip & split', icon: 'tip' },
  { key: 'count', title: 'Word count', icon: 'count' },
];

/* ── the + actions sheet ─────────────────────────────────────── */
export function ActionsSheet({ t, visible, onClose, onPhoto, onTool, onWriting }) {
  const insets = useSafeAreaInsets();
  const s = sheetStyles(t);
  const Row = ({ name, label, onPress }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.fill }]}>
      <View style={s.rowIcon}><Ico name={name} c={t.label} s={21} /></View>
      <Text style={s.rowLabel}>{label}</Text>
    </Pressable>
  );
  const Chip = ({ item, onPress }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, pressed && { opacity: 0.6 }]}>
      <Ico name={item.icon} c={t.label} s={22} />
      <Text style={s.chipTxt} numberOfLines={1}>{item.title}</Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 10 }]} onPress={() => {}}>
          <View style={s.grab} />
          <Row name="photo" label="Add a photo" onPress={() => { onClose(); onPhoto && onPhoto(); }} />

          <Text style={s.section}>Tools</Text>
          <View style={s.grid}>
            {UTILS.map((u) => <Chip key={u.key} item={u} onPress={() => { onClose(); onTool && onTool(u.key); }} />)}
          </View>

          <Text style={s.section}>Writing</Text>
          <View style={s.grid}>
            {WRITING_PRESETS.map((w) => <Chip key={w.key} item={w} onPress={() => { onClose(); onWriting && onWriting(w.value); }} />)}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── tools hub (hosts one utility full-sheet) ────────────────── */
export function ToolsHub({ t, toolId, onClose }) {
  const insets = useSafeAreaInsets();
  const s = hubStyles(t);
  const title = (UTILS.find((u) => u.key === toolId) || {}).title || '';
  return (
    <Modal visible={!!toolId} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={s.head}>
          <Text style={s.headTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.5 }]}><Ico name="close" c={t.label} s={20} /></Pressable>
        </View>
        {toolId === 'calc' && <Calculator t={t} />}
        {toolId === 'convert' && <Converter t={t} />}
        {toolId === 'tip' && <TipCalc t={t} />}
        {toolId === 'count' && <WordCount t={t} />}
      </View>
    </Modal>
  );
}

/* ── Calculator ──────────────────────────────────────────────── */
function Calculator({ t }) {
  const s = calcStyles(t);
  const [cur, setCur] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);

  const fmt = (n) => {
    if (!isFinite(n)) return 'Error';
    const r = Math.round((n + Number.EPSILON) * 1e9) / 1e9;
    return String(r);
  };
  const apply = (a, b, o) => o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : o === '÷' ? a / b : b;
  const digit = (d) => {
    if (fresh) { setCur(d === '.' ? '0.' : d); setFresh(false); return; }
    if (d === '.' && cur.includes('.')) return;
    setCur(cur.length < 12 ? cur + d : cur);
  };
  const chooseOp = (o) => {
    const c = parseFloat(cur);
    if (prev !== null && op && !fresh) { const r = apply(prev, c, op); setPrev(r); setCur(fmt(r)); }
    else setPrev(c);
    setOp(o); setFresh(true);
  };
  const equals = () => { if (op === null || prev === null) return; const r = apply(prev, parseFloat(cur), op); setCur(fmt(r)); setPrev(null); setOp(null); setFresh(true); };
  const clear = () => { setCur('0'); setPrev(null); setOp(null); setFresh(true); };
  const sign = () => setCur(fmt(parseFloat(cur) * -1));
  const pct = () => setCur(fmt(parseFloat(cur) / 100));

  const Key = ({ label, onPress, kind }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [s.key, kind === 'op' && s.keyOp, kind === 'fn' && s.keyFn, kind === 'eq' && s.keyEq, pressed && { opacity: 0.6 }]}>
      <Text style={[s.keyTxt, kind === 'fn' && { color: t.label }, (kind === 'op' || kind === 'eq') && { color: t.onAccent }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={s.wrap}>
      <View style={s.displayWrap}><Text style={s.display} numberOfLines={1} adjustsFontSizeToFit>{cur}</Text></View>
      <View style={s.pad}>
        <View style={s.rowK}><Key kind="fn" label="AC" onPress={clear} /><Key kind="fn" label="±" onPress={sign} /><Key kind="fn" label="%" onPress={pct} /><Key kind="op" label="÷" onPress={() => chooseOp('÷')} /></View>
        <View style={s.rowK}><Key label="7" onPress={() => digit('7')} /><Key label="8" onPress={() => digit('8')} /><Key label="9" onPress={() => digit('9')} /><Key kind="op" label="×" onPress={() => chooseOp('×')} /></View>
        <View style={s.rowK}><Key label="4" onPress={() => digit('4')} /><Key label="5" onPress={() => digit('5')} /><Key label="6" onPress={() => digit('6')} /><Key kind="op" label="−" onPress={() => chooseOp('−')} /></View>
        <View style={s.rowK}><Key label="1" onPress={() => digit('1')} /><Key label="2" onPress={() => digit('2')} /><Key label="3" onPress={() => digit('3')} /><Key kind="op" label="+" onPress={() => chooseOp('+')} /></View>
        <View style={s.rowK}><Key label="0" onPress={() => digit('0')} /><Key label="." onPress={() => digit('.')} /><Key kind="eq" label="=" onPress={equals} /></View>
      </View>
    </View>
  );
}

/* ── Unit Converter ──────────────────────────────────────────── */
const CONV = {
  Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
  Weight: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.0283495231, t: 1000 },
  Volume: { L: 1, mL: 0.001, gal: 3.785411784, qt: 0.946352946, cup: 0.2365882365, floz: 0.0295735296 },
  Speed: { 'm/s': 1, 'km/h': 0.2777777778, mph: 0.44704, kn: 0.5144444444 },
  Area: { 'm²': 1, 'km²': 1000000, 'ft²': 0.09290304, 'ac': 4046.8564224, 'ha': 10000 },
};
function Converter({ t }) {
  const s = convStyles(t);
  const cats = [...Object.keys(CONV), 'Temperature'];
  const [cat, setCat] = useState('Length');
  const [from, setFrom] = useState('m');
  const [to, setTo] = useState('ft');
  const [val, setVal] = useState('1');

  const units = cat === 'Temperature' ? ['°C', '°F', 'K'] : Object.keys(CONV[cat]);
  const setCategory = (c) => {
    setCat(c);
    const u = c === 'Temperature' ? ['°C', '°F', 'K'] : Object.keys(CONV[c]);
    setFrom(u[0]); setTo(u[1] || u[0]);
  };
  const out = useMemo(() => {
    const v = parseFloat(val); if (!isFinite(v)) return '—';
    let r;
    if (cat === 'Temperature') {
      const c = from === '°C' ? v : from === '°F' ? (v - 32) * 5 / 9 : v - 273.15;
      r = to === '°C' ? c : to === '°F' ? c * 9 / 5 + 32 : c + 273.15;
    } else { r = v * CONV[cat][from] / CONV[cat][to]; }
    return String(Math.round((r + Number.EPSILON) * 1e6) / 1e6);
  }, [val, from, to, cat]);

  const UnitRow = ({ sel, onSel }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2 }}>
      {units.map((u) => (
        <Pressable key={u} onPress={() => onSel(u)} style={[s.u, sel === u && s.uSel]}><Text style={[s.uTxt, sel === u && { color: t.onAccent }]}>{u}</Text></Pressable>
      ))}
    </ScrollView>
  );
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, marginBottom: 18 }}>
        {cats.map((c) => <Pressable key={c} onPress={() => setCategory(c)} style={[s.cat, cat === c && s.catSel]}><Text style={[s.catTxt, cat === c && { color: t.onAccent }]}>{c}</Text></Pressable>)}
      </ScrollView>
      <Text style={s.lbl}>From</Text>
      <TextInput style={s.valInput} value={val} onChangeText={setVal} keyboardType="numbers-and-punctuation" placeholder="0" placeholderTextColor={t.label3} />
      <UnitRow sel={from} onSel={setFrom} />
      <View style={s.swap}><Pressable onPress={() => { setFrom(to); setTo(from); }} style={({ pressed }) => [s.swapBtn, pressed && { opacity: 0.6 }]}><Ico name="convert" c={t.label} s={20} /></Pressable></View>
      <Text style={s.lbl}>To</Text>
      <View style={s.result}><Text style={s.resultTxt} numberOfLines={1} adjustsFontSizeToFit>{out}</Text></View>
      <UnitRow sel={to} onSel={setTo} />
    </ScrollView>
  );
}

/* ── Tip & split ─────────────────────────────────────────────── */
function TipCalc({ t }) {
  const s = tipStyles(t);
  const [bill, setBill] = useState('');
  const [tip, setTip] = useState(18);
  const [people, setPeople] = useState(1);
  const b = parseFloat(bill) || 0;
  const tipAmt = b * tip / 100;
  const total = b + tipAmt;
  const per = total / Math.max(1, people);
  const money = (n) => '$' + n.toFixed(2);
  const Stat = ({ label, val, big }) => (
    <View style={s.stat}><Text style={s.statLbl}>{label}</Text><Text style={[s.statVal, big && s.statBig]}>{val}</Text></View>
  );
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
      <Text style={s.lbl}>Bill amount</Text>
      <TextInput style={s.billInput} value={bill} onChangeText={setBill} keyboardType="numbers-and-punctuation" placeholder="0.00" placeholderTextColor={t.label3} />
      <Text style={[s.lbl, { marginTop: 18 }]}>Tip</Text>
      <View style={s.tipRow}>
        {[10, 15, 18, 20, 25].map((p) => <Pressable key={p} onPress={() => setTip(p)} style={[s.tipChip, tip === p && s.tipChipSel]}><Text style={[s.tipChipTxt, tip === p && { color: t.onAccent }]}>{p}%</Text></Pressable>)}
      </View>
      <Text style={[s.lbl, { marginTop: 18 }]}>Split between</Text>
      <View style={s.stepper}>
        <Pressable onPress={() => setPeople(Math.max(1, people - 1))} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}><Text style={s.stepTxt}>−</Text></Pressable>
        <Text style={s.people}>{people} {people === 1 ? 'person' : 'people'}</Text>
        <Pressable onPress={() => setPeople(people + 1)} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}><Text style={s.stepTxt}>+</Text></Pressable>
      </View>
      <View style={s.card}>
        <Stat label="Tip" val={money(tipAmt)} />
        <Stat label="Total" val={money(total)} />
        <View style={s.div} />
        <Stat label={people > 1 ? 'Each person pays' : 'You pay'} val={money(per)} big />
      </View>
    </ScrollView>
  );
}

/* ── Word count ──────────────────────────────────────────────── */
function WordCount({ t }) {
  const s = wcStyles(t);
  const [text, setText] = useState('');
  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    const noSpace = text.replace(/\s/g, '').length;
    const sentences = (text.match(/[.!?]+(\s|$)/g) || []).length;
    const paras = trimmed ? trimmed.split(/\n+/).filter((p) => p.trim()).length : 0;
    const mins = Math.max(words ? 1 : 0, Math.round(words / 200));
    return { words, chars, noSpace, sentences, paras, mins };
  }, [text]);
  const Stat = ({ n, l }) => <View style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{l}</Text></View>;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
      <TextInput style={s.area} value={text} onChangeText={setText} placeholder="Paste or type text…" placeholderTextColor={t.label3} multiline textAlignVertical="top" />
      <View style={s.grid}>
        <Stat n={stats.words} l="words" />
        <Stat n={stats.chars} l="characters" />
        <Stat n={stats.noSpace} l="no spaces" />
        <Stat n={stats.sentences} l="sentences" />
        <Stat n={stats.paras} l="paragraphs" />
        <Stat n={`${stats.mins}m`} l="read time" />
      </View>
    </ScrollView>
  );
}

/* ── styles ──────────────────────────────────────────────────── */
function sheetStyles(t) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: t.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 14, paddingTop: 8 },
    grab: { width: 38, height: 5, borderRadius: 3, backgroundColor: t.sep, alignSelf: 'center', marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14 },
    rowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { color: t.label, fontSize: 16, fontWeight: '500' },
    section: { color: t.label2, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 14, marginBottom: 9, marginLeft: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { width: '31.3%', backgroundColor: t.fill, borderRadius: 14, paddingVertical: 13, alignItems: 'center', gap: 7 },
    chipTxt: { color: t.label, fontSize: 12.5, fontWeight: '500', paddingHorizontal: 4 },
  });
}
function hubStyles(t) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
    headTitle: { color: t.label, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
  });
}
function calcStyles(t) {
  return StyleSheet.create({
    wrap: { flex: 1, padding: 14, justifyContent: 'flex-end' },
    displayWrap: { paddingHorizontal: 12, paddingVertical: 20, alignItems: 'flex-end', justifyContent: 'flex-end', flex: 1 },
    display: { color: t.label, fontSize: 68, fontWeight: '300', letterSpacing: -1 },
    pad: { gap: 10 },
    rowK: { flexDirection: 'row', gap: 10 },
    key: { flex: 1, aspectRatio: 1, maxHeight: 82, borderRadius: 100, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
    keyFn: { backgroundColor: t.fill2 },
    keyOp: { backgroundColor: t.accent },
    keyEq: { backgroundColor: t.accent, flex: 2.14 },
    keyTxt: { color: t.label, fontSize: 28, fontWeight: '500' },
  });
}
function convStyles(t) {
  return StyleSheet.create({
    cat: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 100, backgroundColor: t.fill },
    catSel: { backgroundColor: t.accent },
    catTxt: { color: t.label, fontSize: 14, fontWeight: '600' },
    lbl: { color: t.label2, fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.2 },
    valInput: { color: t.label, fontSize: 34, fontWeight: '600', paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: t.sep, marginBottom: 12 },
    u: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: t.fill },
    uSel: { backgroundColor: t.accent },
    uTxt: { color: t.label, fontSize: 14, fontWeight: '600' },
    swap: { alignItems: 'center', marginVertical: 16 },
    swapBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
    result: { paddingVertical: 6, marginBottom: 12 },
    resultTxt: { color: t.label, fontSize: 40, fontWeight: '700', letterSpacing: -0.5 },
  });
}
function tipStyles(t) {
  return StyleSheet.create({
    lbl: { color: t.label2, fontSize: 13, fontWeight: '600', marginBottom: 9, letterSpacing: 0.2 },
    billInput: { color: t.label, fontSize: 40, fontWeight: '700', paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: t.sep },
    tipRow: { flexDirection: 'row', gap: 8 },
    tipChip: { flex: 1, paddingVertical: 12, borderRadius: 13, backgroundColor: t.fill, alignItems: 'center' },
    tipChipSel: { backgroundColor: t.accent },
    tipChipTxt: { color: t.label, fontSize: 15, fontWeight: '600' },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.fill, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6 },
    stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    stepTxt: { color: t.label, fontSize: 26, fontWeight: '500' },
    people: { color: t.label, fontSize: 16, fontWeight: '600' },
    card: { backgroundColor: t.fill, borderRadius: 18, padding: 18, marginTop: 22, gap: 12 },
    stat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statLbl: { color: t.label2, fontSize: 15 },
    statVal: { color: t.label, fontSize: 17, fontWeight: '600' },
    statBig: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
    div: { height: StyleSheet.hairlineWidth, backgroundColor: t.sep },
  });
}
function wcStyles(t) {
  return StyleSheet.create({
    area: { minHeight: 180, backgroundColor: t.fill, borderRadius: 16, padding: 15, color: t.label, fontSize: 16, lineHeight: 23 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
    stat: { width: '31.5%', backgroundColor: t.fill, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    statN: { color: t.label, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
    statL: { color: t.label2, fontSize: 12.5, marginTop: 3 },
  });
}
