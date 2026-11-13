import { MEETING_FILE_TYPES } from './meetings';
export const REQUEST_STAGES = { draft: 'Draft', submitted: 'Submitted', initial_response: 'Initial response', in_progress: 'In progress', appeal: 'Appeal / mediation', closed: 'Closed' };
export const REQUEST_OUTCOMES = { satisfactory: 'Satisfactory', partial: 'Partial', unsatisfactory: 'Unsatisfactory' };
export const UPDATE_KINDS = { note: 'Note', submission: 'Submission', response: 'Response', clarification: 'Clarification', fee: 'Fee discussion', delay: 'Delay', production: 'Records received', denial: 'Denial', appeal: 'Appeal / mediation', closure: 'Closure', stage: 'Status change' };
export const REQUEST_BUCKET = 'records-request-files';
export const REQUEST_FILE_TYPES: Record<string,string> = { ...MEETING_FILE_TYPES, png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif' };
export type RequestRecord = {
 id:string; title:string; description:string; stage:keyof typeof REQUEST_STAGES; outcome:keyof typeof REQUEST_OUTCOMES|null;
 visibility:'public'|'unlisted'|'private'; request_type:string; target_organization_id:string|null; source_organization_id:string|null;
 submitted_on:string|null; next_follow_up_on:string|null; reference_number:string|null; updated_at:string;
};
export type RequestDetail = {
 status:string; can_manage:boolean; request:RequestRecord; owner_id?:string;
 organizations:{id:string;name:string;slug:string}[];
 updates:{id:string;occurred_on:string;kind:keyof typeof UPDATE_KINDS;body:string}[];
 links:{id:string;title:string;url:string}[];
 files:{id:string;file_name:string;storage_path:string;size_bytes:number;is_private:boolean}[];
 fees:{id:string;kind:'estimated'|'billed'|'paid';amount:number;occurred_on:string;note:string}[];
 transfers?:{id:string;from_user_id:string|null;to_user_id:string;actor_id:string;reason:string;created_at:string}[];
};
