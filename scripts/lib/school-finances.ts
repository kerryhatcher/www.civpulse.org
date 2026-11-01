export const SCHOOL_ORGANIZATION = 'BIBB COUNTY BOARD OF EDUCATION';
export type FinanceRow = { row_number: number; source_row_number: number; name: string; amount: string; title?: string; travel?: string; payment_count?: number };

/** RFC-style CSV reader: quoted delimiters, escaped quotes and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"' && field === '' && !closed) quoted = true;
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') { if (c === '\r' && text[i + 1] === '\n') i++; if (row.some(v => v !== '')) rows.push(row); row = []; }
    } else {
      if (closed || c === '"') throw new Error('Malformed CSV quoting');
      field += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(field); if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

/** Expand source decimals at fixed 18-place precision, without floating point. */
export function decimalUnits(value: string): bigint {
  const clean = value.trim().replace(/^'(.*)'$/, '$1');
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(clean);
  if (!m) throw new Error(`Invalid monetary value: ${value}`);
  const exponent = Number(m[4] ?? 0), fraction = m[3] ?? '';
  if (Math.abs(exponent) > 20 || m[2].length + fraction.length > 40) throw new Error('Money exceeds supported precision');
  let n = BigInt(m[2] + fraction), scale = 18 + exponent - fraction.length;
  if (scale >= 0) n *= 10n ** BigInt(scale);
  else { const divisor = 10n ** BigInt(-scale); if (n % divisor !== 0n) throw new Error('Source exceeds 18 fractional digits'); n /= divisor; }
  return m[1] ? -n : n;
}
export function decimalMoney(value: bigint): string {
  const n = value < 0n ? -value : value, base = 10n ** 18n;
  const fraction = String(n % base).padStart(18,'0').replace(/0+$/, '').padEnd(2,'0');
  return `${value < 0n ? '-' : ''}${n / base}.${fraction}`;
}
export function cents(value: string): bigint {
  const units=decimalUnits(value); if(units % 10000000000000000n !== 0n) throw new Error('Sub-cent amount');
  return units / 10000000000000000n;
}
export function money(value: bigint): string { return decimalMoney(value * 10000000000000000n); }
export function prepareSchoolRows(bytes: Uint8Array, dataset: 'payroll' | 'payments', year: number) {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { text = new TextDecoder('windows-1252', { fatal: true }).decode(bytes); }
  const [header, ...source] = parseCsv(text);
  const columns = dataset === 'payroll' ? ['NAME','TITLE','SALARY','TRAVEL','ORGANIZATION','FISCAL_YEAR'] : ['Organization','Vendor Name','Total Payments','Total Payment Amount'];
  if (!header || header.join('|') !== columns.join('|')) throw new Error('Unexpected export header');
  if (!Number.isInteger(year) || year < 2015 || year > 2100) throw new Error('Invalid fiscal year');
  const rows: FinanceRow[] = []; let total = 0n, travelTotal = 0n;
  for (let i = 0; i < source.length; i++) {
    const values = source[i];
    if (values.length !== header.length) throw new Error(`Wrong column count at source row ${i + 1}`);
    const organization = values[dataset === 'payroll' ? 4 : 0];
    if (dataset === 'payroll' && organization !== SCHOOL_ORGANIZATION) continue;
    if (organization !== SCHOOL_ORGANIZATION) throw new Error('Payment export contains an unexpected organization');
    if (dataset === 'payroll' && values[5].trim().replace(/^'(.*)'$/, '$1') !== String(year)) throw new Error('Payroll year mismatch');
    const name = values[dataset === 'payroll' ? 0 : 1], amount = decimalUnits(values[dataset === 'payroll' ? 2 : 3]);
    if (!name.trim() || name.length > (dataset === 'payroll' ? 160 : 500)) throw new Error('Missing or oversized source name');
    const row: FinanceRow = { row_number: i + 1, source_row_number: i + 1, name, amount: decimalMoney(amount) };
    // Payroll bulk exports contain other organizations. Preserve original source row
    // separately in the manifest; API ordinals identify the filtered release.
    if (dataset === 'payroll') {
      row.title = values[1]; if (!row.title.trim() || row.title.length > 160) throw new Error('Missing or oversized payroll title');
      const travel = decimalUnits(values[3]); row.travel = decimalMoney(travel); travelTotal += travel;
    } else {
      if (!/^\d+$/.test(values[2]) || Number(values[2]) > 2147483647) throw new Error('Invalid payment count');
      row.payment_count = Number(values[2]);
    }
    rows.push(row); total += amount;
  }
  if (!rows.length) throw new Error('No Bibb school records found');
  const sourceRowNumbers = rows.map(row => row.row_number);
  rows.forEach((row, i) => row.row_number = i + 1);
  return { rows, source_row_numbers: sourceRowNumbers, expected_rows: rows.length, expected_amount: decimalMoney(total), expected_travel: dataset === 'payroll' ? decimalMoney(travelTotal) : null };
}
