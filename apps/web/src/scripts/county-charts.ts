/** Progressively enhance static chart sections into accessible topic tabs. */
export function initDemographicCharts(): void {
  const root = document.querySelector<HTMLElement>('[data-demographic-charts]');
  const tablist = root?.querySelector<HTMLElement>('[data-chart-tabs]');
  if (!root || !tablist) return;
  const tabs = [...tablist.querySelectorAll<HTMLButtonElement>('[data-chart-tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-chart-panel]')];
  const select = (index: number, focus = false): void => {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    if (focus) tabs[index]?.focus();
  };
  tablist.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      select(next, true);
    });
  });
  panels.forEach((panel, index) => {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabs[index]!.id);
    panel.tabIndex = 0;
  });
  select(0);
  tablist.hidden = false;
}
