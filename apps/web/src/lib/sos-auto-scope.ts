import { GEORGIA_COUNTIES } from './county-scope';
/** Use published names, never derive SOS IDs from county FIPS or combine scopes. */
export function automaticSosScope(county: string, jurisdictions: readonly { id: string; name: string }[]): string {
  const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+county$/, '').replace(/\s+/g, ' ');
  const target = county === 'all' ? null : GEORGIA_COUNTIES.find(item => item.fips === county)?.name;
  const matches = jurisdictions.filter(item => target ? normalize(item.name) === normalize(target) : county === 'all' && ['statewide', 'georgia', 'state of georgia'].includes(normalize(item.name)));
  return matches.length === 1 ? matches[0].id : '';
}
