export type ArticleVisibility = 'public' | 'unlisted' | 'private';

export interface Article {
  id: string;
  title: string;
  url: string;
  visibility: ArticleVisibility;
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
