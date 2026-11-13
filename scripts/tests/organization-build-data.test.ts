import { expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person } from '../../apps/web/src/lib/people';
import type { Organization } from '../../apps/web/src/lib/organizations';
import { loadProfileBuildData, readRows } from '../../apps/web/src/lib/profile-build-data';
import { loadDirectoryBuildData } from '../../apps/web/src/lib/directory-build-data';
import { ORGANIZATION_COLUMNS, readBuildAffiliations, readBuildOrganizations } from '../../apps/web/src/lib/organization-build-data';

function fixture(size=1101) {
  const people = Array.from({length:size+2},(_,i)=>({id:`person-${String(i).padStart(4,'0')}`,slug:`person-${i}`,full_name:`Person ${i}`,visibility:i===size?'unlisted':i===size+1?'private':'public',kind:'other'}));
  const organizations = Array.from({length:size},(_,i)=>({id:`org-${String(i).padStart(4,'0')}`,slug:`org-${i}`,name:`Organization ${String(size-i).padStart(4,'0')}`,description:`Description ${i}`,email:`org-${i}@example.org`,sos_control_number:`control-${i}`}));
  const affiliations = people.map((person,i)=>({person_id:person.id,organization_id:organizations[i%size].id,role:i>=size?'hidden-role':'Member'}));
  affiliations.push({person_id:people[0].id,organization_id:'missing-org',role:'unreadable-org-role'});
  const tables:Record<string,Record<string,unknown>[]>={people,organizations,person_organizations:affiliations};
  const calls:Array<{table:string;columns:string;order:string[];start:number;end:number;publicOnly:boolean}>=[];
  let failTable='', failStart=-1;
  const client={from(table:string){
    let columns='',rows=tables[table],publicOnly=false;const order:string[]=[];
    const query={
      select(value:string){columns=value;return query;},
      eq(column:string,value:unknown){publicOnly=column==='visibility'&&value==='public';rows=rows.filter(row=>row[column]===value);return query;},
      order(value:string){order.push(value);return query;},
      async range(start:number,end:number){
        calls.push({table,columns,order:[...order],start,end,publicOnly});
        await new Promise(resolve=>setTimeout(resolve,1));
        if(table===failTable&&start===failStart)return {data:null,error:{message:'offline'}};
        const sorted=[...rows].sort((a,b)=>{for(const key of order){const result=String(a[key]).localeCompare(String(b[key]));if(result)return result;}return 0;});
        return {data:sorted.slice(start,end+1).map(row=>Object.fromEntries(columns.split(',').map(key=>[key.trim(),row[key.trim()]]))),error:null};
      },
    };return query;
  }} as unknown as SupabaseClient;
  const records={people:people as Person[],organizations:organizations as Organization[],elections:[]};
  return {client,records,tables,calls,fail:(table:string,start:number)=>{failTable=table;failStart=start;}};
}

