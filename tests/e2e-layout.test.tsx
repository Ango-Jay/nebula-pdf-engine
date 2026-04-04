/** @jsxImportSource preact */
import { describe, it, expect, beforeAll } from 'vitest';
import { PdfEngine, Page, Box, Text, Table } from '../src';
import * as fs from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

describe('E2E Complex Layout', () => {
    let fontBuffer: Buffer;

    beforeAll(async () => {
        const fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
        fontBuffer = await fs.readFile(fontPath);
    });

    it('generates a complex multi-page document with tables and nested boxes', async () => {
        const engine = new PdfEngine({
            fonts: [{ name: 'Arial', data: fontBuffer, weight: 400 }],
        });

        const columns = [
            { header: 'ID', key: 'id', width: 50 },
            { header: 'Description', key: 'desc', flex: 1 },
            { header: 'Status', key: 'status', width: 80 },
        ];

        const data = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            desc: `This is a long description for item ${i + 1} that might wrap if the column is narrow enough.`,
            status: i % 2 === 0 ? 'Active' : 'Pending',
        }));

        const pdfBuffer = await engine.generate(
            <>
                <Page padding={50}>
                    <Box style={{ marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#333', borderBottomStyle: 'solid' }}>
                        <Text style={{ fontSize: 32, fontWeight: 700 }}>Complex Report</Text>
                    </Box>
                    
                    <Box style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 14 }}>
                            This report contains a large table that should automatically span multiple pages, 
                            repeating the header on each page, while maintaining atomic row integrity.
                        </Text>
                    </Box>

                    <Table 
                        columns={columns} 
                        data={data} 
                        options={{ stripe: true, headerRepeat: true }}
                        style={{ marginTop: 20 }}
                    />

                    <Box style={{ marginTop: 20 }}>
                        <Text style={{ fontSize: 12, color: '#666' }}>
                            Footer content that should appear after the table concludes.
                        </Text>
                    </Box>
                </Page>
            </>
        );

        expect(pdfBuffer).toBeInstanceOf(Buffer);
        
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pageCount = pdfDoc.getPageCount();

        // 50 rows of wrapping text should definitely take 2-3 pages.
        expect(pageCount).toBeGreaterThan(1);
        console.log(`Generated E2E PDF with ${pageCount} pages.`);
    });
});
