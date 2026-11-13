/* Aria's chat engine — per-conversation memory on top of one loaded model.

   The stock useLLMChatSession keeps ONE growing history for the life of the
   model, so every chat shared memory ("x = 1" leaked into a new chat) and long
   chats eventually overflowed the context window. This engine owns the KV
   cache itself:
   - Each send carries the conversation's own history. If it is the same chat
     the model already holds, only the new message is prefilled (fast); if it
     is a different chat, the cache is reset and that chat's history is
     prefilled — so chats never see each other.
   - History is trimmed (oldest turns first) to fit the model's real context
     window (runner.getKVCacheState().maxSeqLen), and the reply budget is
     capped by the room left, so a conversation can't overflow.
   Built from the library's public pieces (createLLMRunner, chat preprocessor,
   wrapAsync) mirroring createLLMChatSession. */
import { scheduleOnRN } from 'react-native-worklets';
import RNBlobUtil from 'react-native-blob-util';
import { llm, wrapAsync, createResourceScope, useResourceDownload, useModel } from 'react-native-executorch';

function generateTurnWorklet(runner, prompt, options) {
  'worklet';
  const { genConfig, stopTokens, onToken } = options;
  let response = '';
  const callback = (token) => {
    if (stopTokens.includes(token)) return;
    response += token;
    if (onToken) scheduleOnRN(onToken, token);
  };
  const stats = runner.generate(prompt, genConfig, callback);
  return { response, stats };
}

const estTokens = (s) => Math.ceil(String(s || '').length / 3.2) + 6;

async function createAriaSession(config, options = {}) {
  const scope = createResourceScope();
  const dispose = scope.dispose;
  try {
    const { system = '', generationConfig = {} } = options;
    const tcfgStr = await RNBlobUtil.fs.readFile(config.tokenizerConfigPath, 'utf8');
    const { chatTemplate, stopTokens } = llm.parseTokenizerConfig(JSON.parse(tcfgStr));
    const pre = scope.track(llm.createChatPreprocessor({ chatTemplate, modalities: config.modalities, preprocessorConfig: config.preprocessorConfig, tools: undefined }));
    const runner = scope.track(await wrapAsync(llm.createLLMRunner)(config.modelPath, config.tokenizerPath, config.modalities));
    const prefill = wrapAsync(runner.prefill);
    const generate = wrapAsync(generateTurnWorklet);
    const sys = system ? [{ role: 'system', content: system }] : [];

    // What the KV cache currently holds.
    let ctxId = null;
    let msgs = [];     // [{role, content}] committed to the cache, incl. system
    let keys = [];     // UI-side identity of each message (plain user text / '*')
    let committed = 0;
    const maxSeq = () => { try { return runner.getKVCacheState().maxSeqLen || 2048; } catch (e) { return 2048; } };

    function fitHistory(history, reserve) {
      // Keep system + the newest turns that fit; drop oldest first.
      const budget = Math.max(256, maxSeq() - reserve - estTokens(system));
      const out = [];
      let used = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const t = estTokens(history[i].content);
        if (used + t > budget) break;
        out.unshift(history[i]);
        used += t;
      }
      while (out.length && out[0].role !== 'user') out.shift(); // start on a user turn
      return out;
    }

    /**
     * send(chatId, history, prompt, onToken, { maxNewTokens, temperature })
     *   history: prior turns [{role:'user'|'assistant', content, key?}] (plain text)
     *   prompt:  the message to send now (may include reference notes)
     * Resolves to the raw response text (may contain <think>…</think>).
     */
    async function send(chatId, history, prompt, onToken, genConfig = {}) {
      const want = Math.min(genConfig.maxNewTokens || generationConfig.maxNewTokens || 1024, Math.floor(maxSeq() * 0.6));
      const reserve = want + estTokens(prompt) + 32;
      const fitted = fitHistory(history, reserve);
      const fittedKeys = fitted.map((m) => (m.role === 'user' ? (m.key != null ? m.key : m.content) : '*'));
      const sameChat = ctxId === chatId && committed === msgs.length
        && keys.length === sys.length + fittedKeys.length
        && fittedKeys.every((k, i) => keys[sys.length + i] === k);
      if (!sameChat) {
        runner.reset(0);
        msgs = [...sys, ...fitted.map((m) => ({ role: m.role, content: m.content }))];
        keys = [...sys.map(() => 'sys'), ...fittedKeys];
        committed = 0;
        ctxId = chatId;
      }
      const startLen = msgs.length;
      const startCommitted = committed;
      msgs.push({ role: 'user', content: prompt });
      keys.push(genConfig.key != null ? genConfig.key : prompt);
      try {
        await prefill(pre.process(msgs, msgs.length - committed, { addGenPrompt: false }));
        pre.clear();
        committed = msgs.length;
        const posAtEndOfUser = runner.getKVCacheState().pos;
        const room = Math.max(64, maxSeq() - posAtEndOfUser - 16);
        const turnConfig = { ...generationConfig, ...genConfig, maxNewTokens: Math.min(want, room) };
        delete turnConfig.key;
        const genPrompt = pre.process(msgs, 0, { addGenPrompt: true });
        const { response } = await generate(runner, genPrompt, { genConfig: turnConfig, stopTokens, onToken });
        pre.clear();
        runner.reset(posAtEndOfUser);
        msgs.push({ role: 'assistant', content: response });
        keys.push('*');
        await prefill(pre.process(msgs, 1, { addGenPrompt: false }));
        pre.clear();
        committed = msgs.length;
        return response;
      } catch (err) {
        // Roll back so the next send rebuilds this chat cleanly.
        msgs.length = startLen; keys.length = startLen; committed = startCommitted;
        ctxId = null;
        try { pre.clear(); } catch (e) {}
        throw err;
      }
    }

    const stop = () => runner.stop();
    const forget = () => { ctxId = null; }; // next send rebuilds from the given history
    return { send, stop, forget, dispose, contextSize: maxSeq };
  } catch (error) {
    dispose();
    throw error;
  }
}

// Hook: same shape the app used before, plus per-chat send.
export function useAriaEngine(config, options) {
  const { resource, downloadProgress, downloadError } = useResourceDownload(config);
  const { model: session, error } = useModel((res) => createAriaSession(res, options), resource);
  return {
    isReady: !!session,
    error: downloadError || error,
    downloadProgress,
    send: session ? session.send : null,
    stop: session ? session.stop : null,
    forget: session ? session.forget : null,
    contextSize: session ? session.contextSize : () => 0,
  };
}
