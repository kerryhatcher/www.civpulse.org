import {test,expect} from 'bun:test';
import {collectOfficeholderObservations} from '../../apps/web/src/lib/officeholder-observation-build-data';
test('public pagination requires an unchanged visible-set fingerprint, not just stable counts',async()=>{
 const first=Array.from({length:100},(_,i)=>({id:String(i)}));
 const api=(token:string)=>({rpc:async(_name:string,{p_offset}:any)=>({error:null,data:{total:101,snapshot:p_offset?token:'first',rows:p_offset?[{id:'last'}]:first}})}) as any;
 expect((await collectOfficeholderObservations(api('first')))).toHaveLength(101);
 await expect(collectOfficeholderObservations(api('changed'))).rejects.toThrow('Changing');
 await expect(collectOfficeholderObservations(api(undefined as any))).rejects.toThrow('Changing');
});
