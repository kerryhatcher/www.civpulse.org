export interface Office {
  id: string;
  organization_id: string;
  name: string;
  district: string;
  seat: string;
  description: string | null;
}
export interface OfficeTerm {
  id: string;
  office_id: string;
  person_id: string;
  selection_method: 'elected' | 'appointed';
  starts_on: string;
  ends_on: string | null;
  source_url: string | null;
  starts_on_precision?: 'day' | 'year';
  ends_on_precision?: 'day' | 'year';
}
export interface ProfileOfficeTerm extends OfficeTerm {
  office_name: string;
  district: string;
  seat: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  person_name: string;
  person_slug: string;
  person_visibility: 'public' | 'unlisted' | 'private';
  service_status: 'current' | 'former' | 'upcoming';
}
export function officeLabel(office: { name: string; district: string; seat: string }): string {
  return [office.name, office.district, office.seat].filter(Boolean).join(' · ');
}
/** Preserve source precision; year bounds are for sorting, never exact service days. */
export function parseServiceDate(value: string, boundary: 'start' | 'end'): { date: string; precision: 'day' | 'year' } | null {
  const input = value.trim();
  if (!input) return null;
  const yearOnly = /^\d{4}$/.test(input);
  const date = yearOnly ? `${input}-${boundary === 'start' ? '01-01' : '12-31'}` : input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1) throw new Error('Use a valid date (YYYY-MM-DD) or year (YYYY).');
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Use a valid date (YYYY-MM-DD) or year (YYYY).');
  return { date, precision: yearOnly ? 'year' : 'day' };
}
export function serviceDates(term: OfficeTerm): string {
  const format = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  return `${term.starts_on_precision === 'year' ? term.starts_on.slice(0, 4) : format(term.starts_on)} – ${term.ends_on ? (term.ends_on_precision === 'year' ? term.ends_on.slice(0, 4) : format(term.ends_on)) : 'present'}`;
}
