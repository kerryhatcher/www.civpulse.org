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
export function serviceDates(term: OfficeTerm): string {
  const format = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  return `${format(term.starts_on)} – ${term.ends_on ? format(term.ends_on) : 'present'}`;
}
