/** Progressive topic navigation: without JS, every section and directory link remains available. */
export function initExhibition(): void {
  const workspace = document.querySelector<HTMLElement>('[data-exhibition]');
  if (!workspace) return;
  const links = [...workspace.querySelectorAll<HTMLAnchorElement>('[data-topic]')];
  const panels = [...workspace.querySelectorAll<HTMLElement>('[data-topic-panel]')];
  function select(id: string, focus: boolean): void {
    const target = panels.find(panel => panel.dataset.topicPanel === id);
    if (!target) return;
    for (const panel of panels) panel.hidden = panel !== target;
    for (const link of links) {
      if (link.dataset.topic === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    if (focus) target.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }
  function fromLocation(): string { return location.hash.startsWith('#topic-') ? location.hash.slice(7) : 'elections'; }
  select(panels.some(panel => panel.dataset.topicPanel === fromLocation()) ? fromLocation() : 'elections', false);
  for (const link of links) link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const id = link.dataset.topic;
    if (!id) return;
    history.pushState(null, '', `#topic-${id}`);
    select(id, true);
    if (matchMedia('(max-width: 800px)').matches) panels.find(panel => panel.dataset.topicPanel === id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  window.addEventListener('popstate', () => select(fromLocation(), false));
  window.addEventListener('hashchange', () => select(fromLocation(), false));
}
