import {expect,test} from 'bun:test';
import {parseSimbliMinutes} from '../../apps/mcp/src/simbli-minutes';
import {expandCompact} from '../../apps/mcp/src/meeting-source-import';
export const envelope=(items:any[])=>JSON.stringify([{document:{role:'Minutes',source_url:'https://example.test/minutes'},public_content:{LstItemMinutes:items}}]);
export const syntheticMinutes=()=>envelope([
 {EncrId:'public-item-a',Title:'I. Example agenda',MeetingOnlineVotings:[{Minutes:'Motion to approve A.<br>Motion made by: Voter A<br>Voting: Voter A: Yes<br>Motion to approve B.<br>Motion made by: Voter A<br>Voting: Voter A: No',VotingHTML:[null,null,'']}]},
 {EncrId:'public-item-b',Title:'II. Example agenda',MeetingOnlineVotings:[{Minutes:'Motion to adjourn.',VotingHTML:['Motion made by: Voter A',null,'<li>Yes: Voter A</li><li>Not Present: Voter B</li>']}]}
]);
test('real envelope shapes: multiple text rounds and HTML named ballots, with truthful unknowns',()=>{
 const r=parseSimbliMinutes(syntheticMinutes());expect(r.motions).toHaveLength(3);expect(r.motions.map(m=>m.ballots.map(b=>b.choice))).toEqual([['yes'],['no'],['yes']]);expect(r.warnings).toEqual([]);expect(r.motions[2].absences).toHaveLength(1);
 expect(parseSimbliMinutes(envelope([{EncrId:'x',Title:'Agenda',MeetingOnlineVotings:[{Minutes:'Motion made by Voter A. Voting: unanimous'}]}])).warnings).toHaveLength(2);
 expect(()=>parseSimbliMinutes('arbitrary prose')).toThrow('Unsupported');
 expect(()=>parseSimbliMinutes(syntheticMinutes().replace('No','Maybe'))).not.toThrow(); // unsupported block is reported, never normalized
 const escaped=parseSimbliMinutes(envelope([{EncrId:'x',Title:'Agenda',MeetingOnlineVotings:[{Minutes:'<script>Voting: Secret: Yes</script>Motion voted on with no roll call'}]}]));expect(escaped.motions).toEqual([]);expect(escaped.warnings).toHaveLength(1);
});
test('compact expansion stamps one provenance and retains explicit IDs/wording at 150 observations',()=>{
 const person='00000000-0000-4000-8000-000000000001',provenance={source_url:'https://example.test/minutes',document_sha256:'a'.repeat(64)};
 const motions=Array.from({length:75},(_,i)=>({source_key:'m'+i,locator:'item '+i,subject:'Motion '+i,ballots:i<74?[{person_id:person,choice:'yes' as const,text:'Yes: Voter A'}]:[]}));
 const rows=expandCompact(provenance,[{source_key:'attendance',locator:'named ballot',person_id:person,status:'observed',evidence:'Yes: Voter A'}],motions);
 expect(rows).toHaveLength(150);expect(rows.every(r=>r.provenance.document_sha256===provenance.document_sha256)).toBe(true);expect(rows[2].data.person_id).toBe(person);
 expect(()=>expandCompact(provenance,[],[motions[0],motions[0]])).toThrow('Duplicate');
});

test.skipIf(!process.env.MEETING_SOURCE_CAPTURE_ROOT)('private local capture count validation, without committing source bytes',async()=>{
 for(const [name,motions,ballots]of [['aug',7,49],['jul',18,129]] as const){
 const parsed=parseSimbliMinutes(await Bun.file(`${process.env.MEETING_SOURCE_CAPTURE_ROOT}/issue140-${name}.txt`).text());
 expect(parsed.motions).toHaveLength(motions);expect(parsed.motions.reduce((n,m)=>n+m.ballots.filter(b=>b.choice!=='unknown').length,0)).toBe(ballots);expect(parsed.warnings).toEqual([]);
 }
});
