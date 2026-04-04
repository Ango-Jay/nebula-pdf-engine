/** @jsxImportSource preact */
import { describe, it, expect, beforeAll } from 'vitest';
import { PdfEngine, Page, Table } from '../src';
import * as fs from 'fs';
import * as path from 'path';

describe('Table Component', () => {
  let fontData: Buffer;

  beforeAll(async () => {
    // Standard system font on Mac
    const fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
    fontData = fs.readFileSync(fontPath);
  });

  it('should generate a multi-page table with header repetition', async () => {
    const engine = new PdfEngine({
      fonts: [{ name: 'Arial', data: fontData, weight: 400 }],
    });

    const columns = [
      { header: 'ID', key: 'id', width: 50 },
      { header: 'Description', key: 'desc', flex: 1 },
      { header: 'Amount', key: 'amt', width: 100, align: 'right' as const },
    ];

    // Generate 100 rows to force multiple pages
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      desc: `Transaction item number ${i + 1} with some long text to test wrapping behavior in the description column.`,
      amt: `$${(Math.random() * 1000).toFixed(2)}`,
    }));

    const pdfBuffer = await engine.generate(
      <Page padding={40}>
        <Table 
          columns={columns} 
          data={data} 
          options={{ stripe: true, headerRepeat: true }} 
          headerStyle={{ backgroundColor: '#eeeeee', fontWeight: 700 }}
        />
      </Page>
    );

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    
    // Save for manual inspection
    fs.writeFileSync(path.join(__dirname, 'output-table.pdf'), pdfBuffer);
  });
});
