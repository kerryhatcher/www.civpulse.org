import { articleUrl, type Article, type ArticlePerson, type ArticleOrganization } from '../lib/articles';
import { getSupabase } from '../lib/supabase';

interface Reference { id: string; name: string }

export async function initArticleAdmin(): Promise<void> {
  const gate = document.querySelector<HTMLElement>('[data-admin-gate]');
  const panel = document.querySelector<HTMLElement>('[data-admin-panel]');
  const form = document.querySelector<HTMLFormElement>('[data-article-form]');
  const list = document.querySelector<HTMLElement>('[data-article-list]');
  if (!gate || !panel || !form || !list) return;
  const gateEl = gate, panelEl = panel, formEl = form, listEl = list;
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.replace('/signin/?next=/admin/articles/'); return; }
  const { data: admin, error: adminError } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (adminError) { gateEl.textContent = 'Could not check access. Please reload to try again.'; return; }
  if (!admin) { gateEl.hidden = true; document.querySelector<HTMLElement>('[data-admin-denied]')!.hidden = false; return; }

  const peoplePicker = formEl.querySelector<HTMLElement>('[data-article-people]')!;
  const orgPicker = formEl.querySelector<HTMLElement>('[data-article-organizations]')!;
  const submit = formEl.querySelector<HTMLButtonElement>('[type=submit]')!;
  const cancel = formEl.querySelector<HTMLButtonElement>('[data-article-cancel]')!;
  const heading = formEl.querySelector<HTMLElement>('[data-article-form-title]')!;
  const search = document.querySelector<HTMLInputElement>('[data-article-search]')!;
  let articles: Article[] = [];
  let articlePeople: ArticlePerson[] = [];
  let articleOrganizations: ArticleOrganization[] = [];
  let people: Reference[] = [], organizations: Reference[] = [];
  let saving = false;

  function message(text: string, error = false, inList = false): void {
    const el = document.querySelector<HTMLElement>(inList ? '[data-article-list-message]' : '[data-article-message]')!;
    el.textContent = text; el.dataset.kind = error ? 'error' : 'success'; el.hidden = false;
  }
  function picker(container: HTMLElement, references: Reference[], kind: 'person' | 'organization'): void {
    container.replaceChildren();
    for (const ref of references) {
      const row = document.createElement('div'); row.className = 'article-association'; row.dataset.name = ref.name.toLocaleLowerCase();
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = ref.id;
      label.append(checkbox, ref.name);
      const role = document.createElement('input'); role.type = 'text'; role.maxLength = 80; role.value = 'Mentioned'; role.disabled = true;
      role.setAttribute('aria-label', `Relationship for ${ref.name}`); role.setAttribute('list', `article-${kind}-roles`);
      checkbox.addEventListener('change', () => { role.disabled = !checkbox.checked; });
      row.append(label, role); container.append(row);
    }
    if (!references.length) { const empty = document.createElement('p'); empty.className = 'status'; empty.textContent = `No ${kind === 'person' ? 'people' : 'organizations'} available.`; container.append(empty); }
  }
  function selection(container: HTMLElement): { id: string; role: string }[] {
    return [...container.querySelectorAll<HTMLElement>('.article-association')].flatMap(row => {
      const check = row.querySelector<HTMLInputElement>('[type=checkbox]')!;
      return check.checked ? [{ id: check.value, role: row.querySelector<HTMLInputElement>('[type=text]')!.value.trim() || 'Mentioned' }] : [];
    });
  }
  function fillPicker(container: HTMLElement, links: { id: string; role: string }[]): void {
    for (const row of container.querySelectorAll<HTMLElement>('.article-association')) {
      const check = row.querySelector<HTMLInputElement>('[type=checkbox]')!;
      const role = row.querySelector<HTMLInputElement>('[type=text]')!;
      const link = links.find(link => link.id === check.value);
      check.checked = Boolean(link); role.value = link?.role ?? 'Mentioned'; role.disabled = !link; row.hidden = false;
    }
  }
  function reset(): void {
    formEl.reset();
    (formEl.elements.namedItem('id') as HTMLInputElement).value = '';
    fillPicker(peoplePicker, []); fillPicker(orgPicker, []);
    heading.textContent = 'Add an article'; submit.textContent = 'Create article'; cancel.hidden = true;
  }
  function edit(article: Article): void {
    reset();
    for (const key of ['id', 'title', 'url', 'visibility'] as const) (formEl.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement).value = article[key];
    fillPicker(peoplePicker, articlePeople.filter(link => link.article_id === article.id).map(link => ({ id: link.person_id, role: link.role })));
    fillPicker(orgPicker, articleOrganizations.filter(link => link.article_id === article.id).map(link => ({ id: link.organization_id, role: link.role })));
    heading.textContent = 'Edit article'; submit.textContent = 'Save article'; cancel.hidden = false;
    formEl.querySelector<HTMLElement>('[data-article-message]')!.hidden = true;
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function associationLabels(article: Article): string[] {
    return [
      ...articlePeople.filter(link => link.article_id === article.id).map(link => `${people.find(p => p.id === link.person_id)?.name ?? 'Person'} · ${link.role}`),
      ...articleOrganizations.filter(link => link.article_id === article.id).map(link => `${organizations.find(o => o.id === link.organization_id)?.name ?? 'Organization'} · ${link.role}`),
    ];
  }
  function render(): void {
    const query = search.value.trim().toLocaleLowerCase();
    const matches = articles.filter(article => [article.title, article.url, ...associationLabels(article)].join(' ').toLocaleLowerCase().includes(query));
    listEl.replaceChildren();
    if (!matches.length) { const empty = document.createElement('p'); empty.className = 'status'; empty.textContent = query ? 'No articles match your search.' : 'No articles yet. Add the first one above.'; listEl.append(empty); }
    for (const article of matches) {
      const row = document.createElement('article'); row.className = 'org-row';
      const content = document.createElement('div');
      const title = document.createElement('a'); title.textContent = article.title; title.href = articleUrl(article.url) ?? '#'; title.target = '_blank'; title.rel = 'noopener noreferrer';
      const meta = document.createElement('p'); meta.className = 'article-admin-links'; meta.textContent = `${article.visibility} · ${article.url}`;
      const links = document.createElement('p'); links.className = 'article-admin-links'; links.textContent = associationLabels(article).join('; ') || 'Not linked to any profiles';
      content.append(title, meta, links);
      const actions = document.createElement('div'); actions.className = 'org-row-actions';
      const editButton = document.createElement('button'); editButton.type = 'button'; editButton.textContent = 'Edit'; editButton.disabled = saving; editButton.addEventListener('click', () => edit(article));
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete'; remove.disabled = saving;
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete “${article.title}” and all its profile links?`)) return;
        remove.disabled = true;
        try {
          const { error } = await supabase.from('articles').delete().eq('id', article.id).select('id').single();
          if (error) throw new Error(error.message);
          if ((formEl.elements.namedItem('id') as HTMLInputElement).value === article.id) reset();
          await load(); message('Article deleted.', false, true);
        } catch (error) {
          message(error instanceof Error ? error.message : String(error), true, true); remove.disabled = false;
        }
      });
      actions.append(editButton, remove); row.append(content, actions); listEl.append(row);
    }
  }
  async function load(): Promise<void> {
    const results = await Promise.all([
      supabase.from('articles').select('id, title, url, visibility').order('created_at', { ascending: false }).order('title'),
      supabase.from('article_people').select('article_id, person_id, role'),
      supabase.from('article_organizations').select('article_id, organization_id, role'),
    ]);
    const error = results.find(result => result.error)?.error;
    if (error) throw new Error(error.message);
    articles = (results[0].data ?? []) as Article[];
    articlePeople = (results[1].data ?? []) as ArticlePerson[];
    articleOrganizations = (results[2].data ?? []) as ArticleOrganization[];
    render();
  }
  try {
    const [peopleResult, orgResult] = await Promise.all([
      supabase.from('people').select('id, full_name').order('full_name'),
      supabase.from('organizations').select('id, name').order('name'),
    ]);
    if (peopleResult.error) throw new Error(peopleResult.error.message);
    if (orgResult.error) throw new Error(orgResult.error.message);
    people = (peopleResult.data ?? []).map(person => ({ id: person.id, name: person.full_name }));
    organizations = orgResult.data ?? [];
    picker(peoplePicker, people, 'person'); picker(orgPicker, organizations, 'organization');
    await load();
  } catch (error) { gateEl.textContent = `Could not load articles: ${error instanceof Error ? error.message : String(error)}. Please reload to try again.`; return; }

  for (const [input, container] of [
    [formEl.querySelector<HTMLInputElement>('[data-article-people-search]')!, peoplePicker],
    [formEl.querySelector<HTMLInputElement>('[data-article-organizations-search]')!, orgPicker],
  ] as const) input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase();
    for (const row of container.querySelectorAll<HTMLElement>('.article-association')) row.hidden = !row.dataset.name?.includes(query);
  });
  formEl.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !formEl.reportValidity()) return;
    const values = new FormData(formEl);
    const title = String(values.get('title') ?? '').trim();
    const url = articleUrl(String(values.get('url') ?? ''));
    if (!title || !url) { message('A title and an HTTP or HTTPS article URL without embedded credentials are required.', true); return; }
    saving = true; submit.disabled = true; cancel.disabled = true; render(); message('Saving…');
    try {
      const { error } = await supabase.rpc('save_article', {
        p_id: String(values.get('id') ?? '') || null, p_title: title, p_url: url, p_visibility: String(values.get('visibility') ?? 'public'),
        p_people: selection(peoplePicker).map(link => ({ person_id: link.id, role: link.role })),
        p_organizations: selection(orgPicker).map(link => ({ organization_id: link.id, role: link.role })),
      });
      if (error) throw new Error(error.code === '23505' ? 'An article with that URL already exists. Edit it to add more profile links.' : error.message);
      reset(); message('Article saved.'); await load();
    } catch (error) { message(error instanceof Error ? error.message : String(error), true); }
    finally { saving = false; submit.disabled = false; cancel.disabled = false; render(); }
  });
  cancel.addEventListener('click', reset); search.addEventListener('input', render);
  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) { const article = articles.find(article => article.id === editId); if (article) edit(article); }
  gateEl.hidden = true; panelEl.hidden = false;
}
