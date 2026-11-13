import {expect,test} from 'bun:test';
import {parseSimbliMinutes} from '../../apps/mcp/src/simbli-minutes';
import {expandCompact,expandedJsonbBytes,registerMeetingSourceImport} from '../../apps/mcp/src/meeting-source-import';
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
test('both voting representations and unaccounted trailing motions require review when ambiguous',()=>{
 const round=(Minutes:string,VotingHTML:string[])=>parseSimbliMinutes(envelope([{EncrId:'x',Title:'Motion',MeetingOnlineVotings:[{Minutes,VotingHTML}]}]));
 expect(round('Motion to approve.<br>Voting: Voter A: Yes',['Yes: Voter A']).warnings).toEqual([]);
 for(const html of [['Yes: Voter A','No: Voter B'],['No: Voter A']])expect(round('Motion to approve.<br>Voting: Voter A: Yes',html).warnings.some(w=>w.reason.includes('representations'))).toBe(true);
 expect(round('Motion to approve.<br>Voting: Voter A: Yes<br>Voter B: Not Present',['Yes: Voter A','Vote Not Recorded: Voter B']).warnings.some(w=>w.reason.includes('representations'))).toBe(true);
 expect(round('Motion to approve.<br>Voting: Voter A: Yes<br>Motion to adjourn without a recorded roll call.',[]).warnings.some(w=>w.reason.includes('final voting block'))).toBe(true);
});
test('expanded byte cap accounts for JSONB delimiter spaces at the boundary',()=>{
 const provenance={source_url:'https://example.test/minutes',document_sha256:'a'.repeat(64)};
 const motions=Array.from({length:21},(_,i)=>({source_key:'boundary-'+i,locator:'item '+i,subject:'Motion '+i,description:'',ballots:[]}));
 const empty=expandCompact(provenance,[],motions),cap=2*1024*1024;
 const perMotion=Math.floor((cap-expandedJsonbBytes(empty))/motions.length);
 for(const m of motions)m.description='x'.repeat(perMotion);
 const accepted=expandCompact(provenance,[],motions);expect(expandedJsonbBytes(accepted)).toBeLessThanOrEqual(cap);
 motions[0].description+='x'.repeat(cap-expandedJsonbBytes(accepted)+1);
 const raw=motions.map(m=>({kind:'vote',source_key:m.source_key,provenance:{...provenance,locator:m.locator},data:{subject:m.subject,description:m.description}}));
 expect(new TextEncoder().encode(JSON.stringify(raw)).length).toBeLessThanOrEqual(cap);
 expect(()=>expandCompact(provenance,[],motions)).toThrow('PostgreSQL JSONB');
});
test('checked attachment reconciliation compares exact ballot identities and evidence, not equal counts',async()=>{
 const [meeting,attachment,a,b,c,vote]=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
 const text=envelope([{EncrId:'item',Title:'Motion',MeetingOnlineVotings:[{Minutes:'Motion to approve.<br>Voting: Voter A: Yes<br>Voter B: No'}]}]);
 const bytes=new TextEncoder().encode(text),sha=new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),parsed=parseSimbliMinutes(text).motions[0];
 const provenance={source_url:'https://example.test/minutes',document_sha256:sha},motionKey='existing-motion';
 const expected=[a,b].map((person_id,i)=>({provider:'fixture',kind:'choice',vote_id:vote,person_id,source_key:`${motionKey}:person:${person_id}`,data:{choice:parsed.ballots[i].choice,original_text:parsed.ballots[i].text}}));
 let ballots:any[]=[],imports=0,run:any;
 const server:any={registerTool:(_name:any,_config:any,handler:any)=>{run=handler;}};
 const api:any={rpc:async(name:string)=>{
  if(name==='is_admin')return {data:true,error:null};
  if(name==='get_meeting')return {data:{status:'ok',attachments:[{id:attachment,meeting_id:meeting,mime_type:'text/plain',size_bytes:bytes.length,storage_path:meeting+'/fixture.txt',sha256:sha}],sources:[{provider:'fixture',kind:'vote',source_key:motionKey,vote_id:vote,data:{subject:parsed.subject,description:parsed.description},provenance},...ballots]},error:null};
  imports++;throw Error('Reconciliation must not write');
 },storage:{from:()=>({download:async()=>({data:new Blob([bytes]),error:null})})}};
 registerMeetingSourceImport(server,api);
 const input={meeting_id:meeting,provider:'fixture',provenance,dry_run:true,reconcile_only:true,motions:[],attendance:[],attachment:{id:attachment,adapter:'simbli-minutes-v1',people:[{name:'Voter A',person_id:a},{name:'Voter B',person_id:b}],source_keys:{[parsed.locator]:motionKey}}};
 const check=async(rows:any[])=>{ballots=rows;const result=await run(input);expect(result.isError).not.toBe(true);return JSON.parse(result.content[0].text).reconciliation[0];};
 const wrong={...expected[1],person_id:c,source_key:`${motionKey}:person:${c}`,data:{choice:'yes',original_text:'Voter C: Yes'}};
 const mismatched=await check([expected[0],wrong]);
 expect(mismatched.status).toBe('differs');expect(mismatched.stored_ballots).toBe(mismatched.document_ballots);
 expect(mismatched.missing_ballots).toEqual([{person_id:b,source_key:expected[1].source_key,source_name:'Voter B',choice:'no',original_text:'Voter B: No'}]);
 expect(mismatched.unexpected_ballots).toEqual([{person_id:c,source_key:wrong.source_key,choice:'yes',original_text:'Voter C: Yes'}]);expect(mismatched.differences).toHaveLength(2);
 expect((await check([expected[0]])).status).toBe('partial');
 expect((await check([...expected,wrong])).status).toBe('differs');
 expect((await check([expected[0],{...expected[1],source_key:'different-immutable-key'}])).status).toBe('differs');
 const changed=await check([expected[0],{...expected[1],data:{choice:'yes',original_text:'Voter B: Yes'}}]);expect(changed.status).toBe('differs');
 expect(changed.ballot_differences[0]).toMatchObject({person_id:b,source_key:expected[1].source_key,expected:{choice:'no',original_text:'Voter B: No'},stored:{choice:'yes',original_text:'Voter B: Yes'}});
 const complete=await check([...expected].reverse());expect(complete.status).toBe('complete');expect(complete.differences).toEqual([]);expect(imports).toBe(0);
 const empty=await run({...input,attachment:undefined,motions:[],attendance:[]});expect(JSON.parse(empty.content[0].text)).toMatchObject({status:'inventory_only',observations:0,comparison_performed:false});expect(imports).toBe(0);
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
 expect(parsed.motions).toHaveLength(motions);expect(parsed.motions.reduce((n,m)=>n+m.ballots.filter(b=>b.choice!=='unknown').length,0)).toBe(ballots);expect(parsed.warnings.every(w=>w.reason.length>0&&w.locator.length>0)).toBe(true); // Ambiguous dual representations require review, even in an existing capture.
 }
});
