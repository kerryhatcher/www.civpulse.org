const preferenceKey = 'civpulse:sos-results-sound';
/** Audio is unlocked only by a trusted gesture; unsuccessful audio never blocks results. */
export function createSosResultsSound(button: HTMLButtonElement) {
  let enabled = true, context: AudioContext | undefined, disposed = false;
  try { enabled = localStorage.getItem(preferenceKey) !== 'muted'; } catch { /* Storage can be unavailable. */ }
  const update = () => {
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? 'Update sound: on' : 'Update sound: muted';
    button.title = enabled ? 'Soft ding after changed results; starts after you interact with this page.' : 'Enable a soft ding after changed results.';
  };
  const unlock = (event: Event) => {
    if (!event.isTrusted || !enabled || disposed) return;
    try {
      context ??= new AudioContext();
      if (context.state === 'suspended') void context.resume().catch(() => {});
    } catch { /* Unsupported or browser-blocked audio remains silent. */ }
  };
  const toggle = (event: Event) => {
    enabled = !enabled;
    try { localStorage.setItem(preferenceKey, enabled ? 'enabled' : 'muted'); } catch { /* Keep the in-page preference. */ }
    update();
    unlock(event);
  };
  update();
  button.addEventListener('click', toggle);
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  return {
    play() {
      if (!enabled || disposed || context?.state !== 'running') return;
      try {
        const now = context.currentTime;
        for (const [frequency, volume] of [[880, 0.045], [1760, 0.012]]) {
          const oscillator = context.createOscillator(), gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(volume, now + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
          oscillator.connect(gain); gain.connect(context.destination);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(now); oscillator.stop(now + 0.8);
        }
      } catch { /* Notification failures must not interrupt publication. */ }
    },
    dispose() {
      disposed = true;
      button.removeEventListener('click', toggle);
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      if (context) void context.close().catch(() => {});
    },
  };
}
