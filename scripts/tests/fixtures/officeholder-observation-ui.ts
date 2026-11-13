import {loadOfficeholderObservations} from '../../../apps/web/src/scripts/officeholder-observations';
const output=document.createElement('pre');document.body.append(output);let assertions=0;
const ok=(v:unknown,message:string)=>{if(!v)throw Error(message);assertions++;};
const row=(name:string)=>({id:name,revision:1,superseded:false,person_slug:null,organization_slug:'synthetic',payload:{reported_person:name,reported_office:'Chair',reported_organization:'Synthetic',role:'Chair',precision:'unknown',as_of:null,source_url:'https://example.test/source',document_sha256:'a',retrieved_on:'2026-11-01',locator:'row',review_status:'unresolved'}});
function setup(){document.querySelector('section')?.remove();const root=document.createElement('section');root.dataset.officeholderObservations='';root.innerHTML='<form><input name="as_of" type="date"><input name="history" type="checkbox"><button>Filter</button></form><p data-observation-status></p><ul data-observation-list></ul><button data-observation-next>Next</button><button data-observation-export>Export</button>';document.body.append(root);return root;}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));let calls:any[]=[],replies:any[]=[];
(window as any).fixtureRPC=async(_n:string,args:any)=>{calls.push(args);return replies.shift()(args);};
try{
 let root=setup();replies=[()=>({data:{total:0,rows:[]}}),()=>({data:{total:1,rows:[]}})];await loadOfficeholderObservations('person');ok(!root.hidden,'superseded-only section reachable');ok(!root.querySelector('form')!.hidden,'history form reachable');ok(calls[1].p_history===true,'history uses gated reader');
 const form=root.querySelector('form')!;let oldResolve:any,newResolve:any;replies=[()=>new Promise(r=>oldResolve=r),()=>new Promise(r=>newResolve=r)];
 (form.elements.namedItem('as_of') as HTMLInputElement).value='2020-01-01';form.dispatchEvent(new Event('submit',{cancelable:true}));
 (form.elements.namedItem('as_of') as HTMLInputElement).value='2022-01-01';form.dispatchEvent(new Event('submit',{cancelable:true}));
 newResolve({data:{total:1,rows:[row('new request')]}});await tick();oldResolve({data:{total:1,rows:[row('stale request')]}});await tick();
 ok(root.textContent!.includes('new request'),'new result visible');ok(!root.textContent!.includes('stale request'),'old result ignored');
 let rejectOld:any;replies=[()=>new Promise((_r,j)=>rejectOld=j),()=>({data:{total:1,rows:[row('latest success')]}})];form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));await tick();rejectOld(Error('old failure'));await tick();ok(!root.textContent!.includes('Could not refresh'),'old errors ignored');
 root=setup();replies=[()=>({data:{total:0,rows:[]}}),()=>({data:{total:0,rows:[]}})];await loadOfficeholderObservations('empty');ok(root.hidden,'no observations stays hidden');
 output.textContent=`PASS: ${assertions} assertions — superseded-only history, out-of-order successes/errors, empty profiles.`;
}catch(e){output.textContent='FAIL: '+String(e);throw e;}
