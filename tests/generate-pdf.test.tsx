import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import { PdfEngine, Page, Text } from '../src/index';

describe('PdfEngine Integration', () => {
  let fontBuffer: Buffer;

  beforeAll(async () => {
    // We use a system font for local testing on Mac
    const fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
    fontBuffer = await fs.readFile(fontPath);
  });

  it('generates a multiple page PDF from overflowing content', async () => {
    const engine = new PdfEngine({
      fonts: [
        { name: 'Arial', data: fontBuffer, weight: 400 }
      ],
    });

    // Create a long string of text that will definitely overflow a single A4 page
    // A4 height is ~842 points. With 20pt font, that's roughly 42 lines max.
    // Each line in A4 width (~595 points) is roughly 60-80 chars.
    // 5000 chars should definitely overflow.
    const longText = 'Hello World! '.repeat(500);

    const pdfBuffer = await engine.generate(
      <Page size="A4" padding={50}>
        <Text style={{ fontSize: 24, color: '#333' }}>
          {longText}
        </Text>
      </Page>
    );

    // Verify output is a Buffer
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);

    // Verify PDF Magic Bytes (%PDF-1.x)
    const magicBytes = pdfBuffer.slice(0, 4).toString();
    expect(magicBytes).toBe('%PDF');

    // Verify Page Count (splitting logic test)
    const { PDFDocument: LibPDFDocument } = await import('pdf-lib');
    const pdfDoc = await LibPDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    // 5000 chars of Arial 24pt should be at least 3-4 pages on A4
    expect(pageCount).toBeGreaterThan(1);
    console.log(`Generated PDF with ${pageCount} pages.`);

    // Optionally save for manual inspection if needed
    // await fs.writeFile('./test-output.pdf', pdfBuffer);
  });
});
