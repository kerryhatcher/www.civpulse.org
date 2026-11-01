import {provenanceDates,provenanceExplanation,recordSourceUrl,type ProvenanceSource} from './record-provenance';

/** Render only after the viewer's access gate, using the same live record as its details. */
export function renderRecordProvenance(root:HTMLElement|null,options:{title?:string;sources?:ProvenanceSource[];recordDate?:{label:string;value:string};note?:string}){
  if(!root)return;
  const node=(tag:string,text?:string)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
  const title=options.title??'Sources and verification';
  const aside=node('aside');aside.className='record-provenance';aside.setAttribute('aria-label',title);aside.append(node('h2',title));
  const sources=(options.sources??[]).flatMap(source=>{const url=recordSourceUrl(source.url);return url?[{...source,url}]:[];});
  if(sources.length){const list=node('ul');for(const source of sources){const item=node('li'),link=node('a',source.label);link.setAttribute('href',source.url);item.append(link);list.append(item);}aside.append(list);}
  else aside.append(node('p','Original source not recorded for this summary.'));
  const dates=node('dl');for(const fact of [...(options.recordDate?[options.recordDate]:[]),...provenanceDates()]){const item=node('div');item.append(node('dt',fact.label),node('dd',fact.value));dates.append(item);}aside.append(dates);
  if(options.note)aside.append(node('p',options.note));aside.append(node('p',provenanceExplanation));root.replaceChildren(aside);
}
