import { articleFetchedLabel, articleUrl, type ProfileArticle } from '../lib/articles';
import { getSupabase } from '../lib/supabase';

function renderArticle(article: ProfileArticle): HTMLLIElement {
  const item = document.createElement('li');
  const url = articleUrl(article.url);
  const link = document.createElement('a');
  link.className = 'org-card profile-article-card';
  link.href = url ?? '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const title = document.createElement('h3'); title.textContent = article.title;
  const source = document.createElement('span');
  source.className = 'candidate-meta';
  source.textContent = url ? new URL(url).hostname.replace(/^www\./, '') : '';
  const role = document.createElement('span'); role.className = 'affiliation-role'; role.textContent = article.role;
  const fetched = document.createElement('span'); fetched.className = 'candidate-meta';
  fetched.textContent = articleFetchedLabel(article.fetched_on);
  link.append(title, source, fetched, role); item.append(link);
  return item;
}

export async function loadProfileArticles(kind: 'person' | 'organization', id: string): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-profile-articles]');
  if (!root) return;
  const status = root.querySelector<HTMLElement>('[data-articles-status]')!;
  const list = root.querySelector<HTMLElement>('[data-profile-article-list]')!;
  list.replaceChildren();
  root.hidden = false; status.hidden = false; status.textContent = 'Loading articles…';
  try {
    const supabase = getSupabase();
    await supabase.auth.getSession();
    const { data, error } = await supabase.rpc(kind === 'person' ? 'get_person_articles' : 'get_organization_articles',
      kind === 'person' ? { p_person_id: id } : { p_organization_id: id });
    if (error) throw error;
    const articles = ((data ?? []) as ProfileArticle[]).filter(article => articleUrl(article.url));
    list.replaceChildren(...articles.map(renderArticle));
    status.hidden = true; root.hidden = articles.length === 0;
  } catch {
    status.textContent = 'Could not load articles. Please reload to try again.';
  }
}

export function initProfileArticles(): void {
  const root = document.querySelector<HTMLElement>('[data-profile-articles]');
  if (root?.dataset.personId) void loadProfileArticles('person', root.dataset.personId);
  else if (root?.dataset.organizationId) void loadProfileArticles('organization', root.dataset.organizationId);
}
