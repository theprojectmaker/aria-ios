import { useEffect } from 'react';

/* Lazy, lightweight on-device vision. Mounted only once the user actually uses a
   photo, so the small CV models (EfficientNet classifier + PaddleOCR) download on
   demand and coexist with the resident chat LLM without a big up-front download.
   Both take the SAME ImageBuffer produced by imageBuffer.js. */

// "golden_retriever" / "n02099601 golden retriever" -> "golden retriever"
export function pretty(label) {
  let str = String(label == null ? '' : label);
  str = str.replace(/^n\d+\s*/i, '').replace(/_/g, ' ').trim();
  return str.replace(/\s*,\s*/g, ', ');
}

export function composeVision(labels, textLines) {
  const parts = [];
  const top = (labels || []).filter((c) => c && c.confidence > 0.05).slice(0, 4);
  if (top.length) {
    const best = top[0];
    const rest = top.slice(1).map((c) => pretty(c.label)).filter(Boolean);
    let line = `I can see **${pretty(best.label)}** (${Math.round(best.confidence * 100)}% sure)`;
    if (rest.length) line += ` — it might also be ${rest.join(', ')}`;
    parts.push(line + '.');
  } else {
    parts.push('I had a look but couldn’t confidently name what’s in this one.');
  }
  const lines = (textLines || []).map((r) => (r && r.text ? r.text.trim() : '')).filter(Boolean);
  if (lines.length) parts.push(`\n**Text I can read:**\n${lines.slice(0, 12).join('\n')}`);
  return parts.join('\n');
}

// Renders nothing; drives the CV models and reports readiness + an analyze() fn.
export default function VisionEngine({ onStatus, onReady }) {
  const { models, useClassifier, useOpticalCharacterRecognizer } = require('react-native-executorch');
  // Resolve model configs defensively — executorch nests OCR under `ocr.PADDLE`
  // and reading `.DEFAULT` off a missing node would crash the whole engine.
  const clsNode = models.classification && models.classification.EFFICIENTNET_V2_S;
  const ocrNode =
    (models.ocr && models.ocr.PADDLE && models.ocr.PADDLE.PPOCRV6_SMALL) ||
    (models.ocr && models.ocr.PPOCRV6_SMALL) ||
    null;
  const cls = useClassifier(clsNode && clsNode.DEFAULT);
  const ocr = useOpticalCharacterRecognizer(ocrNode && ocrNode.DEFAULT);
  const ready = cls.isReady && ocr.isReady;

  useEffect(() => {
    if (!onStatus) return;
    const p = Math.min(cls.downloadProgress || 0, ocr.downloadProgress || 0) / 100; // executorch reports 0..100
    if (cls.error || ocr.error) {
      const msg = (cls.error && (cls.error.message || String(cls.error))) || (ocr.error && (ocr.error.message || String(ocr.error))) || 'vision load failed';
      onStatus({ state: 'error', detail: msg });
    }
    else if (!ready && p < 1) onStatus({ state: 'downloading', progress: p });
    else if (!ready) onStatus({ state: 'loading' });
    else onStatus({ state: 'ready' });
  }, [cls.isReady, ocr.isReady, cls.downloadProgress, ocr.downloadProgress, cls.error, ocr.error]);

  useEffect(() => {
    if (ready && onReady) {
      onReady(async (img) => {
        const [labels, textLines] = await Promise.all([
          cls.classify(img).catch(() => []),
          ocr.recognizeCharacters(img).catch(() => []),
        ]);
        // Hand back the RAW detections so the chat model can turn them into a
        // real, conversational answer; keep `summary` as a no-LLM fallback.
        return { labels: labels || [], textLines: textLines || [], summary: composeVision(labels, textLines) };
      });
    }
  }, [ready]);

  return null;
}
