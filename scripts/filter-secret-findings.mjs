// Exceptions match detector, path and SHA-256 of the exact public fixture/row ID.
// Verified findings always block. Never print candidate secrets to CI logs.
import { createHash } from 'node:crypto';
export function isReviewedFalsePositive(result) {
  const path = result.SourceMetadata?.Data?.Git?.file;
  const hash = createHash('sha256').update(result.Raw ?? '').digest('hex');
  return result.Verified === false && exceptions.some(item => item.detector === result.DetectorName && item.path === path && item.hash === hash);
}
const exceptions = [
  {
    "detector": "URI",
    "path": "scripts/tests/short-links-db.test.ts",
    "hash": "8d3331ee208c72c30fba199e4e2b8a65d69a5034e49875a2f20dbea3a4f2f976"
  },
  {
    "detector": "URI",
    "path": "scripts/tests/short-links.test.ts",
    "hash": "3ba4b9eb95fbafcb38a3dd4bc9886809ca70168cc4a8e552ed23d894cbb07df3"
  },
  {
    "detector": "Privacy",
    "path": "supabase/migrations/20261121000000_organization_profile_summaries.sql",
    "hash": "6916616819bbc69fa4e315b206695cc3f4378fb9951a57c499ae73273680f552"
  }
];
if (import.meta.main) {
  const data = await Bun.file(process.argv[2]).text();
  let unexpected = 0;
  for (const line of data.split('\n').filter(Boolean)) {
    const result = JSON.parse(line);
    if (!result.DetectorName || typeof result.Verified !== 'boolean' || typeof result.Raw !== 'string') throw new Error('Invalid scanner result');
    if (!isReviewedFalsePositive(result)) {
      unexpected++;
      console.error(`Unreviewed ${result.DetectorName} finding in ${result.SourceMetadata?.Data?.Git?.file ?? 'unknown path'}`);
    }
  }
  console.log(`Secret scan: ${unexpected} unreviewed findings`);
  process.exit(unexpected ? 1 : 0);
}
