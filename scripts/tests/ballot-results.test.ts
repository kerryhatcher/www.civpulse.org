import {expect,test} from 'bun:test';
import {ballotResultReports,precinctReporting,choicePercent} from '../../apps/web/src/lib/ballot-results';
import type {ResultReport} from '../../apps/web/src/lib/election-results';
const report=(id:string,scope:Partial<ResultReport['scope']>={},date='2026-06-05T12:00:00Z'):ResultReport=>({id,observed_at:date,supersedes:null,scope:{county:'Bibb',unit_type:'county',unit:'all',counting_group:'all',ballot_style:'all',...scope},snapshot:{status:'official',turnout:{},contests:[]}});
test('ballot results select current county/style snapshots without combining overlapping units or methods',()=>{
 const a=report('a'),newer=report('b',{},'2026-06-06T12:00:00Z'),rep=report('r',{ballot_style:'Rep'}),other=report('m',{county:'Monroe County'});
 const rows=[a,newer,rep,other,report('p',{unit_type:'precinct',unit:'HA2'}),report('advance',{counting_group:'advance'})];
 expect(ballotResultReports(rows,'13021').map(r=>r.id).sort()).toEqual(['b','r']);
 expect(ballotResultReports(rows,'13159')).toEqual([]);
 expect(ballotResultReports(rows,'13207').map(r=>r.id)).toEqual(['m']);
 expect(ballotResultReports(rows,'all')).toHaveLength(3);
});
test('reporting percentages retain missing/zero data and respect contest denominators',()=>{
 expect(precinctReporting({precincts_reported:31,precincts_total:31})).toBe('31 of 31 precincts reporting (100%)');
 expect(precinctReporting({precincts_reported:0,precincts_total:10})).toBe('0 of 10 precincts reporting (0%)');
 expect(precinctReporting({precincts_reported:2,precincts_total:3})).toContain('66.7%');
 expect(precinctReporting({})).toBe('Precincts reporting: not reported');
 expect(precinctReporting({precincts_reported:2,precincts_total:0})).not.toContain('%');
 expect(precinctReporting({precincts_reported:10,precincts_total:5})).not.toContain('%');
 expect(choicePercent(0,10)).toBe('0.00%');expect(choicePercent(5,10)).toBe('50.00%');
 expect(choicePercent(0,0)).toBe('Not reported');expect(choicePercent(1,null)).toBe('Not reported');
});
