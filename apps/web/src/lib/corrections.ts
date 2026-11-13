import { shouldNoIndex } from './indexing-policy.mjs';

export const CIVIC_PULSE_REPOSITORY = 'https://github.com/kerryhatcher/www.civpulse.org';
export const CORRECTION_ISSUES = `${CIVIC_PULSE_REPOSITORY}/issues`;
const site = 'https://www.civpulse.org';

/** Only generated public record route shapes may be prefilled. Never propagate
 * a viewer's UUID query, session parameters, fragment or arbitrary origin. */
export function publicCorrectionContext(path: string): string | null {
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  const url = new URL(path, site), pathname = url.pathname;
  if (url.origin !== site || shouldNoIndex(pathname)) return null;
  const profile = /^\/(people|orgs|maps|elections)\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
  const record = /^\/records\/(bills|votes|sessions|events|requests)\/[a-z0-9-]+\/$/;
  const history = /^\/(people|orgs)\/[a-z0-9-]+\/history\/(offices|candidacies|articles|votes|legislative-votes)\/[1-9]\d*\/$/;
  return profile.test(pathname) || record.test(pathname) || history.test(pathname) ? `${site}${pathname}` : null;
}

export function correctionReportUrl(path = ''): string {
  const context = publicCorrectionContext(path);
  const url = new URL(`${CORRECTION_ISSUES}/new`);
  url.searchParams.set('title', 'Correction report');
  url.searchParams.set('body', [
    `Public Civic Pulse page: ${context ?? '[add the public page URL]'}`,
    '', 'What is wrong or uncertain?', '', 'Proposed correction:', '',
    'Original source URL, source date/period, and relevant passage or timestamp:', '',
    'Additional context or uncertainty:', '',
    'This issue is public. Do not include private record links, account details, credentials or sensitive personal information.',
  ].join('\n'));
  return url.href;
}
