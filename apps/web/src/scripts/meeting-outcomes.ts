import {outcomeEvidence,type MeetingOutcome} from '../lib/meeting-outcomes';
export function renderOutcomeEvidence(vote: MeetingOutcome): HTMLElement | null {
  const evidence=outcomeEvidence(vote);if(!evidence.lines.length)return null;
  const details=document.createElement('details');details.style.overflowWrap='anywhere';
  const summary=document.createElement('summary');summary.textContent='Outcome evidence and original observation';details.append(summary);
  for(const line of evidence.lines){const p=document.createElement('p');p.textContent=line;details.append(p);}
  const list=document.createElement('ul');
  for(const link of evidence.links){const li=document.createElement('li'),a=document.createElement('a');a.href=link.href;a.textContent=link.label;li.append(a);list.append(li);}
  details.append(list);return details;
}
