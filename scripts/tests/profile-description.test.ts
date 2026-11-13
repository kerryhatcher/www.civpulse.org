import { expect, test } from 'bun:test';
import { renderProfileDescription } from '../../apps/web/src/lib/profile-description';

test('profile links and paragraph breaks render with readable labels', () => {
  const html = renderProfileDescription('Amy Morton ran for the [Bibb County Board of Education](/orgs/bibb-county-board-of-education/).\n\nSee [election coverage](https://example.org/results?a=1&b=2).');
  expect(html).toContain('<a href="/orgs/bibb-county-board-of-education/">Bibb County Board of Education</a>');
  expect(html).toContain('<a href="https://example.org/results?a=1&amp;b=2">election coverage</a>');
  expect(html.match(/<p>/g)).toHaveLength(2);
  expect(html).not.toContain('[election coverage]');
});

test('untrusted descriptions cannot inject markup or executable URLs', () => {
  const html = renderProfileDescription('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29) [encoded](jav&#x61;script:alert%281%29) ![image](data:text/html,bad)');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img src=x');
  expect(html).not.toMatch(/(?:href|src)="(?:javascript|data):/i);
  expect(html).toContain('&lt;script&gt;');
});
