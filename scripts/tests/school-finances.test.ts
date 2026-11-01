import { expect, test } from 'bun:test';
import { cents, money, parseCsv, prepareSchoolRows } from '../lib/school-finances';
import { financePageCsv, formatFinanceMoney, type SchoolFinanceResult } from '../../apps/web/src/lib/school-finances';
const payroll='NAME,TITLE,SALARY,TRAVEL,ORGANIZATION,FISCAL_YEAR\n';
const payments='Organization,Vendor Name,Total Payments,Total Payment Amount\n';
const bytes=(s:string)=>new TextEncoder().encode(s);
test('CSV quoting, encoding, exact currency and scientific notation',()=>{
 expect(parseCsv('a,b\r\n"a,""b","line\nb"\r\n')[1]).toEqual(['a,"b','line\nb']);
 expect(()=>parseCsv('a\n"unclosed')).toThrow();
 expect(()=>parseCsv('a\n"closed"extra')).toThrow();
 expect(cents("'2.1351688807E8'")).toBe(21351688807n);
 expect(money(cents('-0.01'))).toBe('-0.01');
 expect(()=>cents('1.001')).toThrow('Sub-cent');
 expect(()=>cents('NaN')).toThrow();
 expect(formatFinanceMoney('12345678901234.56')).toBe('$12,345,678,901,234.56');
 const source=bytes(payroll+'JOSX,TEACHER,1.00,0,BIBB COUNTY BOARD OF EDUCATION,2025'); source[source.indexOf(88)]=0xe9;
 expect(prepareSchoolRows(source,'payroll',2025).rows[0].name).toBe('JOSé');
});
test('exact organization/year selection preserves duplicate payroll rows and original row numbers',()=>{
 const row='DOE,TEACHER,100,2,BIBB COUNTY BOARD OF EDUCATION,2025';
 const result=prepareSchoolRows(bytes(payroll+'OTHER,OTHER,999,0,OTHER,2025\n'+row+'\n'+row),'payroll',2025);
 expect(result.expected_rows).toBe(2);expect(result.expected_amount).toBe('200.00');expect(result.expected_travel).toBe('4.00');
 expect(result.rows.map(r=>r.source_row_number)).toEqual([2,3]); expect(result.rows.map(r=>r.row_number)).toEqual([1,2]);
 expect(()=>prepareSchoolRows(bytes(payroll+row),'payroll',2024)).toThrow('year mismatch');
 expect(()=>prepareSchoolRows(bytes(payments+'MACON COUNTY,Vendor,1,1'),'payments',2025)).toThrow('unexpected organization');
 expect(()=>prepareSchoolRows(bytes(payments+'BIBB COUNTY BOARD OF EDUCATION,Vendor,1.5,1'),'payments',2025)).toThrow('payment count');
});
test('page download preserves decimals and neutralizes spreadsheet formula names',()=>{
 const data={release:{dataset:'payments',fiscal_year:2025,source_sha256:'a'.repeat(64)},rows:[{source_row_number:8,name:'=SUM(A1)',payment_count:1,amount:'2.00',category:'reported_recipient'}]} as SchoolFinanceResult;
 const csv=financePageCsv(data);expect(csv).toContain('"\'=SUM(A1)"');expect(csv).toContain('"2.00"');expect(csv).toContain('"2025"');
});
