/* The Library tab: two offline, model-free modes.
   • Search — look straight into the bundled reference: the 1,300-entry
     handbook, the downloadable encyclopedia and the dictionary.
   • Flashcards — self-test on the handbook, a round of 20 per subject.
   Everything here is the reference text itself, not model output, so it works
   with no AI model loaded and no internet. This reference-first library plus
   flashcards is what sets Aria apart from a plain offline chatbot. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import Glass from './glass';
import { loadHandbook, handbookEntries, searchHandbook } from './handbook';
import { libraryReady, librarySearch, libraryDefine } from './library';

const SUBJECTS = ['Math', 'Physics', 'Chemistry', 'Biology', 'Earth Science', 'Astronomy', 'English', 'Literature', 'US History', 'Civics', 'World History', 'Geography'];

function useHandbook() {
  const [ready, setReady] = useState(handbookEntries().length > 0);
  useEffect(() => { let on = true; loadHandbook().then(() => on && setReady(true)); return () => { on = false; }; }, []);
  return ready;
}

function shuffled(arr, seed) {
  const a = arr.slice(); let x = seed || 1;
  for (let i = a.length - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = Math.floor((x / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ── Library (search + flashcards) ─────────────────────────────────────── */
export function LibraryScreen({ t, top, bottom, onAsk, onGetLibrary }) {
  const ready = useHandbook();
  const s = useMemo(() => styles(t), [t]);
  const [mode, setMode] = useState('search');
  return (
    <View style={{ flex: 1, paddingTop: top }}>
      <View style={[s.segWrap]}>
        <Glass t={t} regular radius={20} style={s.seg}>
          {[['search', 'Search'], ['cards', 'Flashcards']].map(([k, label]) => (
            <Pressable key={k} accessibilityLabel={label} onPress={() => setMode(k)} style={[s.segBtn, mode === k && s.segOn]}>
              <Text style={[s.segTxt, mode === k && s.segTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </Glass>
      </View>
      {mode === 'search'
        ? <SearchView t={t} s={s} ready={ready} bottom={bottom} onAsk={onAsk} onGetLibrary={onGetLibrary} />
        : <FlashcardsView t={t} s={s} ready={ready} bottom={bottom} onAsk={onAsk} />}
    </View>
  );
}

/* ── Search ────────────────────────────────────────────────────────────── */
function SearchView({ t, s, ready, bottom, onAsk, onGetLibrary }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(null);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    const text = q.trim();
    if (text.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const out = [];
      try { if (/^[a-z' -]+$/i.test(text) && text.split(' ').length <= 2) { const d = await libraryDefine(text); if (d) out.push({ title: d.word, text: d.definition, tag: 'Dictionary' }); } } catch (e) {}
      try { for (const h of searchHandbook(text, 6)) out.push({ title: h.title, text: h.text, tag: h.subject || 'Handbook' }); } catch (e) {}
      try { if (libraryReady()) for (const r of await librarySearch(text, 8)) if (!out.find((o) => o.title === r.title)) out.push({ title: r.title, text: r.text, tag: 'Encyclopedia' }); } catch (e) {}
      if (id === run.current) setResults(out);
    }, 220);
    return () => clearTimeout(timer);
  }, [q, ready]);

  if (open) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.page, { paddingBottom: bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={s.col}>
          <Pressable onPress={() => setOpen(null)} hitSlop={10}><Text style={s.link}>‹ Results</Text></Pressable>
          <Text style={[s.rowMeta, { marginTop: 14 }]}>{open.tag}</Text>
          <Text style={s.h1}>{open.title}</Text>
          <Text style={s.body} selectable>{open.text}</Text>
          <Pressable onPress={() => onAsk && onAsk(`Tell me more about ${open.title}.`)} style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}><Text style={s.btnTxt}>Ask Aria about this</Text></Pressable>
        </View>
      </ScrollView>
    );
  }
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.page, { paddingBottom: bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.col}>
        <View style={s.search}>
          <TextInput value={q} onChangeText={setQ} placeholder="Search formulas, facts, words…" placeholderTextColor={t.label3} style={s.searchInput} autoCorrect={false} clearButtonMode="while-editing" />
        </View>
        {results.length ? (
          <Glass t={t} radius={16} style={s.list}>
            {results.map((r, k) => (
              <Pressable key={r.tag + r.title + k} onPress={() => setOpen(r)} style={({ pressed }) => [s.resRow, k === results.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: t.fill2 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={s.resBody} numberOfLines={2}>{String(r.text).replace(/\s+/g, ' ')}</Text>
                </View>
                <Text style={s.tag}>{r.tag}</Text>
              </Pressable>
            ))}
          </Glass>
        ) : (
          <Text style={s.sub}>{q.trim().length >= 2 ? 'Nothing found. Try a different word.' : 'Everything here works offline: 1,300 handbook entries' + (libraryReady() ? ', 79,000 encyclopedia articles and an 86,000-word dictionary.' : '. Add the full library below.')}</Text>
        )}
        {!libraryReady() && onGetLibrary ? (
          <Pressable onPress={onGetLibrary} style={{ paddingVertical: 14 }}><Text style={s.link}>Add 79,000 encyclopedia articles and a dictionary (75 MB)</Text></Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

/* ── Flashcards ────────────────────────────────────────────────────────── */
function FlashcardsView({ t, s, ready, bottom, onAsk }) {
  const [subject, setSubject] = useState(null);
  const [deck, setDeck] = useState([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const seed = useRef(1);

  const counts = useMemo(() => { const c = {}; handbookEntries().forEach((e) => { c[e.s] = (c[e.s] || 0) + 1; }); return c; }, [ready]);
  const start = (sub) => {
    seed.current = (seed.current * 31 + sub.length + Date.now()) % 100000;
    setDeck(shuffled(handbookEntries().filter((e) => e.s === sub), seed.current).slice(0, 20));
    setSubject(sub); setI(0); setFlipped(false); setKnown(0);
  };
  const next = (gotIt) => { if (gotIt) setKnown((k) => k + 1); setFlipped(false); setI((x) => x + 1); };

  if (!subject) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.page, { paddingBottom: bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={s.col}>
          <Text style={s.sub}>Test yourself on Aria’s handbook. Pick a subject for a round of 20 cards.</Text>
          <Glass t={t} radius={16} style={s.list}>
            {SUBJECTS.filter((x) => counts[x]).map((x, k, arr) => (
              <Pressable key={x} onPress={() => start(x)} style={({ pressed }) => [s.row, k === arr.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: t.fill2 }]}>
                <Text style={s.rowTitle}>{x}</Text>
                <Text style={s.rowMeta}>{counts[x]} cards</Text>
                <Text style={s.chev}>›</Text>
              </Pressable>
            ))}
            {!ready ? <View style={s.row}><Text style={s.rowMeta}>Loading the handbook…</Text></View> : null}
          </Glass>
        </View>
      </ScrollView>
    );
  }

  const done = i >= deck.length;
  const card = deck[i];
  return (
    <View style={[s.page, { flex: 1, paddingBottom: bottom + 16 }]}>
      <View style={[s.col, { flex: 1 }]}>
        <View style={s.topRow}>
          <Pressable onPress={() => setSubject(null)} hitSlop={10}><Text style={s.link}>‹ Subjects</Text></Pressable>
          <Text style={s.rowMeta}>{done ? `${known} of ${deck.length} known` : `${i + 1} of ${deck.length}`}</Text>
        </View>
        <View style={s.track}><View style={[s.fill, { width: `${Math.round((Math.min(i, deck.length) / Math.max(1, deck.length)) * 100)}%` }]} /></View>
        {done ? (
          <View style={s.center}>
            <Text style={s.h1}>{known} of {deck.length}</Text>
            <Text style={s.sub}>{known === deck.length ? 'You knew every card.' : 'Go again to see the ones you missed in a new mix.'}</Text>
            <Pressable onPress={() => start(subject)} style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}><Text style={s.btnTxt}>Another round</Text></Pressable>
          </View>
        ) : (
          <>
            <Pressable style={{ flex: 1 }} onPress={() => setFlipped((f) => !f)} accessibilityLabel="Flip card">
              <Glass t={t} regular radius={24} style={s.card}>
                <Text style={s.cardSubject}>{subject}</Text>
                {!flipped ? (
                  <View style={s.center}><Text style={s.cardTitle}>{card.t}</Text><Text style={s.hint}>Tap to see the answer</Text></View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}><Text style={s.cardTitleSmall}>{card.t}</Text><Text style={s.cardBody}>{card.x}</Text></ScrollView>
                )}
              </Glass>
            </Pressable>
            <View style={s.btnRow}>
              <Pressable onPress={() => next(false)} style={({ pressed }) => [s.btn2, pressed && { opacity: 0.7 }]}><Text style={s.btn2Txt}>Still learning</Text></Pressable>
              <Pressable onPress={() => next(true)} style={({ pressed }) => [s.btn, { flex: 1, marginTop: 0 }, pressed && { opacity: 0.8 }]}><Text style={s.btnTxt}>Got it</Text></Pressable>
            </View>
            <Pressable onPress={() => onAsk && onAsk(`Explain "${card.t}" simply, with an example.`)} style={{ alignSelf: 'center', paddingVertical: 10 }}><Text style={s.link}>Ask Aria to explain this</Text></Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function styles(t) {
  return StyleSheet.create({
    page: { paddingHorizontal: 16 },
    col: { width: '100%', maxWidth: 740, alignSelf: 'center' },
    segWrap: { paddingHorizontal: 16, paddingBottom: 10, width: '100%', maxWidth: 740, alignSelf: 'center' },
    seg: { flexDirection: 'row', height: 40, padding: 4, alignItems: 'center' },
    segBtn: { flex: 1, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    segOn: { backgroundColor: t.dark ? 'rgba(255,255,255,0.16)' : '#FFFFFF' },
    segTxt: { color: t.label2, fontSize: 14.5, fontWeight: '600' },
    segTxtOn: { color: t.label },
    h1: { color: t.label, fontSize: 30, fontWeight: '700', letterSpacing: -0.4, marginTop: 6 },
    sub: { color: t.label2, fontSize: 15, lineHeight: 21, marginTop: 6 },
    section: { color: t.label2, fontSize: 13, marginTop: 24, marginLeft: 14 },
    list: { marginTop: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
    rowTitle: { flex: 1, color: t.label, fontSize: 16, fontWeight: '500' },
    rowMeta: { color: t.label2, fontSize: 14 },
    chev: { color: t.label3, fontSize: 20, marginTop: -2 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    link: { color: t.accent, fontSize: 16, fontWeight: '500' },
    track: { height: 4, borderRadius: 2, backgroundColor: t.fill, overflow: 'hidden', marginTop: 12, marginBottom: 14 },
    fill: { height: 4, borderRadius: 2, backgroundColor: t.accent },
    card: { flex: 1, padding: 22 },
    cardSubject: { color: t.label2, fontSize: 13, fontWeight: '600' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { color: t.label, fontSize: 26, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
    cardTitleSmall: { color: t.label, fontSize: 20, fontWeight: '700', marginTop: 10, marginBottom: 10 },
    cardBody: { color: t.label, fontSize: 16.5, lineHeight: 25 },
    hint: { color: t.label3, fontSize: 14, marginTop: 12 },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { marginTop: 22, backgroundColor: t.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center' },
    btnTxt: { color: t.onAccent, fontSize: 16.5, fontWeight: '600' },
    btn2: { flex: 1, backgroundColor: t.fill, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    btn2Txt: { color: t.label, fontSize: 16.5, fontWeight: '600' },
    search: { marginTop: 2, backgroundColor: t.fill, borderRadius: 12, paddingHorizontal: 12 },
    searchInput: { color: t.label, fontSize: 16.5, paddingVertical: 11 },
    resRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
    resBody: { color: t.label2, fontSize: 13.5, lineHeight: 19, marginTop: 2 },
    tag: { color: t.label3, fontSize: 12, marginTop: 3 },
    body: { color: t.label, fontSize: 17, lineHeight: 26, marginTop: 14 },
  });
}
