# Aria

A private AI assistant that runs **entirely on your iPhone** — no internet, nothing
leaves your device. Two things, both fully offline:

- **Chat** — ask questions and get help writing. On-device LLM (Qwen3-1.7B on iPhone,
  Qwen3-0.6B on iPad). Saved conversations, markdown replies, long-press to copy,
  a chats drawer, and a one-time model download gate.
- **Vision** — add a photo and ask Aria about it. On-device vision-language model
  (LFM2.5-VL-450M).

Built with Expo SDK 57 + [react-native-executorch](https://github.com/software-mansion/react-native-executorch)
(ExecuTorch). Clean Apple-style UI (SF typography, rounded cards, system colors,
light + dark, a signature indigo accent).

## Develop
```
npm install
npx expo start --web     # UI preview (shows a demo — the real model needs a device build)
```

## Pre-build check (always, before a device build)
```
npm run check-sdk                       # all expo-* packages match the SDK
npx expo export --platform ios          # must exit 0 (catches native-only resolution errors)
```

## Ship
See [SHIP.md](SHIP.md) — free iOS builds via GitHub Actions + TestFlight.

## How it stays offline & memory-safe
- Models download once on first use, then run locally forever.
- Only one heavy model is resident at a time — the Chat model unloads when you open
  Vision, and vice-versa, so the phone never tries to hold both (avoids OOM).
- Qwen3 reasons inside `<think>…</think>`; Aria strips that and shows only the answer.
