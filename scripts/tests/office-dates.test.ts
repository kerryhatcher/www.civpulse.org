import { describe, expect, test } from 'bun:test';
import { parseServiceDate, serviceDates, type OfficeTerm } from '../../apps/web/src/lib/offices';
describe('official source date precision', () => {
  test('year-only dates preserve precision and use opposite interval bounds', () => {
    expect(parseServiceDate('2018', 'start')).toEqual({ date: '2018-01-01', precision: 'year' });
    expect(parseServiceDate('2024', 'end')).toEqual({ date: '2024-12-31', precision: 'year' });
    expect(parseServiceDate('', 'end')).toBeNull();
    expect(parseServiceDate(' 2024-02-29 ', 'start')).toEqual({ date: '2024-02-29', precision: 'day' });
  });
  test.each(['2023-02-29', '2024-02-30', '2024-13-01', '0000', '01/02/2024', '2024-1-01', 'today'])('rejects invalid date %s', value => {
    expect(() => parseServiceDate(value, 'start')).toThrow('valid date');
  });
  test('does not present stored year bounds as actual January/December dates', () => {
    const term = { starts_on: '2018-01-01', ends_on: '2024-12-31', starts_on_precision: 'year', ends_on_precision: 'year' } as OfficeTerm;
    expect(serviceDates(term)).toBe('2018 – 2024');
    expect(serviceDates({ ...term, ends_on: null })).toBe('2018 – present');
    expect(serviceDates({ ...term, starts_on: '2021-08-26', starts_on_precision: 'day' })).toBe('August 26, 2021 – 2024');
  });
});
