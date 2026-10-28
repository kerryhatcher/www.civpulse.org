import { readElectionReports } from '../lib/election-report-reader';
import { ballotResultReports, choicePercent, precinctReporting } from '../lib/ballot-results';
import type { ResultReport, ContestResult } from '../lib/election-results';
import { selectedCounty } from './county-filter';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const number = (v: number) => v.toLocaleString('en-US');
const timestamp = (v: string) => new Date(v).toLocaleString('en-US', { timeZone:'America/New_York', timeZoneName:'short' });

export async function initBallotResults(electionId: string): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-ballot-results]');
  if (!root) return;
  const summary = root.querySelector<HTMLElement>('[data-ballot-results-summary]')!;
  const refresh = root.querySelector<HTMLButtonElement>('[data-ballot-results-refresh]')!;
  const cards = [...document.querySelectorAll<HTMLElement>('.contest-card[id]')];
  let reports: ResultReport[] = [];
  const originals = new Map<HTMLElement, boolean>();
  for (const card of cards) for (const list of card.querySelectorAll<HTMLElement>('.candidate-list, .ballot-question-choices, [data-ballot-choice-label]')) originals.set(list, list.hidden);
  function reset() {
    for (const card of cards) card.querySelector('[data-inline-results]')?.remove();
    for (const [list, hidden] of originals) list.hidden = hidden;
  }
  function resultBlock(card: HTMLElement, report: ResultReport, result: ContestResult) {
    const block = el('section', undefined, 'ballot-result-scope');
    block.append(el('h4', `${report.scope.county.replace(/ County$/i, '')} County${report.scope.ballot_style === 'all' ? '' : ` · ${report.scope.ballot_style} ballot`}`));
    const statuses: Record<string,string> = {official:'Official results',unofficial:'Unofficial results',certified:'Certified results'};
    block.append(el('p', `${statuses[report.snapshot.status] ?? 'Reported results'} · ${timestamp(report.observed_at)}`, 'ballot-result-source'));
    if (report.snapshot.note) block.append(el('p', report.snapshot.note, 'body-note'));
    block.append(el('p', precinctReporting(result), 'body-note'));
    const table = el('table');
    const race = card.querySelector('h3')?.textContent?.trim() ?? 'Ballot choices';
    table.append(el('caption', `${race} · ${report.scope.county} · All voting methods`));
    const thead = el('thead'), head = el('tr');
    for (const title of ['Candidate / choice','Votes','Percent']) {const th=el('th',title);th.scope='col';head.append(th);}
    thead.append(head); table.append(thead);
    const body = el('tbody');
    // Percentages use only the choices in this report, never ballots cast or registration.
    const total = result.total_votes ?? result.choices.reduce((sum, c) => sum + c.votes, 0);
    for (const choice of [...result.choices].sort((a,b)=>b.votes-a.votes || a.label.localeCompare(b.label))) {
      const row=el('tr'), name=el('th');name.scope='row';
      const profile = choice.person_id ? card.querySelector<HTMLAnchorElement>(`a[data-candidate-id="${choice.person_id}"]`) : null;
      if (profile) {const link=el('a',choice.label,'result-name');link.href=profile.href;name.append(link);} else name.append(el('span',choice.label,'result-name'));
      const metadata = profile?.querySelector('.candidate-meta')?.textContent?.trim();
      const writeIn = profile?.querySelector('.candidate-write-in')?.textContent?.trim();
      if (metadata || writeIn) name.append(el('span',[metadata,writeIn].filter(Boolean).join(' · '),'result-candidate-meta'));
      const percent=choicePercent(choice.votes,total);
      if(percent!=='Not reported') {const track=el('span',undefined,'result-track');track.setAttribute('aria-hidden','true');const fill=el('span',undefined,'result-fill');fill.style.width=percent;track.append(fill);name.append(track);}
      row.append(name,el('td',number(choice.votes)),el('td',percent));body.append(row);
    }
    // A partial source must not remove ballot candidates whose votes are unavailable.
    for (const profile of card.querySelectorAll<HTMLAnchorElement>('a[data-candidate-id]')) {
      if (result.choices.some(c => c.person_id === profile.dataset.candidateId)) continue;
      const row=el('tr'), name=el('th');name.scope='row';
      const link=el('a',profile.querySelector('.candidate-name')?.textContent ?? 'Candidate');link.href=profile.href;name.append(link);
      row.append(name,el('td','Not reported'),el('td','Not reported'));body.append(row);
    }
    table.append(body);block.append(table);
    block.append(el('p', `${number(total)} recorded choice votes. Percentages describe votes for these choices, not voter turnout.`, 'body-note'));
    if(result.unresolved_write_ins != null)block.append(el('p',`${number(result.unresolved_write_ins)} unresolved write-ins, reported separately.`, 'body-note'));
    const link=el('a','Source reports and history');link.href=`/elections/results/?id=${encodeURIComponent(electionId)}`;block.append(link);
    return block;
  }
  function render() {
    reset();
    const selected=ballotResultReports(reports,selectedCounty());
    let races=0;
    for(const card of cards){
      const id=card.id.replace(/^(contest|question)-/,'');
      const matches=selected.flatMap(report=>report.snapshot.contests.filter(c=>(c.contest_id??c.question_id)===id).map(result=>({report,result})));
      if(!matches.length)continue;
      const wrapper=el('div',undefined,'ballot-results');wrapper.dataset.inlineResults='';
      for(const {report,result} of matches)wrapper.append(resultBlock(card,report,result));
      for(const list of card.querySelectorAll<HTMLElement>('.candidate-list, .ballot-question-choices, [data-ballot-choice-label]'))list.hidden=true;
      card.append(wrapper);races++;
    }
    summary.textContent = races ? `Results are shown alongside ${races} ballot races and questions for the selected county view. Each county and ballot style is reported separately.`
      : 'No county overview results have been published for this county view yet. The ballot remains available below.';
  }
  async function load(force=false) {
    refresh.disabled=true;summary.textContent='Loading available results…';
    root!.setAttribute('aria-busy','true');
    try { reports=await readElectionReports(electionId,force);render(); }
    catch {reset();summary.textContent='Results could not be loaded. The ballot is still available. Select Refresh results to try again.';}
    finally {refresh.disabled=false;root!.removeAttribute('aria-busy');}
  }
  refresh.onclick=()=>{void load(true);};
  window.addEventListener('countychange',render);
  await load();
}
