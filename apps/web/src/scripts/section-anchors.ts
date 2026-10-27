/** Re-align a deep link after runtime sections change the page's layout. */
export function restoreSectionAnchorAfter(loaded: Promise<unknown>): void {
  const hash = window.location.hash;
  if (!hash) return;
  let id: string;
  try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
  const controller = new AbortController();
  let interacted = false;
  const cancel = () => { interacted = true; };
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    window.addEventListener(type, cancel, { passive: true, signal: controller.signal });
  }
  function restore() {
    controller.abort();
    // A visitor who has started navigating should keep control of the viewport.
    if (interacted || window.location.hash !== hash) return;
    const target = document.getElementById(id);
    if (target?.closest('[data-shareable-section]') && target.getClientRects().length) {
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  void loaded.then(restore, restore);
}
