# Layout Engine — Deep Dive Documentation

## Table of Contents

1. [Overview & Motivation](#1-overview--motivation)
2. [Where the Layout Engine Sits in the Pipeline](#2-where-the-layout-engine-sits-in-the-pipeline)
3. [Core Algorithm — Bin-Packing](#3-core-algorithm--bin-packing)
4. [The Measurement System](#4-the-measurement-system)
5. [Component Classification](#5-component-classification)
6. [Component-by-Component Pagination](#6-component-by-component-pagination)
   - [Box (Atomic)](#61-box-atomic)
   - [Image (Atomic)](#62-image-atomic)
   - [Text (Splittable)](#63-text-splittable)
   - [Table (Specialized)](#64-table-specialized)
7. [Page Dimensions & Coordinate System](#7-page-dimensions--coordinate-system)
8. [Data Flow — End to End](#8-data-flow--end-to-end)
9. [Edge Cases & Safeguards](#9-edge-cases--safeguards)
10. [Glossary](#10-glossary)

---

## 1. Overview & Motivation

Nebula PDF Engine renders JSX component trees into multi-page PDF documents. The fundamental challenge: **a single `<Page>` component can contain more content than fits on one physical page**. The Layout Engine solves this by distributing child VNodes across as many physical pages as needed, preserving visual order and splitting content intelligently.

### Why a custom layout engine?

Satori (the SVG renderer) handles flexbox layout within a single fixed-size canvas, but has no concept of "pages" or "page breaks." We need an intermediate step between the JSX tree and rendering that:

1. **Measures** how tall each child will be when rendered
2. **Decides** which children fit on the current page
3. **Splits or moves** children that overflow to subsequent pages
4. **Produces** a list of "page groups" — each group contains the VNodes for one physical page

---

## 2. Where the Layout Engine Sits in the Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        FULL PIPELINE                            │
│                                                                 │
│  JSX Template                                                   │
│       │                                                         │
│       ▼                                                         │
│  PdfEngine.generate()                                           │
│       │                                                         │
│       ├─ 1. extractPages()      → Find <Page> VNodes            │
│       ├─ 2. resolveImages()     → Convert img src → base64      │
│       ├─ 3. layoutEngine.paginate()  ← ══ THIS DOCUMENT ══     │
│       │       │                                                 │
│       │       ├─ measureAllChildren()   (Satori+Resvg)          │
│       │       ├─ bin-pack loop                                  │
│       │       │    ├─ Table? → paginateTable()                  │
│       │       │    ├─ Fits?  → push to current page             │
│       │       │    ├─ Text?  → splitTextNode()                  │
│       │       │    └─ Atomic?→ move to next page                │
│       │       └─ return PageGroup[]                             │
│       │                                                         │
│       ├─ 4. renderToImage()     → Satori SVG → Resvg PNG       │
│       └─ 5. assemblePdf()       → pdf-lib merges PNGs          │
│                                                                 │
│  Output: PDF Buffer                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Input:** An array of child VNodes from a `<Page>`, plus the resolved page dimensions.
**Output:** `PageGroup[]` — an array of arrays, where each inner array contains the VNodes for one physical PDF page.

---

## 3. Core Algorithm — Bin-Packing

The engine uses a **1D bin-packing** strategy. Think of each page as a vertical "bin" with a fixed height (`contentHeight`). Children are placed top-to-bottom until the bin is full, then a new bin (page) is started.

### Pseudocode

```
function paginate(children, dimensions):
    measure every child's rendered height
    
    currentPage = []
    remainingHeight = contentHeight
    
    for each child:
        if child is a Table:
            run specialized table pagination
            distribute table segments across pages
            
        else if child fits (height ≤ remainingHeight):
            add to currentPage
            remainingHeight -= height
            
        else if child is splittable (Text):
            split at the boundary
            add fitting portion to currentPage
            start new page(s) with overflow
            
        else (atomic — Box, Image):
            flush currentPage as a completed page
            start new page with this child
    
    return all pages
```

### Key invariants

- **Order is preserved**: Children appear in the output in the same order as the input.
- **No data loss**: Every child (or piece of a split child) appears in exactly one page group.
- **Height tracking**: `remainingHeight` always reflects how much vertical space is left on the current page.

---

## 4. The Measurement System

Accurate measurement is the foundation of correct pagination. The engine uses **render-based measurement** — it actually renders each node to get its true height.

### How `measureNodeHeight()` works

```
┌─────────────────────────────────────────────────┐
│  1. Wrap VNode in a full-width flex container    │
│  2. Render to SVG via Satori                     │
│     (width = contentWidth, height = 5000)        │
│  3. Parse SVG with Resvg                         │
│  4. Call getBBox() → exact bounding box           │
│  5. Return bbox.height                           │
└─────────────────────────────────────────────────┘
```

**Why 5000px height?** We use an "unconstrained" height so Satori doesn't clip or compress the content. The content renders at its natural height, and `getBBox()` tells us exactly how tall it actually is.

**Why render-based?** Estimating height from font metrics and text length is error-prone — it can't account for flexbox wrapping, padding, borders, nested elements, or dynamic font shaping. By rendering through the same Satori pipeline used for final output, measurements match reality exactly.

### `measureRow()` — Table-specific measurement

Tables need per-row measurement because each row can have a different height (due to text wrapping in cells). For each row:

1. Build a temporary cell VNode for each column
2. Measure each cell at its resolved column width using `measureNodeHeight()`
3. Return the **maximum** cell height (the tallest cell determines the row height)

This ensures rows with long text in one column correctly account for the wrapped height.

### `measureTableSegment()` — Segment height

Sums up the header height (if present) plus all row heights in a segment. Used after pagination to track how much space a table segment occupies on a page.

---

## 5. Component Classification

Every VNode the engine encounters falls into one of three categories:

| Category | Components | Behavior at page boundary |
|---|---|---|
| **Atomic** | `Box`, `Image` | Moved entirely to the next page |
| **Splittable** | `Text` | Split at the overflow point; part stays, part moves |
| **Specialized** | `Table` | Custom sub-algorithm handles row-level pagination |

### Detection logic

```typescript
// Table detection (isTableNode):
//   - type.__isNebulaTable === true
//   - type.displayName === 'NebulaPdfTable'
//   - type === 'table-internal'

// Splittable detection (isSplittable):
//   - type is a function with displayName 'NebulaPdfText'
//   - type === 'span' with string children (produced by text splitter)

// Everything else → Atomic
```

---

## 6. Component-by-Component Pagination

### 6.1 Box (Atomic)

**Component:** `<Box>` — a generic flex container (`<div>` with `display: flex`).

**Page-break behavior:** If a Box doesn't fit in `remainingHeight`, the entire Box is moved to the next page. It is never split.

```
Page 1:                    Page 2:
┌──────────────────┐      ┌──────────────────┐
│  Child A         │      │  ┌────────────┐  │
│  Child B         │      │  │  Child C    │  │
│                  │      │  │  (Box)      │  │
│  ← no room for  │      │  │  Moved here │  │
│    Child C       │      │  └────────────┘  │
└──────────────────┘      └──────────────────┘
```

**Code path** (in `paginate()`):
```typescript
// Atomic node — move entirely to the next page
if (currentPage.length > 0) {
    pages.push(currentPage);       // flush current page
}
currentPage = [item.node];         // start new page with this node
remainingHeight = contentHeight - item.height;
```

**Oversized Box:** If a Box is taller than an entire page (`remainingHeight < 0` after placement), it gets its own page and will be clipped/scaled during rendering.

---

### 6.2 Image (Atomic)

**Component:** `<Image>` — renders an `<img>` with required `width` and `height`.

**Page-break behavior:** Identical to Box. Images are always atomic — they are never split across pages.

The `width` and `height` props are mandatory specifically so the layout engine can measure the image's space requirements without loading/decoding the image data. The engine just needs to know "this image occupies WxH points."

**Note:** Before the layout engine runs, `PdfEngine.resolveImages()` has already converted all `src` attributes to base64 data URIs. The layout engine doesn't touch image sources — it only cares about dimensions.

---

### 6.3 Text (Splittable)

**Component:** `<Text>` — renders a `<span>` with text content.

**Page-break behavior:** When a Text node overflows, the engine attempts to split it into two (or more) pieces at the page boundary. This is the only component type that supports splitting.

#### The splitting algorithm (`splitTextNode`)

```
┌─────────────────────────────────────────────────┐
│  1. Extract plain text from children             │
│  2. Calculate font metrics (via fontkit):        │
│     - averageCharacterWidth                      │
│     - lineHeight                                 │
│     - charsPerLine                               │
│  3. Compute linesThatFit = ⌊remainingHeight      │
│                              / lineHeight⌋       │
│  4. roughSplitIndex = linesThatFit × charsPerLine│
│  5. Snap to nearest word boundary                │
│  6. Create two new <span> VNodes:                │
│     - fits: text[0..splitIndex]                  │
│     - overflow: text[splitIndex..end]            │
└─────────────────────────────────────────────────┘
```

#### Font metrics calculation

The engine uses **fontkit** to analyze the actual font buffer:
1. Parses the font file to get `unitsPerEm`
2. Samples A-Z, a-z, 0-9, and space to compute average glyph advance width
3. Scales to the target font size: `avgWidth = (totalAdvance × fontSize / unitsPerEm) / sampleLength`
4. Computes `charsPerLine = ⌊containerWidth / avgWidth⌋`
5. Uses `lineHeight = fontSize × 1.2` (default) or the explicit `lineHeight` prop

If fontkit fails, a heuristic fallback is used: `avgCharWidth ≈ fontSize × 0.55`.

#### Multi-page text overflow (`trySplit`)

If a Text node is so long it spans 3+ pages, `trySplit()` handles recursive splitting:

```
Original text (very long):
├── fits on page 1 (via splitTextNode)
├── overflow:
│   ├── fits on page 2 (via splitTextNode again)
│   ├── overflow:
│   │   └── fits on page 3 (final remainder)
```

The loop continues splitting the overflow portion while `overflowHeight > pageHeight`.

#### Word boundary snapping

The split never breaks in the middle of a word. `findWordBoundary()` searches backward (up to 50 characters) from the rough split point for a space, newline, or tab. If no boundary is found, it falls back to the exact character position.

---

### 6.4 Table (Specialized)

**Component:** `<Table>` — a data-driven table with column definitions.

Tables are the most complex case because they have internal structure (header + rows) that requires special handling. The `<Table>` component doesn't render directly — it emits a `<table-internal>` marker element that the layout engine intercepts.

#### Why tables need special treatment

1. **Row integrity**: A table row must never be split across pages. Each row is atomic.
2. **Header repetition**: When a table continues on a new page, the header row should repeat.
3. **Column width resolution**: Column widths (fixed, percentage, flex) must be resolved before row measurement.
4. **Per-row measurement**: Each row can have a different height due to text wrapping.

#### The table pagination algorithm (`paginateTable`)

**Input:**
- `tableNode` — the Table VNode with `data`, `columns`, `options`, etc.
- `pageHeight` — full page content height
- `remainingHeight` — space left on the current page
- `headerHeight` — pre-measured height of the header row
- `contentWidth` — page content width for column resolution

**Output:** `TableSegment[]` — each segment represents the portion of the table for one page.

```typescript
interface TableSegment {
    header: boolean;       // whether to render a header on this segment
    rows: any[];           // data rows in this segment
    resolvedWidths: number[]; // column widths in px
}
```

**Algorithm walkthrough:**

```
currentHeight = remainingHeight   // start with what's left on current page
currentRows = []
isFirstSegment = true

for each row in data:
    measure row height
    
    neededHeight = rowHeight
    if currentRows is empty:
        neededHeight += headerHeight   // first row needs header space too
    
    if row doesn't fit AND we have rows to flush:
        push currentRows as a segment
        start new segment with this row
        currentHeight = pageHeight - headerHeight - rowHeight
    else:
        add row to currentRows
        subtract rowHeight from currentHeight
        if this is the first row, also subtract headerHeight

push final remaining rows as a segment
```

**Visual example** (30 rows, each 25px, page height 400px, header 30px):

```
Segment 1 (current page, 300px remaining):
┌─────────────────────────┐
│  HEADER (30px)          │
│  Row 1  (25px)          │
│  Row 2  (25px)          │   270px of content used
│  ...                    │   (header + 10 rows × 25 + buffer)
│  Row 10 (25px)          │
│  ← 30px remaining       │
└─────────────────────────┘

Segment 2 (new full page, 400px):
┌─────────────────────────┐
│  HEADER (30px) repeated │
│  Row 11 (25px)          │
│  Row 12 (25px)          │   14 rows fit (30 + 14×25 = 380)
│  ...                    │
│  Row 24 (25px)          │
│  ← 20px remaining       │
└─────────────────────────┘

Segment 3 (new full page, 400px):
┌─────────────────────────┐
│  HEADER (30px) repeated │
│  Row 25 (25px)          │
│  ...                    │
│  Row 30 (25px)          │
│  ← lots of space left   │
└─────────────────────────┘
```

#### Column width resolution (`resolveColumnWidths`)

Columns can specify width in three ways, resolved in this order:

| Priority | Type | Example | Resolution |
|---|---|---|---|
| 1 | Fixed (px) | `width: 100` | Exactly 100px |
| 2 | Percentage | `width: '20%'` | 20% of `contentWidth` |
| 3 | Flex | `flex: 2` | Proportional share of remaining space |
| 4 | Default | *(none)* | Treated as `flex: 1` |

**Two-pass algorithm:**
1. **Pass 1:** Allocate fixed and percentage widths, subtract from `remainingWidth`, sum `totalFlex`
2. **Pass 2:** Distribute `remainingWidth` proportionally among flex columns
3. **Final:** Clamp all widths to `MIN_DIMENSION` (1px minimum)

#### Segment-to-VNode conversion (`createTableSegmentVNode`)

After `paginateTable` produces segments, each segment is converted into a renderable VNode tree:

```
<div> (table container, column flex)
  ├── <div> (header row, row flex, if segment.header)
  │     ├── <div> (cell 1) → <div> "Column Header"
  │     ├── <div> (cell 2) → <div> "Column Header"
  │     └── ...
  ├── <div> (data row 1, row flex)
  │     ├── <div> (cell 1) → <div> "cell value"
  │     └── ...
  ├── <div> (data row 2, striped if options.stripe)
  └── ...
```

Each cell is a `<div>` with the resolved column width, and the text is wrapped in an inner `<div>` with `wordBreak: 'break-word'`.

#### How segments are distributed across pages (back in `paginate()`)

After `paginateTable()` returns segments, the main loop distributes them:

```
Segment 0 (first): Added to current page
    If more segments exist → flush page, reset height
    If only segment → subtract height, continue

Segments 1..N-2 (intermediate): Each gets its own full page

Segment N-1 (last): Starts a new current page
    remainingHeight = contentHeight - segmentHeight
    (subsequent non-table children can follow on this page)
```

This ensures the last table segment can share its page with content that follows the table.

---

## 7. Page Dimensions & Coordinate System

All measurements use **PDF points** (1 point = 1/72 inch).

```
┌─────────────────────────── width ──────────────────────────┐
│                        (e.g., 595.28 for A4)               │
│  ┌─ padding.left                        padding.right ─┐   │
│  │                                                      │   │
│  │  ┌──────── contentWidth ────────┐                    │   │ height
│  │  │                              │                    │   │ (841.89
│  │  │     Content lives here       │ contentHeight      │   │  for A4)
│  │  │                              │                    │   │
│  │  └──────────────────────────────┘                    │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                     padding.bottom                          │
└────────────────────────────────────────────────────────────┘
```

Resolved by `resolvePageDimensions()`:
- `contentWidth = width - padding.left - padding.right`
- `contentHeight = height - padding.top - padding.bottom`

Supported page sizes: `A4` (595.28 × 841.89), `LETTER` (612 × 792), `LEGAL` (612 × 1008).

---

## 8. Data Flow — End to End

Here is the complete journey of a `<Page>` with mixed content:

```tsx
<Page size="A4" padding={40}>
  <Box style={{ height: 100 }}>Header Banner</Box>
  <Text style={{ fontSize: 12 }}>A very long paragraph...</Text>
  <Table columns={cols} data={bigDataset} />
  <Text>Footer note</Text>
</Page>
```

### Step-by-step:

**1. `PdfEngine.generate()` extracts the `<Page>` and resolves dimensions:**
   - A4 portrait + 40px padding → contentWidth=515.28, contentHeight=761.89

**2. `layoutEngine.paginate(children, dimensions)` is called with 4 children.**

**3. Measure all children:**
   - Box → 100px
   - Text → 450px (long paragraph)
   - Table → (measured as whole, but will use specialized path)
   - Text → 20px

**4. Bin-pack loop:**

| Iteration | Child | Height | Remaining | Action |
|---|---|---|---|---|
| 1 | Box (100px) | 100 | 761.89 | Fits → push, remaining=661.89 |
| 2 | Text (450px) | 450 | 661.89 | Fits → push, remaining=211.89 |
| 3 | Table | — | 211.89 | Specialized → paginateTable() |
| — | Segment 0 | 200 | 211.89 | Fits on current page |
| — | Segment 1 | 600 | — | Full intermediate page |
| — | Segment 2 | 180 | — | Last segment, new current page, remaining=581.89 |
| 4 | Text (20px) | 20 | 581.89 | Fits → push after table, remaining=561.89 |

**5. Result: 3 pages:**
   - Page 1: [Box, Text, TableSegment0]
   - Page 2: [TableSegment1]
   - Page 3: [TableSegment2, FooterText]

**6. Each page group is wrapped in a fresh `<div>` with padding and rendered via Satori → SVG → Resvg → PNG.**

**7. All PNGs are assembled into a single PDF via pdf-lib.**

---

## 9. Edge Cases & Safeguards

| Scenario | Handling |
|---|---|
| **Empty page** | Returns `[[]]` (one empty page group) |
| **Oversized atomic node** (taller than page) | Gets its own page; will be clipped by Satori at page height |
| **Text that can't be split** (no word boundary, empty text) | `splitTextNode` returns null → treated as atomic, moved to next page |
| **Table with 0 rows** | Produces one segment with just the header |
| **Single row taller than a page** | Row is placed on a new page (it overflows but is never split) |
| **Null/undefined children** | Filtered out before measurement |
| **Column widths that exceed container** | Flex columns get 0 width, clamped to `MIN_DIMENSION` (1px) |
| **Missing font** | `calculateTextMetrics` falls back to heuristic: `avgCharWidth ≈ fontSize × 0.55` |
| **`headerRepeat: false`** | Header only appears on the first segment; subsequent segments start directly with rows |

---

## 10. Glossary

| Term | Definition |
|---|---|
| **VNode** | A Preact Virtual DOM node — the `{ type, props, key }` object that JSX compiles to |
| **PageGroup** | `VNode[]` — the array of children destined for a single physical PDF page |
| **MeasuredNode** | A VNode paired with its measured pixel height: `{ node, height }` |
| **TableSegment** | A portion of a table (header flag + data rows + resolved widths) that fits on one page |
| **contentWidth / contentHeight** | The usable area inside a page after subtracting padding from all sides |
| **Bin-packing** | The strategy of filling a fixed-capacity container (page) with variable-sized items (children) |
| **Atomic node** | A node that cannot be split — it either fits on the current page or moves entirely to the next |
| **Splittable node** | A node (currently only Text) that can be divided at a page boundary |
| **Satori** | The library that converts JSX/VNodes into SVG using Yoga (flexbox) layout |
| **Resvg** | A Rust-based SVG renderer used to rasterize SVGs to PNGs and to measure bounding boxes |
| **pdf-lib** | A pure-JS library used to assemble PNG page images into a multi-page PDF document |
| **MIN_DIMENSION** | Constant value of 1 — the minimum allowed width/height to prevent division-by-zero and Resvg panics |
