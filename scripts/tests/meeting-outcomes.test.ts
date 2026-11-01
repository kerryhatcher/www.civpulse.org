import {expect,test} from 'bun:test';
import {outcomeEvidence,outcomeLabel,publicOutcomeFields} from '../../apps/web/src/lib/meeting-outcomes';
import {profileEvidence} from '../../apps/web/src/lib/profile-evidence';
import {emptyProfileSections} from '../../apps/web/src/lib/profile-sections';
const observation={id:'observation',outcome:'passed',source_url:'https://example.test/minutes.pdf',document_sha256:'a'.repeat(64),locator:'Page 2 <script>bad</script>',created_at:'2026-01-02T00:00:00Z',supersedes_id:null,correction_reason:null};
test('cited evidence separates original outcomes, immutable sources and later corrections without inventing source dates',()=>{
 const vote={outcome:'failed',original_outcome:null,outcome_observations:[observation,{...observation,id:'correction',outcome:'failed',supersedes_id:observation.id,correction_reason:'Wrong motion <script>bad</script>'}],original_sources:[{provider:'official',source_key:'item:7',data:{outcome:null},provenance:{source_url:'https://example.test/agenda.json',document_sha256:'b'.repeat(64),locator:'item[7]'}}]};
 const evidence=outcomeEvidence(vote);expect(evidence.lines).toContain('Original recorded outcome: Not recorded.');expect(evidence.lines.join('\n')).toContain('Earlier cited outcome: Passed');expect(evidence.lines.join('\n')).toContain('Current cited outcome: Failed');expect(evidence.lines.join('\n')).toContain('This is not the source publication date');expect(evidence.links).toHaveLength(3);
 const profile=emptyProfileSections();profile.votes=[{...vote,vote_id:'vote',meeting_id:'meeting',meeting_title:'Committee meeting',starts_at:'2026-01-01T18:00:00Z',organization_name:'Committee',subject:'Motion',description:null,choice:'yes'}];
 const section=profileEvidence(profile,'people').votes;expect(section.rows[0].lines[0]).toBe('Vote: yes · Outcome: Failed');expect(section.rows[0].links).toContainEqual({label:'Current outcome source',href:observation.source_url});expect(section.rows[0].lines.join('\n')).toContain('Original recorded outcome: Not recorded');
 expect(outcomeLabel(null)).toBe('Not recorded');expect(outcomeEvidence({outcome:null})).toEqual({lines:[],links:[]});
 expect(outcomeEvidence({...vote,outcome_observations:[{...observation,source_url:'javascript:alert(1)'}]}).links.some(l=>l.href.startsWith('javascript:'))).toBe(false);
 const sanitized=publicOutcomeFields({...vote,outcome_observations:[{...observation,created_by:'HIDDEN_ACCOUNT',sequence:10} as any]});expect(JSON.stringify(sanitized)).not.toContain('HIDDEN_ACCOUNT');expect(JSON.stringify(sanitized)).not.toContain('sequence');
});
