import { getPublicProfileSnapshot } from "../lib/profile-section-data";
import { historyLink } from '../lib/history';
import { articleFetchedLabel, articlePublishedLabel, articleUrl, type ProfileArticle } from '../lib/articles';
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
  const published = document.createElement('span'); published.className = 'candidate-meta';
  published.textContent = articlePublishedLabel(article.published_on);
  link.append(title, source, published, fetched, role); item.append(link, historyLink('articles', article.id));
  return item;
}

export async function loadProfileArticles(kind: 'person' | 'organization', id: string): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-profile-articles]');
  if (!root) return;
  const status = root.querySelector<HTMLElement>('[data-articles-status]')!;
  const list = root.querySelector<HTMLElement>('[data-profile-article-list]')!;
  root.querySelector('[data-article-pagination]')?.remove();
  root.querySelector('[data-article-retry]')?.remove();
  list.replaceChildren();
  root.hidden = false; status.hidden = false; status.textContent = 'Loading articles…';
  try {
    const supabase = getSupabase();
    await supabase.auth.getSession();
    const snapshot = await getPublicProfileSnapshot();
    const { data, error } = snapshot ? {data: snapshot.articles, error: null} : await supabase.rpc(kind === 'person' ? 'get_person_articles' : 'get_organization_articles',
      kind === 'person' ? { p_person_id: id } : { p_organization_id: id });
    if (error) throw error;
    const articles = ((data ?? []) as ProfileArticle[]).filter(article => articleUrl(article.url));
    const pages = document.createElement('nav');
    pages.dataset.articlePagination = '';
    pages.className = 'org-form-actions';
    pages.setAttribute('aria-label', 'Article pages');
    const previous = document.createElement('button'); previous.textContent = 'Previous articles';
    const next = document.createElement('button'); next.textContent = 'Next articles';
    const label = document.createElement('span');
    pages.append(previous, label, next); root.append(pages);
    let page = 0;
    const pageSize = 10;
    const render = () => {
      list.replaceChildren(...articles.slice(page * pageSize, (page + 1) * pageSize).map(renderArticle));
      previous.disabled = page === 0;
      next.disabled = (page + 1) * pageSize >= articles.length;
      label.textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(articles.length / pageSize))}`;
      pages.hidden = articles.length <= pageSize;
    };
    previous.onclick = () => { page--; render(); };
    next.onclick = () => { page++; render(); };
    render();
    status.textContent = `${articles.length} articles`;
    status.hidden = articles.length <= pageSize; root.hidden = articles.length === 0;
  } catch {
    status.textContent = 'Could not load articles. Please try again.';
    const retry = document.createElement('button');
    retry.textContent = 'Retry articles'; retry.dataset.articleRetry = '';
    retry.onclick = () => void loadProfileArticles(kind, id);
    root.append(retry);
  }
}

export function initProfileArticles(): void {
  const root = document.querySelector<HTMLElement>('[data-profile-articles]');
  if (root?.dataset.personId) void loadProfileArticles('person', root.dataset.personId);
  else if (root?.dataset.organizationId) void loadProfileArticles('organization', root.dataset.organizationId);
}
