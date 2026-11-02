import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import ChatUI from './ChatUI';
import { useTheme } from './theme';

const ENABLED_KEY = 'aria.vision.enabled.v1';

const VISION_DOWNLOAD = {
  title: 'Set up Vision',
  body: 'Download the on-device vision models once so Aria can see your photos — identify what’s in them and read any text, right on your phone. It needs the internet this one time. After that, it works completely offline.',
  sizeNote: 'A small one-time download · stored on your device',
};

class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch() {}
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

// Turn a label like "golden retriever" / "n02099601 golden_retriever" into clean text.
function pretty(label) {
  let s = String(label == null ? '' : label);
  s = s.replace(/^n\d+\s*/i, '').replace(/_/g, ' ').trim();
  return s.replace(/\s*,\s*/g, ', ');
}

function compose(labels, textLines) {
  const parts = [];
  const top = (labels || []).filter((c) => c && c.confidence > 0.04).slice(0, 4);
  if (top.length) {
    const best = top[0];
    const rest = top.slice(1).map((c) => pretty(c.label)).filter(Boolean);
    let line = `I can see **${pretty(best.label)}** (${Math.round(best.confidence * 100)}% sure)`;
    if (rest.length) line += ` — it might also be ${rest.join(', ')}`;
    parts.push(line + '.');
  } else {
    parts.push("I had a look but couldn’t confidently name what’s in this one.");
  }
  const lines = (textLines || []).map((r) => (r && r.text ? r.text.trim() : '')).filter(Boolean);
  if (lines.length) {
    const shown = lines.slice(0, 12).join('\n');
    parts.push(`\n**Text I can read:**\n${shown}`);
  }
  return parts.join('\n');
}

function VisionModel({ t }) {
  const RNE = require('react-native-executorch');
  const { models, useClassifier, useOpticalCharacterRecognizer } = RNE;
  const cls = useClassifier(models.classification.EFFICIENTNET_V2_S.DEFAULT);
  const ocr = useOpticalCharacterRecognizer(models.ocr.PPOCRV6_SMALL.DEFAULT);

  const [messages, setMessages] = useState([]);
  const [attachedUri, setAttachedUri] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [working, setWorking] = useState(false);
  const attachRef = useRef(null);

  const clearAttach = () => { attachRef.current = null; setAttachedUri(null); };
  const ready = cls.isReady && ocr.isReady;

  const status = (() => {
    if (cls.error || ocr.error) return { state: 'unavailable', label: 'Could not load vision models' };
    const p = Math.min(cls.downloadProgress || 0, ocr.downloadProgress || 0);
    if (!ready && p < 1) return { state: 'downloading', progress: p, label: `Downloading ${Math.round(p * 100)}%` };
    if (!ready) return { state: 'loading', label: 'Loading vision models…' };
    return { state: 'ready', label: preparing ? 'Reading photo…' : 'On-device · ready' };
  })();

  const capture = useCallback(async (mode) => {
    try {
      const IP = require('expo-image-picker');
      if (mode === 'camera') { const p = await IP.requestCameraPermissionsAsync(); if (!p.granted) return; }
      const res = mode === 'camera'
        ? await IP.launchCameraAsync({ quality: 1 })
        : await IP.launchImageLibraryAsync({ mediaTypes: (IP.MediaTypeOptions && IP.MediaTypeOptions.Images) || 'images', quality: 1 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const uri = res.assets[0].uri;
      setAttachedUri(uri);
      setPreparing(true);
      const { uriToImageBuffer } = require('./imageBuffer');
      attachRef.current = await uriToImageBuffer(uri);
    } catch (e) { clearAttach(); } finally { setPreparing(false); }
  }, []);

  const pickImage = useCallback(() => {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take Photo', onPress: () => capture('camera') },
      { text: 'Choose Photo', onPress: () => capture('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [capture]);

  const onSend = useCallback(async () => {
    const img = attachRef.current;
    if (!img || working || preparing || !ready) return;
    const uri = attachedUri;
    clearAttach();
    const base = [...messages, { role: 'user', text: '', imageUri: uri }];
    setMessages([...base, { role: 'assistant', text: '', streaming: true }]);
    setWorking(true);
    let reply = '';
    try {
      const [labels, textLines] = await Promise.all([
        cls.classify(img).catch(() => []),
        ocr.recognizeCharacters(img).catch(() => []),
      ]);
      reply = compose(labels, textLines);
    } catch (e) {
      reply = "Sorry, I couldn’t read that photo. Try another one.";
    }
    setMessages([...base, { role: 'assistant', text: reply, streaming: false }]);
    setWorking(false);
  }, [attachedUri, messages, working, preparing, ready, cls, ocr]);

  return (
    <ChatUI
      t={t}
      messages={messages}
      input=""
      setInput={() => {}}
      onSend={onSend}
      onStop={() => {}}
      generating={working}
      status={status}
      onDownload={() => {}}
      onPickExample={() => {}}
      onPickImage={pickImage}
      attachedUri={attachedUri}
      onClearImage={clearAttach}
      canSend={ready && !preparing && !!attachedUri}
      title="Vision"
      greetTitle="Point at anything"
      greetSub="Add a photo and Aria will tell you what’s in it and read any text — all on your phone, nothing uploaded."
      placeholder="Add a photo to analyze"
      examples={[]}
      download={VISION_DOWNLOAD}
    />
  );
}

export default function VisionNative() {
  const t = useTheme();
  const onVision = (usePathname() || '').startsWith('/vision');
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ENABLED_KEY).then((v) => { if (v === '1') setEnabled(true); setChecked(true); });
  }, []);

  const enable = () => { setEnabled(true); AsyncStorage.setItem(ENABLED_KEY, '1').catch(() => {}); };

  // Only load the vision models while this tab is open, so they never coexist
  // with the chat model.
  if (!onVision || !checked) {
    return (
      <ChatUI
        t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
        generating={false} status={{ state: 'loading', label: 'Opening…' }}
        onDownload={() => {}} onPickExample={() => {}} title="Vision"
      />
    );
  }

  if (!enabled) {
    return (
      <ChatUI
        t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
        generating={false} status={{ state: 'needs-download', label: 'Vision models not downloaded' }}
        onDownload={enable} onPickExample={() => {}} title="Vision" download={VISION_DOWNLOAD}
      />
    );
  }

  const fallback = (
    <ChatUI
      t={t} messages={[]} input="" setInput={() => {}} onSend={() => {}} onStop={() => {}}
      generating={false} status={{ state: 'unavailable', label: 'Needs the installed app' }}
      onDownload={() => {}} onPickExample={() => {}} title="Vision"
    />
  );

  return (
    <Boundary fallback={fallback}>
      <VisionModel t={t} />
    </Boundary>
  );
}
