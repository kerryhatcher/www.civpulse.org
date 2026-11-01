import {expect,test} from 'bun:test';
import {chromium} from 'playwright';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// Real DOM with the actual enhancement module; the RPC boundary is synthetic.
test.skipIf(!process.env.PROFILE_EVIDENCE_BROWSER)('legislative initialization preserves the complete published fallback and history link through failure/success',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'profile-legislation-'));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const entry=join(dir,'entry.ts');
    await Bun.write(entry,`import {loadPersonLegislation} from ${JSON.stringify(resolve('apps/web/src/scripts/legislation.ts'))}; globalThis.qaLoad=loadPersonLegislation;`);
    const build=await Bun.build({entrypoints:[entry],target:'browser',plugins:[{name:'synthetic-client',setup(builder){
      builder.onLoad({filter:/\/supabase\.ts$/},()=>({contents:'export const getSupabase=()=>globalThis.qaClient;',loader:'ts'}));
    }}]});
    expect(build.success).toBe(true);
    const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setContent(`<section data-person-legislation><h2>Legislative record</h2><div data-public-profile-evidence="legislative-votes"><p>Showing 1–20 of 21 recorded entries.</p><ol>${Array.from({length:20},(_,i)=>`<li>Published choice ${i+1}</li>`).join('')}</ol></div><p data-public-profile-history><a href="/people/example/history/legislative-votes/page/1/">Read all 21 entries: Legislative votes</a></p></section>`);
    await page.evaluate(()=>{
      const state=globalThis as any;state.qaFail=true;let first=true;
      state.qaClient={rpc:async(name:string)=>{
        if(first){first=false;await new Promise(resolve=>{state.qaRelease=resolve;});}
        if(name==='browse_legislation')return {data:{rows:[],total:0},error:null};
        if(name==='get_office_terms')return {data:[],error:null};
        return state.qaFail?{data:null,error:{message:'Synthetic offline'}}:{data:{rows:[],total:0},error:null};
      }};
    });
    await page.addScriptTag({type:'module',content:await build.outputs[0].text()});
    await page.waitForFunction(()=>typeof (globalThis as any).qaLoad==='function');
    await page.evaluate(()=>{(globalThis as any).qaPending=(globalThis as any).qaLoad('person');});
    const history=page.locator('[data-public-profile-history] a'),evidence=page.locator('[data-public-profile-evidence]');
    expect(await history.count()).toBe(1);expect(await history.isVisible()).toBe(true);
    expect(await history.getAttribute('href')).toBe('/people/example/history/legislative-votes/page/1/');
    await page.evaluate(async()=>{(globalThis as any).qaRelease();await (globalThis as any).qaPending;});
    expect(await evidence.isVisible()).toBe(true);expect(await evidence.locator('li').count()).toBe(20);
    expect(await history.isVisible()).toBe(true);expect(await page.getByRole('button',{name:'Retry legislative history'}).isVisible()).toBe(true);
    await page.evaluate(()=>{(globalThis as any).qaFail=false;});
    await page.getByRole('button',{name:'Retry legislative history'}).click();
    await page.waitForFunction(()=>document.querySelector<HTMLElement>('[data-public-profile-evidence]')?.hidden);
    expect(await history.isVisible()).toBe(true);
    await page.evaluate(()=>(globalThis as any).qaLoad('person'));
    expect(await history.count()).toBe(1);expect(await history.isVisible()).toBe(true);expect(await evidence.isHidden()).toBe(true);
    expect(errors).toEqual([]);
  }finally{await browser.close();await rm(dir,{recursive:true,force:true});}
},30000);
