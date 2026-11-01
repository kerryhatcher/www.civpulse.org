import {expect,test} from 'bun:test';
import {CORRECTION_ISSUES,correctionReportUrl,publicCorrectionContext} from '../../apps/web/src/lib/corrections';

test('report links use the enabled repository channel and public canonical context only',()=>{
 const url=new URL(correctionReportUrl('/people/example/?sensitive-context=HIDDEN_VALUE#HIDDEN_FRAGMENT'));
 expect(url.origin+url.pathname).toBe(`${CORRECTION_ISSUES}/new`);expect(url.searchParams.get('title')).toBe('Correction report');
 expect(url.searchParams.get('body')).toContain('https://www.civpulse.org/people/example/');expect(url.href).not.toContain('HIDDEN');
 expect(url.searchParams.get('body')).toContain('This issue is public');expect(url.searchParams.get('body')).toContain('Original source URL');
 for(const path of ['/people/example/','/orgs/example/','/maps/example/','/elections/example/','/records/events/abc-123/','/people/example/history/votes/2/'])expect(publicCorrectionContext(path)).toBe(`https://www.civpulse.org${path}`);
});

test('restricted viewers, foreign origins and malformed contexts never prefill private IDs',()=>{
 for(const path of ['/maps/view/?id=HIDDEN_VALUE','/people/view/?id=HIDDEN_VALUE','/elections/view/?id=HIDDEN_VALUE','/maps/u/HIDDEN_VALUE/','/account/','/admin/people/','//external.test/people/example/','https://external.test/people/example/','/people/%3Cscript%3E/']){
  expect(publicCorrectionContext(path)).toBe(null);expect(new URL(correctionReportUrl(path)).searchParams.get('body')).toContain('[add the public page URL]');expect(correctionReportUrl(path)).not.toContain('HIDDEN_VALUE');
 }
});

const dist=process.env.CORRECTIONS_TEST_DIST;
test.skipIf(!dist)('public policy identifies confirmed responsibility and record links resolve to actionable forms',async()=>{
 const policy=await Bun.file(`${dist}/editorial/index.html`).text(),about=await Bun.file(`${dist}/about/index.html`).text();
 expect(policy).toContain('Kerry Hatcher is the Civic Pulse operator and maintainer');expect(policy).toContain('not a retrospective claim');expect(policy).toContain('GitHub account/sign-in is required');expect(policy).toContain('No response or publication deadline is guaranteed');
 for(const section of ['responsibility','sources','automation','coverage','corrections','handling'])expect(policy).toContain(`id="${section}"`);
 expect(about).toContain('/editorial/');expect(policy).toContain('/docs/admins/#editorial-correction-workflow');
 const files=await Array.fromAsync(new Bun.Glob('sitemap-*.xml').scan({cwd:dist!,absolute:false}));
 expect((await Promise.all(files.map(file=>Bun.file(`${dist}/${file}`).text()))).join('')).toContain('https://www.civpulse.org/editorial/');
 let checked=0;
 for await(const file of new Bun.Glob('**/*.html').scan({cwd:dist!,absolute:false})){
  const html=await Bun.file(`${dist}/${file}`).text();const reports=[...html.matchAll(/href="(https:\/\/github\.com\/kerryhatcher\/www\.civpulse\.org\/issues\/new[^\"]*)"/g)];
  for(const report of reports){const body=new URL(report[1].replaceAll('&amp;','&')).searchParams.get('body')!;expect(body).not.toContain('undefined');
   const path='/'+file.replace(/index\.html$/,'');const context=publicCorrectionContext(path);expect(body).toContain(context??'[add the public page URL]');checked++;
  }
 }
 expect(checked).toBeGreaterThan(100);console.log({reportLinks:checked});
});
