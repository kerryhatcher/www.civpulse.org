export interface OutcomeObservation {
  id: string; outcome: string; source_url: string; document_sha256: string;
  locator: string; created_at: string; supersedes_id: string | null; correction_reason: string | null;
}
interface OriginalSource { provider?: string; source_key?: string; data?: { outcome?: string | null }; provenance?: { source_url?: string; document_sha256?: string; locator?: string } }
export interface MeetingOutcome {
  outcome: string | null; original_outcome?: string | null;
  outcome_observations?: OutcomeObservation[]; original_sources?: OriginalSource[];
}
export function outcomeLabel(value: string | null | undefined): string {
  return ({ passed:'Passed', failed:'Failed', tabled:'Tabled', withdrawn:'Withdrawn' } as Record<string,string>)[value ?? ''] ?? 'Not recorded';
}
const https = (url: unknown) => {
  if (typeof url !== 'string') return null;
  try { const parsed=new URL(url); return parsed.protocol==='https:' && !parsed.username && !parsed.password ? parsed.href : null; } catch { return null; }
};
/** Source facts remain separate from later editorial observations; recorded_at
 * is not a document publication date or a claim of independent verification. */
export function outcomeEvidence(value: MeetingOutcome): { lines: string[]; links: {label:string;href:string}[] } {
  const observations=value.outcome_observations ?? [], sources=value.original_sources ?? [];
  if (!observations.length) return {lines:[],links:[]};
  const lines=[`Original recorded outcome: ${outcomeLabel(value.original_outcome)}.`];
  const links: {label:string;href:string}[]=[];
  for(const source of sources){
    lines.push(`Original imported observation: ${source.provider ?? 'Provider not recorded'} / ${source.source_key ?? 'Key not recorded'}; outcome: ${outcomeLabel(source.data?.outcome)}.`);
    if(source.provenance?.locator)lines.push(`Original source locator: ${source.provenance.locator}`);
    if(source.provenance?.document_sha256)lines.push(`Original document SHA-256: ${source.provenance.document_sha256}`);
    const url=https(source.provenance?.source_url);if(url)links.push({label:'Original imported source',href:url});
  }
  observations.forEach((observation,index)=>{
    lines.push(`${index===observations.length-1?'Current cited outcome':'Earlier cited outcome'}: ${outcomeLabel(observation.outcome)}. Locator: ${observation.locator}`);
    lines.push(`Document SHA-256: ${observation.document_sha256}`);
    lines.push(`Observation recorded: ${observation.created_at}. This is not the source publication date.`);
    if(observation.correction_reason)lines.push(`Correction: ${observation.correction_reason}`);
    const url=https(observation.source_url);if(url)links.push({label:`${index===observations.length-1?'Current':'Earlier'} outcome source`,href:url});
  });
  return {lines,links};
}

/** Static meeting snapshots keep cited facts, never editor account IDs or future
 * private metadata from an expanded RPC response. */
export function publicOutcomeFields(value: MeetingOutcome): Partial<MeetingOutcome> {
  if(!value.outcome_observations?.length)return {};
  return { original_outcome:value.original_outcome ?? null,
    outcome_observations:value.outcome_observations.map(({id,outcome,source_url,document_sha256,locator,created_at,supersedes_id,correction_reason})=>({id,outcome,source_url,document_sha256,locator,created_at,supersedes_id,correction_reason})),
    original_sources:(value.original_sources??[]).map(({provider,source_key,data,provenance})=>({provider,source_key,data:{outcome:data?.outcome},provenance:provenance?{source_url:provenance.source_url,document_sha256:provenance.document_sha256,locator:provenance.locator}:undefined})),
  };
}
