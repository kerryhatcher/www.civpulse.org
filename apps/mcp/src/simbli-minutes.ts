/** Versioned adapter for the captured public agenda/minutes envelope; never executes HTML. */
export const SIMBLI_ADAPTER = 'simbli-minutes-v1';
export type Ballot = { name: string; choice: 'yes'|'no'|'abstain'|'recused'|'unknown'; text: string };
export type ParsedMotion = { locator: string; item_id: string; round: string; subject: string; description: string; ballots: Ballot[]; absences: {name:string;text:string}[] };
export function sourceText(value: unknown): string {
  return String(value ?? '').replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<(?:br\b[^>]*|\/p|\/div|\/li)>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/[ \t]+/g,' ').trim();
}
const choices: Record<string,Ballot['choice']> = {yes:'yes',no:'no',abstain:'abstain',abstained:'abstain',recused:'recused','vote not recorded':'unknown','not present':'unknown',absent:'unknown'};
export function parseSimbliMinutes(text: string) {
  const preamble = 'Public structured meeting records. JSON text; not a generated transcript. Source-reported votes do not establish formal minutes approval. Public projections retain their labels.';
  const body=text.trim().startsWith('[') ? text.trim() : text.startsWith(preamble) ? text.slice(preamble.length).trim() : '';
  if (!body) throw new Error('Unsupported Simbli capture envelope');
  const documents: any = JSON.parse(body);
  if (!Array.isArray(documents) || documents.length>2000) throw new Error('Expected bounded capture document array');
  const motions: ParsedMotion[]=[]; const warnings: {locator:string;reason:string}[]=[]; const urls=new Set<string>();
  const walk=(items:any[],prefix:string) => {
    if(!Array.isArray(items))throw new Error('Invalid minutes item list');
    for(const [i,item] of items.entries()) {
      const locator=`${prefix}[${i}]`;
      if(item.Visibility!==undefined&&item.Visibility!==0){warnings.push({locator,reason:'Non-public minutes item requires review'});continue;}
      const rounds=item.MeetingOnlineVotings;
      if(Array.isArray(rounds))for(const [r,round]of rounds.entries()) {
        const path=`${locator}.MeetingOnlineVotings[${r}]`;
        if(round.IsDeleted===true){warnings.push({locator:path,reason:'Deleted voting round requires review'});continue;}
        const minutes=sourceText(round.Minutes);
        const html:string=Array.isArray(round.VotingHTML)?round.VotingHTML.filter((x:unknown)=>typeof x==='string').map(sourceText).join('\n'):'';
        // A single provider round can contain several manually written Voting blocks.
        const blocks=[...minutes.matchAll(/\bVoting\s*:\s*/gi)];
        const segments=blocks.length ? blocks.map((m,j)=>({description:minutes.slice(j?blocks[j-1].index!+blocks[j-1][0].length:0,m.index).trim(),votes:minutes.slice(m.index!+m[0].length,blocks[j+1]?.index ?? minutes.length),suffix:`.Voting[${j}]`,reverse:false}))
          : html ? [{description:minutes,votes:html,suffix:'.VotingHTML',reverse:true}] : [];
        let parsed=0;const roundStart=motions.length;
        for(const [j,s] of segments.entries()) {
          const ballots:Ballot[]=[]; const absences:{name:string;text:string}[]=[];
          // Anchored named choices: no roster/tally inference, no fuzzy name matching.
          const pattern=s.reverse ? /(?:^|\n)\s*(Yes|No|Abstain(?:ed)?|Recused|Vote Not Recorded|Not Present|Absent)\s*:\s*([^\n]+)/gi
            : /(?:^|\n)\s*([^\n:]+)\s*:\s*(Yes|No|Abstain(?:ed)?|Recused|Vote Not Recorded|Not Present|Absent)\b/gi;
          const recognized=new Set<string>();let lastNamedEnd=0;
          for(const m of s.votes.matchAll(pattern)) {
            lastNamedEnd=m.index!+m[0].length;
            recognized.add(m[0].trim());
            const name=(s.reverse?m[2]:m[1]).trim();const label=(s.reverse?m[1]:m[2]).toLowerCase();
            if(ballots.some(b=>b.name===name)||absences.some(b=>b.name===name))throw new Error(`Duplicate named ballot at ${path}${s.suffix}`);
            if(['not present','absent'].includes(label))absences.push({name,text:m[0].trim()});
            else ballots.push({name,choice:choices[label],text:m[0].trim()});
          }
          if(s.votes.split(/\n/).some(line=>/^[^:\d]+:\s*[^\d]/.test(line)&&!/motion (?:made|seconded) by/i.test(line)&&!recognized.has(line.trim())))warnings.push({locator:path+s.suffix,reason:'Unparsed colon-delimited voting text; review required'});
          if(j===segments.length-1&&/\bmotion\b|\bvoted\b/i.test(s.votes.slice(lastNamedEnd)))warnings.push({locator:path+s.suffix,reason:'Motion-like text after the final voting block requires review'});
          if(ballots.length) {parsed++;motions.push({locator:path+s.suffix,item_id:String(item.EncrId??''),round:`${r}:${j}`,subject:sourceText(item.Title).slice(0,300),description:s.description.replace(/^[^\n:]+:\s*(?:Not Present|Vote Not Recorded|Abstain(?:ed)?|Recused|Absent|Yes|No)\s*$/gmi,'').trim(),ballots,absences});}
          else warnings.push({locator:path+s.suffix,reason:'Voting block has no supported named choices'});
        }
        if(blocks.length&&html.trim()){
          const represented:(Ballot&{kind:string})[]=[];const recognized=new Set<string>();
          for(const m of html.matchAll(/(?:^|\n)\s*(Yes|No|Abstain(?:ed)?|Recused|Vote Not Recorded|Not Present|Absent)\s*:\s*([^\n]+)/gi)){
            recognized.add(m[0].trim());represented.push({name:m[2].trim(),choice:choices[m[1].toLowerCase()],text:m[0].trim(),kind:['not present','absent'].includes(m[1].toLowerCase())?'absence':'ballot'});
          }
          const named=(rows:(Ballot&{kind:string})[])=>rows.map(b=>JSON.stringify([b.name,b.choice,b.kind])).sort();
          const fromMinutes=motions.slice(roundStart).flatMap(m=>[...m.ballots.map(b=>({...b,kind:'ballot'})),...m.absences.map(b=>({...b,choice:'unknown' as const,kind:'absence'}))]);
          if(JSON.stringify(named(represented))!==JSON.stringify(named(fromMinutes))||html.split('\n').some(line=>/^[^:\d]+:\s*[^\d]/.test(line)&&!/motion (?:made|seconded) by/i.test(line)&&!recognized.has(line.trim())))warnings.push({locator:path,reason:'Minutes and VotingHTML named evidence differ or cannot be aligned; reconcile both representations before import'});
          if(/\bmotion\b|\bvoted\b/i.test(html.split('\n').filter(line=>!recognized.has(line.trim())&&!/motion (?:made|seconded) by/i.test(line)).join('\n')))warnings.push({locator:path,reason:'Unaccounted motion-like VotingHTML text requires review'});
        }
        if(!parsed && /\bmotion\b|\bvoted\b/i.test(minutes+' '+html))warnings.push({locator:path,reason:'Motion-like item without parsable named roll call'});
      }
      if(item.ChildMinutesLst)walk(item.ChildMinutesLst,locator+'.ChildMinutesLst');
    }
  };
  let found=0;
  for(const [i,d]of documents.entries())if(d.document?.role==='Minutes'){
    found++; if(typeof d.document.source_url==='string')urls.add(d.document.source_url);
    walk(d.public_content?.LstItemMinutes,`documents[${i}].public_content.LstItemMinutes`);
  }
  if(found!==1)throw new Error('Exactly one published Minutes document required');
  if(motions.length>500)throw new Error('Maximum 500 parsed motions');
  return {adapter:SIMBLI_ADAPTER,motions,warnings,source_urls:[...urls]};
}
