import { PDFDocument } from 'pdf-lib';

// ─── Types ───

export interface AssemblerOptions {
  /** PDF metadata: document title */
  title?: string;
  /** PDF metadata: document author */
  author?: string;
  /** PDF metadata: document subject */
  subject?: string;
}

export interface PageBuffer {
  /** PNG image data for this page */
  pngBuffer: Buffer;
  /** Page width in PDF points */
  width: number;
  /** Page height in PDF points */
  height: number;
}

// ─── PDF Assembly ───

/**
 * Assembles an array of PNG page buffers into a single multi-page PDF document.
 *
 * Uses pdf-lib for the final merge — it's a pure JS library with zero
 * native dependencies, keeping the install lightweight.
 *
 * @param pages - Array of page images with their dimensions
 * @param options - Optional PDF metadata
 * @returns The complete PDF as a Uint8Array
 */
export async function assemblePdf(
  pages: PageBuffer[],
  options: AssemblerOptions = {},
): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error('[nebula-pdf-engine] Cannot assemble a PDF with zero pages.');
  }

  const pdfDocument = await PDFDocument.create();

  // ─── Metadata ───

  pdfDocument.setProducer('nebula-pdf-engine');
  pdfDocument.setCreationDate(new Date());

  if (options.title) pdfDocument.setTitle(options.title);
  if (options.author) pdfDocument.setAuthor(options.author);
  if (options.subject) pdfDocument.setSubject(options.subject);

  // ─── Pages ───

  for (const page of pages) {
    // Embed the PNG image into the PDF document
    const pngImage = await pdfDocument.embedPng(page.pngBuffer);

    // Add a new page with the exact page dimensions
    const pdfPage = pdfDocument.addPage([page.width, page.height]);

    // Draw the image to fill the entire page
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    });
  }

  // ─── Serialize ───

  return pdfDocument.save();
}