test('concurrent profile/directory/organization consumers share stable complete streams and keep narrow public projections',async()=>{
  const source=fixture();
  const organizationRead=readBuildOrganizations(source.client);
  expect(readBuildOrganizations(source.client)).toBe(organizationRead);
  const [profiles,organizations,directory]=await Promise.all([
    loadProfileBuildData(source.client),organizationRead,loadDirectoryBuildData(source.client,source.records),
  ]);
  expect(Object.fromEntries(['people','organizations','person_organizations'].map(table=>[table,source.calls.filter(call=>call.table===table).length]))).toEqual({people:3,organizations:3,person_organizations:3});
  expect(organizations.map(org=>org.id)).toEqual([...source.records.organizations].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(org=>org.id));
  expect(organizations[0]).toHaveProperty('sos_control_number');
  expect(profiles.people).toHaveLength(1101);
  expect(directory.people).toHaveLength(1101);
  expect(profiles.byPerson.get('person-0000')).toEqual([{id:'org-0000',slug:'org-0',name:'Organization 1101',role:'Member'}]);
  expect(profiles.byPerson.has('person-1101')).toBe(false);
  expect(profiles.byPerson.has('person-1102')).toBe(false);
  expect(JSON.stringify(directory)).not.toContain('hidden-role');
  expect(JSON.stringify(directory)).not.toContain('unreadable-org-role');
  expect(source.calls.filter(call=>call.table==='organizations').every(call=>call.columns===ORGANIZATION_COLUMNS&&call.order.join(',')==='name,id')).toBe(true);
  expect(source.calls.filter(call=>call.table==='person_organizations').every(call=>call.order.join(',')==='person_id,organization_id')).toBe(true);
  expect(source.calls.filter(call=>call.table==='people').every(call=>call.publicOnly)).toBe(true);
  const calls=source.calls.length;
  expect(await readBuildOrganizations(source.client)).toBe(organizations);
  await readBuildAffiliations(source.client);
  expect(source.calls.length).toBe(calls);
  const other=fixture(1);
  expect(await readBuildOrganizations(other.client)).not.toBe(organizations);
  expect(other.calls).toHaveLength(1);
  // The former profile + organization reader + directory layout opened five
  // streams: people once, organizations twice, affiliations twice.
  const legacy=fixture();
  await Promise.all([
    readRows(legacy.client,'people','id',['full_name','id'],true),
    readRows(legacy.client,'organizations','id,slug,name',['id']),
    readRows(legacy.client,'person_organizations','person_id,organization_id,role',['person_id','organization_id']),
    readRows(legacy.client,'organizations',ORGANIZATION_COLUMNS,['name','id']),
    readRows(legacy.client,'person_organizations','person_id,organization_id,role',['person_id','organization_id']),
  ]);
  expect(legacy.calls).toHaveLength(15);
});

test('later-page failures reach every dependent consumer without returning a partial stream',async()=>{
  for(const table of ['organizations','person_organizations']){
    const source=fixture();source.fail(table,500);
    const organizationRead=readBuildOrganizations(source.client);
    const profiles=loadProfileBuildData(source.client);
    const directory=Promise.all([organizationRead,loadDirectoryBuildData(source.client,source.records)]);
    const results=await Promise.allSettled([organizationRead,profiles,directory]);
    expect(results[1].status).toBe('rejected');expect(results[2].status).toBe('rejected');
    expect(results[0].status).toBe(table==='organizations'?'rejected':'fulfilled');
    const shared=table==='organizations'?readBuildOrganizations(source.client):readBuildAffiliations(source.client);
    await expect(shared).rejects.toThrow(`build-time ${table}: offline`);
    expect(source.calls.filter(call=>call.table===table).map(call=>call.start)).toEqual([0,500]);
  }
});

test('development keeps fresh organization/affiliation/profile reads and can recover from a failed request',async()=>{
  const previous=process.env.DEV;process.env.DEV='true';
  try{
    const source=fixture(1);
    const first=await loadProfileBuildData(source.client);
    const firstOrganizations=await readBuildOrganizations(source.client);
    source.tables.organizations[0]={...source.tables.organizations[0],name:'Updated organization'};
    source.tables.person_organizations=source.tables.person_organizations.map(row=>({...row,role:'Updated role'}));
    const second=await loadProfileBuildData(source.client);
    expect(second.byPerson.get('person-0000')![0]).toMatchObject({name:'Updated organization',role:'Updated role'});
    expect(first.byPerson.get('person-0000')![0]).toMatchObject({name:'Organization 0001',role:'Member'});
    expect(await readBuildOrganizations(source.client)).not.toBe(firstOrganizations);
    expect(source.calls.filter(call=>call.table==='organizations')).toHaveLength(4);
    expect(source.calls.filter(call=>call.table==='person_organizations')).toHaveLength(2);
    source.fail('organizations',0);await expect(readBuildOrganizations(source.client)).rejects.toThrow('offline');
    source.fail('',-1);expect(await readBuildOrganizations(source.client)).toHaveLength(1);
  }finally{if(previous===undefined)delete process.env.DEV;else process.env.DEV=previous;}
});
