import { getSupabase } from '../lib/supabase';
import { REQUEST_STAGES, REQUEST_OUTCOMES, UPDATE_KINDS, REQUEST_BUCKET, REQUEST_FILE_TYPES, type RequestDetail } from '../lib/records-requests';
const $ = <T extends HTMLElement = HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
function message(text:string,error=false) { const el=$('[data-request-message]'); el.textContent=text; el.dataset.kind=error?'error':'success'; }
function el<K extends keyof HTMLElementTagNameMap>(tag:K,text:string) { const node=document.createElement(tag); node.textContent=text; return node; }
function values(form:HTMLFormElement) { return Object.fromEntries(new FormData(form).entries()); }
function today() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function date(value:string) { return new Date(value.length===10?`${value}T12:00:00`:value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }
function money(amount:number) { return new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(amount); }
function button(label:string,run:()=>Promise<void>) { const b=el('button',label); b.type='button'; b.addEventListener('click',()=>void busy(b,run)); return b; }
async function busy(control:HTMLButtonElement,run:()=>Promise<void>) { control.disabled=true; try { await run(); } catch(e) { message(e instanceof Error?e.message:'Something went wrong. Please try again.',true); } finally { control.disabled=false; } }
function bind(form:HTMLFormElement,run:(data:Record<string,FormDataEntryValue>)=>Promise<void>) {
 const feedback=el('p',''); feedback.className='auth-message'; feedback.setAttribute('role','status'); feedback.setAttribute('aria-live','polite'); form.append(feedback);
 form.addEventListener('submit',event=>{
  event.preventDefault(); const b=form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  if(b.disabled)return;
  feedback.textContent='Saving…'; feedback.dataset.kind='';
  void busy(b,()=>run(values(form))).then(()=>{
   const status=$('[data-request-message]'); feedback.textContent=status.textContent; feedback.dataset.kind=status.dataset.kind;
  });
 });
}
async function rpc(name:string,args:Record<string,unknown>) { const {data,error}=await getSupabase().rpc(name,args); if(error) throw new Error(error.message); return data; }
async function organizations(selects:HTMLSelectElement[]) {
 const {data,error}=await getSupabase().from('organizations').select('id,name').order('name'); if(error) throw new Error(error.message);
 for(const select of selects) for(const org of data??[]) select.append(new Option(org.name,org.id));
}

export async function initRequestDirectory() {
 try {
  const supabase=getSupabase(), form=$<HTMLFormElement>('[data-request-search]');
  const {data:{session}}=await supabase.auth.getSession();
  if(session) { $('[data-request-scope]').hidden=false; const admin=await rpc('is_admin',{}); $('[data-request-create]').hidden=!admin; }
  await organizations([form.elements.namedItem('organization') as HTMLSelectElement]);
  const params=new URLSearchParams(location.search);
  for(const name of ['query','stage','organization','scope']) {const input=form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement; if(params.has(name)) input.value=params.get(name)!;}
  let offset=0;
  const load=async()=>{
   message('Loading requests…'); const v=values(form);
   const rows=await rpc('search_records_requests',{p_query:v.query,p_stage:v.stage||null,p_organization_id:v.organization||null,p_managed:!!session&&v.scope==='managed',p_offset:offset});
   const list=$('[data-request-results]'); list.replaceChildren();
   for(const row of rows) {
    const article=el('article','');article.className='request-result'; const h=el('h2',''), a=el('a',row.title);a.href=`/requests/view/?id=${row.id}`;h.append(a);
    article.append(h,el('p',`${REQUEST_STAGES[row.stage as keyof typeof REQUEST_STAGES]} · ${row.outcome?REQUEST_OUTCOMES[row.outcome as keyof typeof REQUEST_OUTCOMES]:'Outcome not assessed'} · ${row.visibility}`));
    article.append(el('p',[row.target_name?`To: ${row.target_name}`:'',row.source_name?`From: ${row.source_name}`:''].filter(Boolean).join(' · ')),el('p',`Updated ${date(row.updated_at)}`)); list.append(article);
   }
   message(rows.length?`Showing ${offset+1}–${offset+rows.length}.`:'No requests match these filters. Try another topic, stage or organization.');
   $('[data-request-prev]').hidden=offset===0; $('[data-request-next]').hidden=rows.length<25;
  };
  bind(form,async()=>{offset=0;await load();});
  $('[data-request-prev]').addEventListener('click',()=>void busy($<HTMLButtonElement>('[data-request-prev]'),async()=>{offset=Math.max(0,offset-25);await load();}));
  $('[data-request-next]').addEventListener('click',()=>void busy($<HTMLButtonElement>('[data-request-next]'),async()=>{offset+=25;await load();}));
  await load();
 } catch(e) {message(e instanceof Error?e.message:'Requests could not be loaded. Try again.',true);}
}

export async function initRequestView() {
 const supabase=getSupabase(), isNew=!!document.querySelector('[data-request-new]');
 let id=new URLSearchParams(location.search).get('id'); let record:RequestDetail|null=null; let initialized=false; let detailsDirty=false;
 const form=$<HTMLFormElement>('[data-request-form]');
 form.addEventListener('input',()=>{detailsDirty=true;});
 form.addEventListener('change',()=>{detailsDirty=true;});
 function field(name:string) {return form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;}
 async function refresh() {
  if(!id) return;
  record=await rpc('get_records_request',{p_id:id});
  if(record?.status!=='ok') { $('[data-request-content]').hidden=true; message('Request unavailable. It may be private or no longer available. Sign in with an authorized account to try again.',true);return; }
  const r=record.request;
  $('[data-request-content]').hidden=false; $('[data-request-title]').textContent=r.title; document.title=`${r.title} · Civic Pulse`;
  $('[data-request-state]').textContent=`${r.request_type.toUpperCase()} · ${REQUEST_STAGES[r.stage]} · ${r.outcome?REQUEST_OUTCOMES[r.outcome]:'Outcome not assessed'} · ${r.visibility}`;
  $('[data-request-description]').textContent=r.description;
  const orgs=$('[data-request-organizations]');orgs.replaceChildren();
  for(const [label,orgId] of [['To',r.target_organization_id],['From',r.source_organization_id]]) {
   const org=record.organizations.find(o=>o.id===orgId);if(!org)continue;const p=el('p',`${label}: `),a=el('a',org.name);a.href=`/orgs/${encodeURIComponent(org.slug)}/`;p.append(a);orgs.append(p);
  }
  const facts=$('[data-request-facts]');facts.replaceChildren();
  for(const [label,value] of [['Reference',r.reference_number],['Submitted',r.submitted_on?date(r.submitted_on):null],['Next follow-up',r.next_follow_up_on?date(r.next_follow_up_on):null]]) if(value) {const d=el('div','');d.append(el('dt',label!),el('dd',value));facts.append(d);}
  $('[data-request-manage]').hidden=!record.can_manage; $('[data-request-editor]').hidden=!record.can_manage; $('[data-request-existing]').hidden=!record.can_manage;
  if(record.can_manage) {
   await initializeEditor();
   if(!detailsDirty) for(const [key,value] of Object.entries(r)) {const input=form.elements.namedItem(key) as HTMLInputElement|null;if(input)input.value=value??'';}
   $('[data-request-owner]').textContent=`Current owner: ${record.owner_id}`;
   const history=$('[data-transfer-list]');history.replaceChildren();
   for(const transfer of record.transfers??[]) {const li=el('li',`${date(transfer.created_at)} · ${transfer.reason}`);li.append(el('p',`${transfer.from_user_id??'Created'} → ${transfer.to_user_id}`),el('p',`Recorded by ${transfer.actor_id}`));history.append(li);}
  }
  const timeline=$('[data-request-timeline]');timeline.replaceChildren();
  for(const update of record.updates) {const li=el('li','');li.append(el('strong',`${date(update.occurred_on)} · ${UPDATE_KINDS[update.kind]}`),el('p',update.body));if(record.can_manage&&update.kind!=='stage')li.append(remove('update',update.id));timeline.append(li);}
  if(!record.updates.length)timeline.append(el('li','No updates recorded yet.'));
  const totals=$('[data-fee-totals]');totals.replaceChildren();
  for(const kind of ['estimated','billed','paid'] as const) {const sum=record.fees.filter(f=>f.kind===kind).reduce((a,f)=>a+Math.round(Number(f.amount)*100),0)/100;const d=el('div','');d.append(el('dt',kind[0].toUpperCase()+kind.slice(1)),el('dd',money(sum)));totals.append(d);}
  const fees=$('[data-request-fees]');fees.replaceChildren();
  for(const fee of record.fees) {const li=el('li',`${date(fee.occurred_on)} · ${fee.kind} ${money(Number(fee.amount))}`);if(fee.note)li.append(el('p',fee.note));if(record.can_manage)li.append(remove('fee',fee.id));fees.append(li);}
  if(!record.fees.length)fees.append(el('li','No fees recorded.'));
  const links=$('[data-request-links]');links.replaceChildren();
  for(const link of record.links) {const li=el('li',''),a=el('a',link.title);const url=new URL(link.url);if(!['http:','https:'].includes(url.protocol))continue;a.href=url.href;a.rel='noopener noreferrer';li.append(a);if(record.can_manage)li.append(' ',remove('link',link.id));links.append(li);}
  const files=$('[data-request-files]');files.replaceChildren();
  for(const file of record.files) {
   const li=el('li',`${file.file_name} · ${(file.size_bytes/1048576).toFixed(2)} MB${file.is_private?' · Private':''} `);
   li.append(button('Download',async()=>{
    const {data,error}=await supabase.storage.from(REQUEST_BUCKET).createSignedUrl(file.storage_path,60,{download:file.file_name});if(error)throw new Error(error.message);
    const origin=new URL(import.meta.env.PUBLIC_SUPABASE_URL),url=new URL(data.signedUrl,origin);
    if(url.origin!==origin.origin||!url.pathname.startsWith(`/storage/v1/object/sign/${REQUEST_BUCKET}/`))throw new Error('Invalid download URL');
    const a=el('a','');a.href=url.href;a.download=file.file_name;a.click();
   }));
   if(record.can_manage)li.append(' ',remove('file',file.id,file.storage_path));files.append(li);
  }
  if(!record.files.length)files.append(el('li','No shared files available.'));
  if(!record.links.length)links.append(el('li','No related links added.'));
 }
 function remove(kind:string,itemId:string,path?:string) {return button('Remove',async()=>{
  if(!confirm('Remove this item from the request?'))return;
  // Remove metadata first to revoke new download access, then remove the stored object.
  await rpc('remove_records_request_item',{p_id:id,p_kind:kind,p_item_id:itemId});
  if(path) {const {error}=await supabase.storage.from(REQUEST_BUCKET).remove([path]);if(error){await refresh();throw new Error('The file is no longer listed, but storage cleanup failed. An admin must remove the unused object.');}}
  await refresh();message('Item removed.');
 });}
 async function initializeEditor() {
  if(initialized)return;
  await organizations([field('target_organization_id') as HTMLSelectElement,field('source_organization_id') as HTMLSelectElement]);
  for(const input of document.querySelectorAll<HTMLInputElement>('input[name="occurred_on"]'))input.value=today();
  bind(form,async v=>{
   if(!String(v.title).trim())throw new Error('Enter a title.');
   if(!v.target_organization_id&&!v.source_organization_id)throw new Error('Choose a target or requesting organization.');
   const saved=await rpc('save_records_request',{p_id:id,p_values:v});
   if(isNew){location.assign(`/requests/view/?id=${saved}`);return;}
   detailsDirty=false;await refresh();message('Request saved.');
  });
  for(const [selector,kind] of [['[data-update-form]','update'],['[data-fee-form]','fee'],['[data-link-form]','link']]) {
   const f=$<HTMLFormElement>(selector);bind(f,async v=>{if(kind==='link'&&!/^https?:\/\//i.test(String(v.url)))throw new Error('Use an http or https address.');await rpc('add_records_request_item',{p_id:id,p_kind:kind,p_values:v});f.reset();const d=f.elements.namedItem('occurred_on') as HTMLInputElement|null;if(d)d.value=today();await refresh();message(`${kind==='fee'?'Fee':'Item'} added.`);});
  }
  const upload=$<HTMLFormElement>('[data-file-form]');bind(upload,async v=>{
   const file=v.file as File,ext=file.name.split('.').pop()?.toLowerCase()??'',type=REQUEST_FILE_TYPES[ext];
   if(!type||file.size===0||file.size>26214400)throw new Error('Choose a supported file between 1 byte and 25 MB.');
   const path=`${id}/${crypto.randomUUID()}.${ext}`;message('Uploading file…');
   const {error}=await supabase.storage.from(REQUEST_BUCKET).upload(path,file,{contentType:type,upsert:false});if(error)throw new Error(error.message);
   try {await rpc('add_records_request_item',{p_id:id,p_kind:'file',p_values:{file_name:file.name,storage_path:path,mime_type:type,size_bytes:file.size,is_private:v.is_private==='true'}});}
   catch(e){await supabase.storage.from(REQUEST_BUCKET).remove([path]);throw e;}
   upload.reset();await refresh();message('File uploaded.');
  });
  bind($<HTMLFormElement>('[data-transfer-form]'),async v=>{
   if(!confirm('Transfer ownership? The new owner will receive access to private files. Your owner access will end.'))return;
   await rpc('transfer_records_request',{p_id:id,p_to_user_id:v.to_user_id,p_reason:v.reason});await refresh();message('Ownership transferred.');
  });
  initialized=true;
 }
 try {
  if(isNew) {const admin=await rpc('is_admin',{});if(!admin){message('Only admins can create requests. Sign in with an admin account.',true);return;}await initializeEditor();$('[data-request-editor]').hidden=false;message('New requests start private.');}
  else {
   if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){message('This request link is invalid. Browse all records requests to find one.',true);return;}
   $('[data-request-retry]').addEventListener('click',()=>void busy($<HTMLButtonElement>('[data-request-retry]'),async()=>{await refresh();$('[data-request-retry]').hidden=true;}));
   message('');await refresh();
  }
 } catch(e){message(e instanceof Error?e.message:'Request could not be loaded.',true);const retry=document.querySelector<HTMLElement>('[data-request-retry]');if(retry)retry.hidden=false;}
}
