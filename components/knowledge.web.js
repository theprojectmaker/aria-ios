/* Web stub — the offline knowledge pack is a ~9 MB bundled corpus that only
   ships in the native app. The web preview skips it to stay light. */
export function loadKnowledge() { return Promise.resolve(); }
export function knowledgeReady() { return false; }
export function knowledgeCount() { return 0; }
export function retrieve() { return []; }
export function buildContext() { return ''; }
