import { searchDocuments, mergeDocumentMatches, type DocumentMatch } from '../lib/document-search';
import { documentApi, publicDocumentUrl, type PublicDocument } from '../lib/documents';

function card(document: PublicDocument, passages: string[] = []): HTMLElement {
  const row = window.document.createElement('article'); row.className = 'org-card document-result';
  const kind = window.document.createElement('p'); kind.className = 'org-eyebrow';
  kind.textContent = `${document.document_kind} · ${(document.size_bytes/1048576).toFixed(1)} MB`;
  const title = window.document.createElement('h2');
  const url = publicDocumentUrl(document.url);
  if (url) {
    const link = window.document.createElement('a'); link.href = url; link.textContent = document.title;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; title.append(link);
  } else title.textContent = document.title;
  row.append(kind,title);
  if (document.indexing?.eligible === false) {
    const notice=window.document.createElement('p');notice.textContent=document.indexing.reason;row.append(notice);
  }
  if (document.text_origin !== 'official') {
    const note = window.document.createElement('p');
    note.textContent = document.text_origin === 'automated_transcript' ? 'Automated transcript · may contain errors'
      : document.text_origin === 'ocr' ? 'Text extracted with OCR · may contain errors' : 'Unofficial text';
    row.append(note);
  }
  for (const text of passages) {
    const excerpt = window.document.createElement('blockquote');
    excerpt.textContent = text.length>900 ? `${text.slice(0,900)}…` : text; row.append(excerpt);
  }
  const source = publicDocumentUrl(document.source_url);
  if (source) {
    const link = window.document.createElement('a'); link.href = source; link.textContent = 'Original source';
    link.target = '_blank'; link.rel = 'noopener noreferrer'; row.append(link);
  }
  const meetings = window.document.createElement('ul');
  for (const meeting of document.meetings) {
    if (!/^[0-9a-f-]{36}$/i.test(meeting.id)) continue;
    const item = window.document.createElement('li'); const link = window.document.createElement('a');
    link.href = `/calendar/view/?id=${meeting.id}`; link.textContent = meeting.title; item.append(link); meetings.append(item);
  }
  row.append(meetings); return row;
}

export async function initDocuments(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('[data-document-search]');
  const status = document.querySelector<HTMLElement>('[data-document-status]');
  const results = document.querySelector<HTMLElement>('[data-document-results]');
  const more = document.querySelector<HTMLButtonElement>('[data-document-more]');
  if (!form || !status || !results || !more) return;
  const api = documentApi();
  if (!api) {
    status.textContent = 'The public document archive is being prepared. Meeting attachments remain available on their meeting pages.';
    form.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select').forEach(field=>{field.disabled=true;});
    return;
  }
  const input = form.elements.namedItem('q') as HTMLInputElement;
  const button = form.querySelector<HTMLButtonElement>('button')!;
  let offset = 0; let current = 0; let query = ''; let warning = '';
  let matches: DocumentMatch[] = [];
  async function search(append=false): Promise<void> {
    const request = ++current; more!.hidden = true; button.disabled = true;
    if (!append) {
      offset=0; matches=[]; warning=''; query=input.value.trim(); results!.replaceChildren();
    }
    history.replaceState(null,'',`/documents/?${new URLSearchParams({q:query})}`);
    status!.textContent='Searching…'; results!.setAttribute('aria-busy','true');
    try {
      const page = await searchDocuments(api!,query,offset,append);
      if (request!==current) return;
      matches=mergeDocumentMatches(matches,page.rows);
      results!.replaceChildren(...matches.map(row=>card(row.document,row.passages)));
      more!.hidden=!page.hasMore; offset=page.nextOffset;
      warning=page.warning || warning;
      const count=matches.length;
      status!.textContent=[count ? `${count} document${count===1?'':'s'} found.` : 'No matching published documents.',warning].filter(Boolean).join(' ');
    } catch (error) {
      if (request===current) {
        status!.textContent=error instanceof Error?error.message:'Could not load the archive.';
        more!.hidden=!append;
      }
    } finally { if (request===current) { button.disabled=false; results!.removeAttribute('aria-busy'); } }
  }
  const params = new URLSearchParams(location.search); input.value=(params.get('q')??'').slice(0,500);
  form.addEventListener('submit',event=>{event.preventDefault();void search();});
  more.addEventListener('click',()=>void search(true));
  button.disabled=false; await search();
}
