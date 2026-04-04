# 🌌 Nebula PDF Engine

A high-performance, server-side PDF generation library that transforms React/JSX templates into beautiful, multi-page PDF documents.

Powered by **Satori**, **Resvg**, and **pdf-lib**, Nebula provides pixel-perfect layout control with the familiarity of Flexbox and JSX.

---

## ✨ Features

- **⚛️ Standard JSX**: Use `<Page>`, `<Box>`, `<Text>`, and `<Image>` with Preact.
- **📏 Flexbox Layout**: Full support for CSS Flexbox via Satori (Yoga).
- **📄 Multi-Page Engine**: Automatic content overflow detection and smart text splitting across pages.
- **🖼️ Smart Assets**: Just-in-time image optimization and resizing via **Sharp**.
- **🦅 High Performance**: Powered by a Rust-based rendering pipeline (Resvg).
- **🛡️ NestJS Native**: First-class support for NestJS with a dynamic module wrapper.
- **🎨 Retina Quality**: Defaults to 2x pixel density for crisp text and graphics.

---

## 🚀 Installation

```bash
npm install nebula-pdf-engine
```

**Note**: This package requires `sharp` and `@resvg/resvg-js`, which are native dependencies.

---

## 🛠️ Quick Start (Standalone)

```tsx
import { PdfEngine, Page, Text, Image } from 'nebula-pdf-engine';
import * as fs from 'fs';

// 1. Initialize the engine with fonts
const engine = new PdfEngine({
  fonts: [
    { name: 'Inter', data: fs.readFileSync('./fonts/Inter-Regular.ttf'), weight: 400 }
  ],
  devicePixelRatio: 2, // Retina quality
});

// 2. Generate PDF
const pdfBuffer = await engine.generate(
  <Page size="A4" padding={40}>
    <Text style={{ fontSize: 32, marginBottom: 20 }}>Hello Nebula!</Text>
    <Image src="https://example.com/logo.png" width={100} height={50} />
    <Text style={{ marginTop: 20 }}>
      This content will automatically flow across multiple pages if it's too long.
    </Text>
  </Page>
);

fs.writeFileSync('output.pdf', pdfBuffer);
```

---

## 🏢 NestJS Integration

Nebula provides a `NebulaPdfModule` for seamless integration into NestJS environments.

### 1. Register the Module

```typescript
@Module({
  imports: [
    NebulaPdfModule.forRoot({
      fonts: [{ name: 'Inter', data: fontBuffer, weight: 400 }],
    }),
  ],
})
export class AppModule {}
```

### 2. Inject and Use

```typescript
@Injectable()
export class ReportService {
  constructor(private readonly pdfService: NebulaPdfService) {}

  async generateReport(data: any) {
    return await this.pdfService.generate(
      <Page>
        <Text>Report for {data.name}</Text>
      </Page>
    );
  }
}
```

---

## 📦 Component Primitives

### `<Page>`
The top-level container.
- `size`: `'A4' | 'LETTER' | 'LEGAL'` (Default: `A4`)
- `orientation`: `'portrait' | 'landscape'` (Default: `portrait`)
- `padding`: `number | { top, right, bottom, left }`

### `<Box>`
A generic flexbox container.
- `style`: All Satori-supported flexbox properties (`display: flex` is default).

### `<Text>`
Renders text strings.
- **Smart Splitting**: If text exceeds the page height, the engine split it at a safe word boundary and continues on a new page.

### `<Image>`
- `src`: Absolute paths, URLs, or relative paths.
- `width` / `height`: **Required**. The engine uses these to downsample the image for the PDF, significantly reducing file size.

---

## 🧠 Advanced: Layout Engine

Nebula doesn't just render a single canvas; it features a recursive **Layout Engine**:
1. **Measurement Pass**: Every child is pre-rendered at the target width to calculate its exact content height.
2. **Bin Packing**: Elements are distributed into pages according to your `contentHeight`.
3. **Atomic vs Splittable**: Images and Boxes are "Atomic" (moved to next page if they overflow), while Text is "Splittable".

---

## 📜 License
MIT