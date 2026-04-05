# 🌌 Nebula PDF Engine

A high-performance, server-side PDF generation library that transforms React/JSX templates into beautiful, multi-page PDF documents.

Powered by **Satori**, **Resvg**, and **pdf-lib**, Nebula provides pixel-perfect layout control with the familiarity of Flexbox and JSX.

---

## ✨ Features

- **⚛️ Standard JSX**: Use `<Page>`, `<Box>`, `<Text>`, and `<Image>` with Preact.
- **📏 Flexbox Layout**: Full support for CSS Flexbox via Satori (Yoga).
- **📄 Multi-Page Engine**: Automatic content overflow detection and smart text splitting across pages.
- **📐 Precise Measure**: Control the exact content width of your pages with the `contentWidth` override.
- **📊 First-Class Tables**: Schema-driven tables with automatic column resolution and repeating headers.
- **🖼️ High-Density Assets**: Crisp SVG and remote image resolution via **Sharp** scaling (Retina ready).
- **🦅 High Performance**: Powered by a Rust-based rendering pipeline (Resvg).
- **🎨 Custom DPI**: Configure your export's device pixel ratio for the perfect balance of size and quality.

---

## 🚀 Installation

```bash
npm install nebula-pdf-engine
```

**Note**: This package requires `sharp` and `@resvg/resvg-js`, which are native dependencies.

---

## 📊 Tables (First-Class Primitive)

Nebula treats tables as layout primitives. Instead of manually building rows with boxes, you provide a schema and data.

```tsx
import { Table } from 'nebula-pdf-engine';

const columns = [
  { header: 'ID', key: 'id', width: 50 },
  { header: 'Description', key: 'desc', flex: 1 },
  { header: 'Amount', key: 'amt', width: 100, align: 'right' }
];

<Table 
  columns={columns} 
  data={rows} 
  options={{ 
    stripe: true, 
    headerRepeat: true 
  }} 
/>
```

### Highlights:
- **Header Repetition**: If a table spans 10 pages, the header appears on all 10 automatically.
- **Atomic Rows**: A single row will never be sliced in half across pages.
- **Flexible Widths**: Mix absolute points (`100`), percentages (`"20%"`), and flex weights (`flex: 1`).

---

## ⚙️ TypeScript Configuration

Nebula uses **Preact** for its lightweight JSX runtime. To use JSX in your project, update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

### Alternative: Without JSX
If you prefer not to use JSX or don't want to change your config, you can use the `createElement` function (or its alias `h`) directly in `.ts` files:

```typescript
import { PdfEngine, Page, Text, createElement } from 'nebula-pdf-engine';

const pdf = await engine.generate(
  createElement(Page, { size: 'A4' }, 
    createElement(Text, { style: { fontSize: 20 } }, 'Hello Workspace!')
  )
);
```

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

## 📄 Multi-Page Handling

Nebula handles multi-page documents in two ways to give you maximum flexibility.

### 1. Automatic Overflow (Dynamic Content)
If a single `<Page>` contains more content than can fit, the layout engine automatically splits it. This is ideal for long text, tables, or dynamic lists.

```tsx
<Page padding={40}>
  <Text>This very long text will span multiple pages automatically...</Text>
</Page>
```

### 2. Manual Pagination (Explicit Pages)
For documents with distinct sections (e.g., a Cover Page followed by a Report), you can provide multiple `<Page>` components:

```tsx
await engine.generate(
  <>
    <Page size="A4">
      <Text>Cover Page</Text>
    </Page>
    <Page size="A4">
      <Text>Second Page with different content...</Text>
    </Page>
  </>
);
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
- `contentWidth`: `number`. **Optional**. Explicitly sets the width of the content area. Useful for narrow layouts (like receipts) where you want to restrict the measure area regardless of page size.

### `<Box>`
A generic flexbox container.
- `style`: All Satori-supported flexbox properties (`display: flex` is default).

### `<Text>`
Renders text strings.
- **Smart Splitting**: If text exceeds the page height, the engine split it at a safe word boundary and continues on a new page.

### `<Image>`
- `src`: Absolute paths, URLs, or relative paths.
- `width` / `height`: **Required**. The engine uses these to downsample the image for the PDF, significantly reducing file size.

### `<Table>`
- `columns`: Array of `ColumnDefinition` objects (header, key, width/flex).
- `data`: Array of objects to render.
- `options`: `{ stripe, headerRepeat, stripeColor }`.
- `headerStyle` / `rowStyle`: Style overrides for table elements.

---

## 🧠 Advanced: Layout Engine

Nebula doesn't just render a single canvas; it features a recursive **Layout Engine**:
1. **Measurement Pass**: Every child is pre-rendered at the target width to calculate its exact content height.
2. **Bin Packing**: Elements are distributed into pages according to your `contentHeight`.
3. **Table Pipeline**: Tables trigger a specialized row-by-row pagination loop with header injection.
4. **Atomic vs Splittable**: Images, Boxes, and **Table Rows** are "Atomic", while Text is "Splittable".

---

## 📜 License
MIT