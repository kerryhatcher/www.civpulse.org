import { legislativeResources, type LegislativeRow } from './legislation';
import { recordHref, localHref, webHref } from './public-records';
export const detailTables = ['bills','legislative_votes','legislative_sessions'] as const;
export type DetailTable = typeof detailTables[number];
export const detailKind = (table: DetailTable) => table === 'bills' ? 'bills' : table === 'legislative_votes' ? 'votes' : 'sessions';
export interface DetailSection {table:string; omit:string[]; rows:LegislativeRow[]; total:number; pages:Record<number,string>}
export interface LegislationDetail {table:DetailTable; row:LegislativeRow; sections:DetailSection[]; totals?:ReturnType<typeof recordedVoteTotals>}
export const detailChildren: Record<DetailTable,string[]> = {
  bills:['bill_actions','legislative_vote_bills','bill_sponsorships','bill_versions','article_bills','bill_positions','bill_amendments','bill_relationships'],
  legislative_votes:['legislative_vote_choices','legislative_vote_bills'],
  legislative_sessions:['bills','legislative_votes','bill_actions','legislative_event_links'],
};
export function recordedVoteTotals(vote:LegislativeRow, choices:LegislativeRow[]) {
  const yes=choices.filter(row=>row.choice==='yes').length, no=choices.filter(row=>row.choice==='no').length;
  const recorded={total:choices.length,yes,no,other:choices.length-yes-no};
  const matchesReported = vote.coverage==='complete' && [vote.reported_yes,vote.reported_no,vote.reported_other].every(value=>value!=null)
    ? yes===vote.reported_yes && no===vote.reported_no && recorded.other===vote.reported_other : null;
  return {recorded,matchesReported};
}
/** Explicit presentation projection. Only anonymous discovery rows may enter it. */
export function detailRow(table:string,row:LegislativeRow,published:Map<string,string>):LegislativeRow {
  if(row.visibility!=='public') throw new Error('Non-public legislation detail export');
  const fields=['id','visibility',...legislativeResources[table].fields.map(field=>field.name)]
    .filter(key=>!['source_id','source_system','retrieved_at','membership_review_note'].includes(key));
  const result=Object.fromEntries(fields.filter(key=>row[key]!==undefined).map(key=>[key,row[key]])) as LegislativeRow;
  const links:Record<string,string>={};
  for(const [field,value] of Object.entries(row.links??{})) {
    const url=localHref(value)??webHref(value); if(url) links[field]=url;
  }
  for(const field of legislativeResources[table].fields) {
    const url=typeof row[field.name]==='string' ? published.get(String(row[field.name])) : undefined;
    if(url) links[field.name]=url;
    else if(field.reference==='events' && typeof row[field.name]==='string') links[field.name]=recordHref('events',String(row[field.name]));
  }
  const self=published.get(row.id); if(self) links.record=self;
  result.links=links; result.labels={...row.labels};
  for(const field of ['source_url','text_url']) if(field in result) result[field]=webHref(result[field])??null;
  return result;
}
export function assembleLegislationDetails(tables:Map<string,LegislativeRow[]>):Map<string,LegislationDetail> {
  const published=new Map<string,string>();
  for(const table of detailTables) for(const row of tables.get(table)??[]) published.set(row.id,recordHref(detailKind(table),row.id));
  const projected=new Map([...tables].map(([table,rows])=>[table,rows.map(row=>detailRow(table,row,published))]));
  const groups=new Map<string,Map<string,LegislativeRow[]>>();
  for(const [table,rows] of projected) for(const field of ['bill_id','vote_id','session_id']) {
    const grouped=new Map<string,LegislativeRow[]>();
    for(const row of rows) if(typeof row[field]==='string') {
      const id=String(row[field]), group=grouped.get(id)??[];group.push(row);grouped.set(id,group);
    }
    groups.set(`${table}/${field}`,grouped);
  }
  const details=new Map<string,LegislationDetail>();
  for(const table of detailTables) for(const row of projected.get(table)??[]) {
    const field=table==='bills'?'bill_id':table==='legislative_votes'?'vote_id':'session_id';
    const sections=detailChildren[table].map(child=>{
      const rows=groups.get(`${child}/${field}`)?.get(row.id)??[];
      return {table:child,omit:[field],rows,total:rows.length,pages:{}};
    });
    details.set(`${table}/${row.id}`,{table,row,sections,...(table==='legislative_votes'?{totals:recordedVoteTotals(row,sections[0].rows)}:{})});
  }
  return details;
}
