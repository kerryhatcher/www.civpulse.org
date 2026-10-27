import { afterEach, beforeEach, expect, test } from 'bun:test';
import { restoreSectionAnchorAfter } from '../../apps/web/src/scripts/section-anchors';
const globals = globalThis as unknown as Record<string, unknown>;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
let windowFixture: EventTarget & { location: { hash: string } };
let scrolls: number;
let visible: boolean;
let shareable: boolean;
let found: boolean;
beforeEach(() => {
  scrolls = 0; visible = true; shareable = true; found = true;
  windowFixture = Object.assign(new EventTarget(), { location: { hash: '#precinct-turnout' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowFixture });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    getElementById: (id: string) => found && id === 'precinct-turnout' ? {
      closest: () => shareable ? {} : null,
      getClientRects: () => visible ? [{}] : [],
      scrollIntoView: () => { scrolls++; },
    } : null,
  } });
});
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globals.window;
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else delete globals.document;
});
/** Keep runtime loading pending until a test explicitly completes it. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
test('waits for runtime layout before restoring a visible deep link', async () => {
  const load = deferred();
  restoreSectionAnchorAfter(load.promise);
  expect(scrolls).toBe(0);
  load.resolve(); await load.promise;
  expect(scrolls).toBe(1);
});
test('respects navigation input while data is loading', async () => {
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    const load = deferred(); restoreSectionAnchorAfter(load.promise);
    windowFixture.dispatchEvent(new Event(type)); load.resolve(); await load.promise;
    expect(scrolls).toBe(0);
  }
});
test('does not restore an obsolete fragment after the visitor changes it', async () => {
  const load = deferred(); restoreSectionAnchorAfter(load.promise);
  windowFixture.location.hash = '#ballot'; load.resolve(); await load.promise;
  expect(scrolls).toBe(0);
});
test('ignores hidden, missing or unrelated targets and malformed fragments', async () => {
  for (const scenario of ['hidden', 'missing', 'unrelated', 'malformed', 'empty']) {
    visible = scenario !== 'hidden'; found = scenario !== 'missing'; shareable = scenario !== 'unrelated';
    windowFixture.location.hash = scenario === 'malformed' ? '#%E0%A4%A' : scenario === 'empty' ? '' : '#precinct-turnout';
    const load = Promise.resolve(); restoreSectionAnchorAfter(load); await load;
    expect(scrolls).toBe(0);
  }
});
test('can land on the section’s error state after a failed read', async () => {
  const load = Promise.reject(new Error('Unavailable'));
  restoreSectionAnchorAfter(load);
  await load.catch(() => undefined);
  expect(scrolls).toBe(1);
});
