/* Voice input using Apple's on-device speech recognition
   (expo-speech-recognition). Guarded: on a build without the native module
   (or on web) `available` is false and the mic button is hidden. */
import { useEffect, useRef, useState } from 'react';

function mod() {
  try { const m = require('expo-speech-recognition').ExpoSpeechRecognitionModule; return m && m.start ? m : null; } catch (e) { return null; }
}

export function useVoice(onText) {
  const M = useRef(mod()).current;
  const [listening, setListening] = useState(false);
  const cb = useRef(onText); cb.current = onText;

  useEffect(() => {
    if (!M) return;
    const subs = [
      M.addListener('result', (e) => { const tx = e && e.results && e.results[0] && e.results[0].transcript; if (tx) cb.current(tx, !!e.isFinal); }),
      M.addListener('end', () => setListening(false)),
      M.addListener('error', () => setListening(false)),
    ];
    return () => { subs.forEach((s) => s && s.remove && s.remove()); try { M.abort(); } catch (e) {} };
  }, []);

  const toggle = async () => {
    if (!M) return;
    if (listening) { try { M.stop(); } catch (e) {} return; }
    try {
      const p = await M.requestPermissionsAsync();
      if (!p.granted) return;
      let onDevice = false;
      try { onDevice = !!(M.supportsOnDeviceRecognition && M.supportsOnDeviceRecognition()); } catch (e) {}
      M.start({ lang: 'en-US', interimResults: true, continuous: false, requiresOnDeviceRecognition: onDevice, addsPunctuation: true });
      setListening(true);
    } catch (e) { setListening(false); }
  };

  return { available: !!M, listening, toggle };
}
