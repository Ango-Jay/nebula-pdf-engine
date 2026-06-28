import { h } from 'preact';
import { PdfEngine, Page, Table } from '../src';
import { LayoutEngine } from '../src/layout/layout-engine';
import { resolvePageDimensions } from '../src/types';
import { measureRow } from '../src/layout/measure';
import * as fs from 'fs';
import * as path from 'path';

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

  // Simulate what the layout engine does
  const dimensions = resolvePageDimensions('A4', 'portrait', 40);
  console.log('Page dimensions:', {
    width: dimensions.width,
    height: dimensions.height,
    contentWidth: dimensions.contentWidth,
    contentHeight: dimensions.contentHeight,
  });

  // Resolve widths like the engine does
  const resolveColumnWidths = (cols: any[], containerWidth: number): number[] => {
    const widths = new Array(cols.length).fill(0);
    let remainingWidth = containerWidth;
    let totalFlex = 0;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
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
      for (let i = 0; i < cols.length; i++) {
        if (!widths[i]) {
          widths[i] = (cols[i].flex || 1) * flexUnit;
        }
      }
    }
    return widths.map(w => Math.max(1, w));
  };

  const resolvedWidths = resolveColumnWidths(columns, dimensions.contentWidth);
  console.log('Resolved column widths:', resolvedWidths);
  console.log('Total width:', resolvedWidths.reduce((a, b) => a + b, 0));

  // Measure header
  const headerHeight = await measureRow(null, columns, resolvedWidths, fonts, true, { fontWeight: 600, fontSize: 10 });
  console.log('Header height:', headerHeight);

  // Measure each row
  let totalHeight = headerHeight;
  for (let i = 0; i < data.length; i++) {
    const rowHeight = await measureRow(data[i], columns, resolvedWidths, fonts, false, undefined);
    totalHeight += rowHeight;
    console.log(`Row ${i} (${data[i].id}): height=${rowHeight.toFixed(2)}, cumulative=${totalHeight.toFixed(2)}, remaining=${(dimensions.contentHeight - totalHeight).toFixed(2)}`);
  }

  console.log(`\nTotal table height for ${data.length} rows: ${totalHeight.toFixed(2)}`);
  console.log(`Content height available: ${dimensions.contentHeight.toFixed(2)}`);
  console.log(`Fits on one page: ${totalHeight <= dimensions.contentHeight}`);
}

main().catch(console.error);
