export type ArticleVisibility = 'public' | 'unlisted' | 'private';

export interface Article {
  id: string;
  title: string;
  url: string;
  visibility: ArticleVisibility;
  fetched_on: string | null;
}

export interface ArticlePerson {
  article_id: string;
  person_id: string;
  role: string;
}

export interface ArticleOrganization {
  article_id: string;
  organization_id: string;
  role: string;
}

export interface ProfileArticle extends Article {
  role: string;
}

export function articleUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function articleFetchedLabel(value: string | null | undefined): string {
  if (!value) return 'Fetched on: unknown';
  const date = new Date(`${value}T00:00:00Z`);
  return `Fetched on: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}
