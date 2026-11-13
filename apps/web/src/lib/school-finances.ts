export type FinanceDataset = 'payroll' | 'payments';
export interface SchoolFinanceRow {
  recipient?: null | { id: string; kind: 'person' | 'organization'; record_id: string; slug: string; name: string; is_stub: boolean; identity_review_required: boolean };
  row_number: number; source_row_number: number; person_id: string | null; identity_review_required: boolean | null; name: string; title: string | null; amount: string; travel: string | null; payment_count: number | null; category: string;
}
export interface SchoolFinanceResult {
  release: null | { id: string; dataset: FinanceDataset; fiscal_year: number; organization_id: string | null; organization_slug: string | null;
    source_organization: string; source_organization_id: string; county_fips: string; source_url: string; source_filename: string; source_sha256: string;
    source_filters: Record<string, unknown>; retrieved_at: string; published_at: string; row_count: number; amount: string; travel: string | null };
  years: number[]; rows: SchoolFinanceRow[]; total: number; filtered_amount: string; filtered_travel: string | null;
}
export function formatFinanceMoney(value: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return 'Unavailable';
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  let rounded=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0').slice(0,2));
  if (Number(fraction[2] ?? '0') >= 5) rounded++;
  return `${value.startsWith('-') && rounded !== 0n ? '-' : ''}$${new Intl.NumberFormat('en-US').format(rounded/100n)}.${String(rounded%100n).padStart(2,'0')}`;
}
export function financePageCsv(data: SchoolFinanceResult): string {
  const payroll = data.release?.dataset === 'payroll';
  const fields = payroll ? ['Source row','Name','Title','Salary','Travel','Fiscal year','Source SHA-256'] : ['Source row','Recipient','Reported payments','Amount','Category','Fiscal year','Source SHA-256'];
  const quote = (value: unknown) => { let text = String(value ?? ''); if (/^\s*[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"','""')}"`; };
  return [fields, ...data.rows.map(row => [row.source_row_number,row.name, payroll ? row.title : row.payment_count,row.amount,payroll ? row.travel : row.category,data.release?.fiscal_year,data.release?.source_sha256])].map(row => row.map(quote).join(',')).join('\r\n');
}
