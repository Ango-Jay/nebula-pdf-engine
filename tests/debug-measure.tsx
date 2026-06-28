import { h } from 'preact';
import { PdfEngine, Page, Table } from '../src';
import * as fs from 'fs';
import { measureRow } from '../src/layout/measure';
import { LayoutEngine } from '../src/layout/layout-engine';

const origPaginateTable = (LayoutEngine.prototype as any).paginateTable;
(LayoutEngine.prototype as any).paginateTable = async function(...args: any[]) {
  const [tableNode, pageHeight, remainingHeight, headerHeight, contentWidth] = args;
  console.log(`\n=== paginateTable ===`);
  console.log(`pageHeight: ${pageHeight}`);
  console.log(`remainingHeight: ${remainingHeight}`);
  console.log(`headerHeight: ${headerHeight}`);
  console.log(`contentWidth: ${contentWidth}`);
  console.log(`data.length: ${tableNode.props.data.length}`);
  
  const result = await origPaginateTable.apply(this, args);
  
  console.log(`\nSegments produced: ${result.length}`);
  for (let i = 0; i < result.length; i++) {
    console.log(`  Segment ${i}: header=${result[i].header}, rows=${result[i].rows.length}`);
  }
  
  return result;
};

async function main() {
  const fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
  const fontData = fs.readFileSync(fontPath);

  const fonts = [{ name: 'Arial', data: fontData, weight: 400 as const }];

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const transactions = [
    { date: '2026-01-01T01:00:00Z', id: 'TXN-1000', type: 'credit', description: 'Investment Dividend', credit: 1266.28, debit: 0, balance: 6266.28 },
    { date: '2026-01-02T02:00:00Z', id: 'TXN-1001', type: 'debit', description: 'Gas Station', credit: 0, debit: 135.15, balance: 6131.13 },
    { date: '2026-01-03T02:00:00Z', id: 'TXN-1002', type: 'debit', description: 'Streaming Service', credit: 0, debit: 258.77, balance: 5872.36 },
    { date: '2026-01-04T08:00:00Z', id: 'TXN-1003', type: 'debit', description: 'Gas Station', credit: 0, debit: 487.84, balance: 5384.52 },
    { date: '2026-01-05T18:00:00Z', id: 'TXN-1004', type: 'debit', description: 'Pharmacy', credit: 0, debit: 40.76, balance: 5343.76 },
  ];
  
  const data = transactions.map((t) => ({ ...t, date: formatDate(t.date) }));

  const columns: any[] = [
    { header: 'Date', key: 'date', headerStyle: { fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }, cellStyle: { fontSize: 9 }, width: 80 },
    { header: 'Receipt Number', key: 'id', headerStyle: { fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }, cellStyle: { fontSize: 9 }, width: 100 },
    { header: 'Type', key: 'type', headerStyle: { fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }, cellStyle: { fontSize: 9 }, width: 60 },
    { header: 'Description', key: 'description', headerStyle: { fontWeight: 600, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }, cellStyle: { fontSize: 9, width: 120 }, flex: 1 },
    { header: 'Credit', key: 'credit', headerStyle: { fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }, cellStyle: { fontSize: 9 }, width: 80, align: 'right' },
    { header: 'Debit', key: 'debit', headerStyle: { fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }, cellStyle: { fontSize: 9 }, width: 80, align: 'right' },
    { header: 'Balance', key: 'balance', headerStyle: { fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }, cellStyle: { fontSize: 9 }, width: 80, align: 'right' },
  ];
  
  // Resolve column widths same way as layout engine
  const contentWidth = 595.28 - 40 - 40;
  const contentHeight = 841.89 - 40 - 40;
  
  let remainingWidth = contentWidth;
  let totalFlex = 0;
  const widths = new Array(columns.length).fill(0);
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (typeof col.width === 'number') {
      widths[i] = col.width;
      remainingWidth -= col.width;
    } else if (col.flex) {
      totalFlex += col.flex;
    } else {
      totalFlex += 1;
    }
  }
  if (totalFlex > 0) {
    const flexUnit = Math.max(0, remainingWidth) / totalFlex;
    for (let i = 0; i < columns.length; i++) {
      if (!widths[i]) {
        widths[i] = (columns[i].flex || 1) * flexUnit;
      }
    }
  }
  
  console.log(`contentWidth: ${contentWidth}`);
  console.log(`contentHeight: ${contentHeight}`);
  console.log(`resolvedWidths: ${widths}`);
  
  // Measure header
  const headerH = await measureRow(null, columns, widths, fonts, true);
  console.log(`\nHeader height: ${headerH}`);
  
  // Measure all 5 rows
  let totalRowHeight = headerH;
  for (let i = 0; i < data.length; i++) {
    const rowH = await measureRow(data[i], columns, widths, fonts, false);
    totalRowHeight += rowH;
    console.log(`Row ${i} (${data[i].id}) height: ${rowH}, running total: ${totalRowHeight}`);
  }
  console.log(`\nTotal height for ${data.length} rows + header: ${totalRowHeight}`);
  console.log(`Content height available: ${contentHeight}`);
}

main().catch(console.error);
