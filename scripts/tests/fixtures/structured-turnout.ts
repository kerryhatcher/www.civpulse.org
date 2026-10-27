import counties from '../../data/georgia-counties.json';
export function fixture(election:string){
 return {schema_version:1,provider:'georgia-sos-turnout',election_id:election,election_date:'2026-11-03',status:'unofficial',
 source_url:'https://sos.ga.gov/page/election-data-hub-unofficial-turnout',app_id:'137c0a43-928b-427a-a267-eb55aa7fa8a9',
 capture_run_id:crypto.randomUUID(),captured_at:'2026-10-27T00:18:37Z',upstream_sha256:'a'.repeat(64),
 tables:[['early','7cc869cd-2124-43be-82f4-1c8d394dc6d8',['accepted']],['absentee','CTgPMg',['requested','issued','returned','accepted','rejected','spoiled_canceled','outstanding','acceptance_ratio']],['turnout','QDFdpV',['turnout']]].map(([table,id,keys])=>({table,object_id:id,source_title:'Synthetic test table',as_of_label:'',as_of:null,as_of_timezone:'America/New_York',rows:counties.flatMap(c=>(table==='turnout'?['Early In-Person','Absentee']:[table==='early'?'Early In-Person':'Absentee']).map(style=>({county_fips:c.fips,county_label:c.name.toUpperCase(),ballot_style:style,counting_group:style==='Early In-Person'?'advance':'absentee_mail',locator:`${id}: County=${c.name}; Ballot Style=${style}`,measures:Object.fromEntries((keys as string[]).map(k=>[k,{value:k==='acceptance_ratio'?0.5:100,display:k==='acceptance_ratio'?'50%':'100'}]))})))}))};
}
