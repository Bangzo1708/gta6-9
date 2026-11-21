// Save games: one localStorage slot holding the chapter, the cash and the
// variant Mara last played. Loading never throws — a bad slot is ignored.
const KEY = 'solano-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      chapter: typeof data.chapter === 'number' ? Math.max(0, Math.min(7, data.chapter | 0)) : 0,
      cash: typeof data.cash === 'number' ? Math.max(0, data.cash | 0) : 0,
      variant: typeof data.variant === 'string' ? data.variant : 'solano',
      kills: typeof data.kills === 'number' ? data.kills : 0,
    };
  } catch (e) {
    return null;
  }
}

export function writeSave(S) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      chapter: S.chapter,
      cash: S.cash,
      variant: S.variantId,
      kills: S.player ? S.player.kills : 0,
    }));
    S.saveDirty = false;
  } catch (e) {
    // Storage full or blocked: the game keeps running without a save.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
