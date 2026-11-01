import {expect,test} from 'bun:test';
import {chromium} from 'playwright';

const base=process.env.PROVENANCE_BROWSER_URL;
test.skipIf(!base)('UUID and live viewers render provenance from the same gated data as their visible records',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const id='00000000-0000-4000-8000-000000000049';
  try{for(const width of [1280,390]){
    const page=await browser.newPage({viewport:{width,height:900}});const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    let restricted=false,personVisibility='public';
    await page.route('**/rest/v1/rpc/**',async route=>{
      const name=new URL(route.request().url()).pathname.split('/').pop();
      const event={id,title:'Live sourced meeting',starts_at:'2026-11-02T18:00:00Z',ends_at:null,all_day:false,is_meeting:true,url:'https://source.test/live-event',location:'Recorded venue',description:'Live details'};
      const data=name==='get_event'?(restricted?{status:'private'}:{status:'ok',event,calendar:{name:'Calendar'},organization:{name:'Body'}})
        :name==='get_meeting'?{status:'ok',event:{id,title:event.title,meeting_video_url:'https://www.youtube.com/watch?v=fixture49',meeting_video_start_seconds:null},attendance:[],votes:[],attachments:[]}
        :name==='get_person'?(restricted?{status:'private'}:{status:'ok',person:{id,slug:'synthetic',visibility:personVisibility,kind:'other',full_name:'Cited person',description:'Recorded [biography source](https://source.test/biography).',title:null,image_path:null},organizations:[]})
        :name==='browse_legislation'?{rows:[],total:0}:name==='is_admin'?true:[];
      await route.fulfill({json:data});
    });
    async function flow(){
      await page.goto(`${base}/calendar/view/?id=${id}`);
      const provenance=page.locator('[data-event-provenance]');
      await provenance.getByRole('link',{name:'Recorded meeting video'}).waitFor();
      expect(await provenance.getByRole('link',{name:'Recorded event source'}).getAttribute('href')).toBe('https://source.test/live-event');
      expect(await provenance.innerText()).toContain('not absences or opposition');
      expect(await provenance.locator('dt').filter({hasText:'Meeting/event date'}).locator('..').locator('dd').innerText()).toBe(await page.locator('[data-event-when]').innerText());
      expect(await provenance.innerText()).toContain('Unknown');
      await page.goto(`${base}/people/view/?id=${id}`);
      const biography=page.locator('[data-person-provenance]');
      await biography.getByRole('link',{name:'Cited biography source: source.test'}).waitFor();
      expect(await biography.innerText()).toContain('Biography sources and verification');
      expect(await biography.innerText()).toContain('Last verified');
      expect(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);
    }
    await flow();
    await page.goto(`${base}/signin/?next=/account/`);await page.locator('button[type="submit"]:not([disabled])').waitFor({timeout:20000});
    await page.locator('[name="email"]').fill('test@civpulse.org');await page.locator('[name="password"]').fill('civicpulse-test-123');await page.locator('button[type="submit"]').click();await page.waitForURL(url=>url.pathname==='/account/');
    await page.waitForFunction(()=>document.querySelector('[data-account-role]')?.textContent==='Admin');
    await flow();
    for(const visibility of ['unlisted','private']){
      personVisibility=visibility;await page.goto(`${base}/people/view/?id=${id}`);
      await page.locator('[data-person-provenance]').getByRole('link',{name:'Cited biography source: source.test'}).waitFor();
      expect(await page.locator('[data-person-viewer]').isVisible()).toBe(true);
      expect(await page.locator('[data-person-provenance]').innerText()).not.toContain('Original source not recorded');
    }
    // A signed-in public permalink must also replace stale build-time provenance.
    const path=[...new Bun.Glob('records/events/*/index.html').scanSync({cwd:'apps/web/dist'})][0];
    expect(path).toBeTruthy();await page.goto(`${base}/${path.replace('index.html','')}`);
    await page.locator('[data-event-provenance]').getByRole('link',{name:'Recorded event source'}).waitFor();
    expect(await page.locator('[data-event-provenance]').getByRole('link',{name:'Recorded event source'}).getAttribute('href')).toBe('https://source.test/live-event');
    expect(await page.locator('[data-event-title]').innerText()).toBe('Live sourced meeting');
    restricted=true;await page.goto(`${base}/calendar/view/?id=${id}`);await page.getByText('This event is private. An admin account is required to view it.',{exact:true}).waitFor();
    expect(await page.locator('[data-event-viewer]').isHidden()).toBe(true);
    await page.goto(`${base}/people/view/?id=${id}`);await page.getByText('This person record is private. An admin account is required to view it.',{exact:true}).waitFor();
    expect(await page.locator('[data-person-viewer]').isHidden()).toBe(true);
    expect(errors).toEqual([]);await page.close();
  }}finally{await browser.close();}
},60000);
