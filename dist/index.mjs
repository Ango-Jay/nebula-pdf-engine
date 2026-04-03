import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { jsx } from "preact/jsx-runtime";
//#region src/types/index.ts
const PAGE_SIZES = {
	A4: {
		width: 595.28,
		height: 841.89
	},
	LETTER: {
		width: 612,
		height: 792
	},
	LEGAL: {
		width: 612,
		height: 1008
	}
};
/**
* Normalizes a padding value into a full PaddingObject.
* - `number` → uniform on all sides
* - `Partial<PaddingObject>` → missing sides default to 0
*/
function normalizePadding(padding) {
	if (padding === void 0) return {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	};
	if (typeof padding === "number") return {
		top: padding,
		right: padding,
		bottom: padding,
		left: padding
	};
	return {
		top: padding.top ?? 0,
		right: padding.right ?? 0,
		bottom: padding.bottom ?? 0,
		left: padding.left ?? 0
	};
}
/**
* Resolves the final page dimensions based on size, orientation, and padding.
*/
function resolvePageDimensions(size = "A4", orientation = "portrait", padding) {
	const base = PAGE_SIZES[size];
	const normalizedPadding = normalizePadding(padding);
	const width = orientation === "portrait" ? base.width : base.height;
	const height = orientation === "portrait" ? base.height : base.width;
	return {
		width,
		height,
		padding: normalizedPadding,
		contentWidth: width - normalizedPadding.left - normalizedPadding.right,
		contentHeight: height - normalizedPadding.top - normalizedPadding.bottom
	};
}
//#endregion
//#region src/core/renderer.ts
/**
* Renders a Preact VNode tree into an SVG string using Satori.
*
* Satori uses Yoga layout internally, so you get full flexbox support.
* The output is a complete SVG document with inlined styles —
* no external CSS dependencies.
*
* @param element - The JSX element tree to render
* @param options - Page dimensions and font configuration
* @returns SVG markup as a string
*/
async function renderToSvg(element, options) {
	const satorifonts = options.fonts.map((font) => ({
		name: font.name,
		data: font.data,
		weight: font.weight,
		style: font.style
	}));
	return await satori(element, {
		width: options.width,
		height: options.height,
		fonts: satorifonts
	});
}
/**
* Converts an SVG string into a PNG buffer using Resvg (Rust-based).
*
* Resvg is significantly faster than alternatives like puppeteer or
* canvas-based renderers because it's compiled to native code via NAPI.
*
* @param svgString - Complete SVG markup
* @returns PNG image as a Buffer
*/
function renderToPng(svgString) {
	return new Resvg(svgString, {
		font: { loadSystemFonts: false },
		fitTo: { mode: "original" }
	}).render().asPng();
}
/**
* Renders a Preact VNode directly to a PNG buffer.
* Combines `renderToSvg` and `renderToPng` in a single call.
*
* @param element - The JSX element tree
* @param options - Page dimensions and font configuration
* @returns PNG image as a Buffer
*/
async function renderToImage(element, options) {
	return renderToPng(await renderToSvg(element, options));
}
//#endregion
//#region src/core/assembler.ts
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
async function assemblePdf(pages, options = {}) {
	if (pages.length === 0) throw new Error("[nebula-pdf-engine] Cannot assemble a PDF with zero pages.");
	const pdfDocument = await PDFDocument.create();
	pdfDocument.setProducer("nebula-pdf-engine");
	pdfDocument.setCreationDate(/* @__PURE__ */ new Date());
	if (options.title) pdfDocument.setTitle(options.title);
	if (options.author) pdfDocument.setAuthor(options.author);
	if (options.subject) pdfDocument.setSubject(options.subject);
	for (const page of pages) {
		const pngImage = await pdfDocument.embedPng(page.pngBuffer);
		pdfDocument.addPage([page.width, page.height]).drawImage(pngImage, {
			x: 0,
			y: 0,
			width: page.width,
			height: page.height
		});
	}
	return pdfDocument.save();
}
//#endregion
//#region src/utils/asset-resolver.ts
var AssetResolver = class {
	constructor() {
		this.cache = /* @__PURE__ */ new Map();
	}
	async resolveImage(src) {
		if (this.cache.has(src)) return this.cache.get(src);
		let buffer;
		if (src.startsWith("http")) {
			const response = await fetch(src);
			buffer = Buffer.from(await response.arrayBuffer());
		} else {
			const absolutePath = path.isAbsolute(src) ? src : path.join(process.cwd(), src);
			buffer = await fs.readFile(absolutePath);
		}
		const base64 = `data:image/png;base64,${(await sharp(buffer).png().toBuffer()).toString("base64")}`;
		this.cache.set(src, base64);
		return base64;
	}
};
//#endregion
//#region src/core/engine.ts
/**
* The main entry point for generating PDFs from JSX templates.
*
* Usage:
* ```ts
* import { PdfEngine, Page, Text } from 'nebula-pdf-engine';
*
* const engine = new PdfEngine({
*   fonts: [{ name: 'Inter', data: fontBuffer, weight: 400 }],
* });
*
* const pdfBytes = await engine.generate(
*   <Page size="A4">
*     <Text style={{ fontSize: 24 }}>Hello, World!</Text>
*   </Page>
* );
* ```
*/
var PdfEngine = class {
	constructor(config) {
		if (!config.fonts || config.fonts.length === 0) throw new Error("[nebula-pdf-engine] At least one font must be provided in the engine config.");
		this.fonts = config.fonts;
		this.assetResolver = new AssetResolver();
	}
	/**
	* Generates a PDF from a JSX element tree.
	*
	* The element should be a `<Page>` component (or multiple pages
	* wrapped in a fragment). Each `<Page>` becomes a separate page
	* in the output PDF.
	*
	* @param element - The root JSX element (typically a `<Page>`)
	* @param options - Optional PDF metadata (title, author, etc.)
	* @returns The PDF file as a Buffer
	*/
	async generate(element, options = {}) {
		const pageElements = this.extractPages(element);
		if (pageElements.length === 0) throw new Error("[nebula-pdf-engine] No <Page> components found in the element tree. Wrap your content in a <Page> component.");
		await this.resolveImages(element);
		const pageBuffers = [];
		for (const pageElement of pageElements) {
			const { size, orientation, padding } = this.extractPageProps(pageElement);
			const dimensions = resolvePageDimensions(size, orientation, padding);
			const pngBuffer = await renderToImage(pageElement, {
				width: dimensions.width,
				height: dimensions.height,
				fonts: this.fonts
			});
			pageBuffers.push({
				pngBuffer,
				width: dimensions.width,
				height: dimensions.height
			});
		}
		const pdfBytes = await assemblePdf(pageBuffers, {
			title: options.title,
			author: options.author,
			subject: options.subject
		});
		return Buffer.from(pdfBytes);
	}
	/**
	* Extracts `<Page>` components from the element tree.
	*
	* Supports three patterns:
	* 1. A single `<Page>` as the root element
	* 2. Multiple `<Page>` components inside a fragment
	* 3. Multiple `<Page>` components inside a wrapper `<div>`
	*/
	extractPages(element) {
		if (this.isPageElement(element)) return [element];
		const children = element.props?.children;
		if (!children) return [];
		if (Array.isArray(children)) return children.filter((child) => this.isPageElement(child));
		if (this.isPageElement(children)) return [children];
		return [];
	}
	/**
	* Checks whether a VNode represents a `<Page>` component.
	*/
	isPageElement(node) {
		if (!node || typeof node !== "object") return false;
		const nodeType = node.type;
		if (typeof nodeType === "function" && nodeType.displayName === "NebulaPdfPage") return true;
		return false;
	}
	/**
	* Extracts page configuration props from a `<Page>` VNode.
	*/
	extractPageProps(pageElement) {
		const props = pageElement.props || {};
		return {
			size: props.size ?? "A4",
			orientation: props.orientation ?? "portrait",
			padding: props.padding
		};
	}
	/**
	* Walks the VNode tree and resolves all image sources to base64 data URIs.
	*
	* This mutates the tree in-place — replacing `src` props on `<Image>`
	* components with their resolved base64 values.
	*/
	async resolveImages(element) {
		if (!element || typeof element !== "object") return;
		const nodeType = element.type;
		if (typeof nodeType === "function" && nodeType.displayName === "NebulaPdfImage") {
			const props = element.props;
			const src = props?.src;
			if (src && typeof src === "string" && !src.startsWith("data:")) props.src = await this.assetResolver.resolveImage(src);
		}
		const children = element.props?.children;
		if (Array.isArray(children)) {
			for (const child of children) if (child && typeof child === "object") await this.resolveImages(child);
		} else if (children && typeof children === "object") await this.resolveImages(children);
	}
};
//#endregion
//#region src/components/primitives.tsx
/**
* Defines a single PDF page. Acts as the top-level container
* that the layout engine uses to determine dimensions and breaks.
*
* Usage:
* ```tsx
* <Page size="A4" orientation="portrait" padding={40}>
*   <Box>...</Box>
* </Page>
* ```
*
* Note: `size`, `orientation`, and `padding` are consumed by the engine
* during the layout prepass — they are NOT passed through to Satori's
* rendered output. The Page component renders its children inside a
* full-page flex container.
*/
function Page({ children, size, orientation, padding }) {
	return /* @__PURE__ */ jsx("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			width: "100%",
			height: "100%"
		},
		"data-page-size": size ?? "A4",
		"data-page-orientation": orientation ?? "portrait",
		"data-page-padding": typeof padding === "number" ? String(padding) : JSON.stringify(padding ?? 0),
		children
	});
}
Page.displayName = "NebulaPdfPage";
/**
* A generic flex container. The primary building block for layouts.
*
* Usage:
* ```tsx
* <Box style={{ flexDirection: 'row', gap: 10 }}>
*   <Text>Hello</Text>
*   <Text>World</Text>
* </Box>
* ```
*/
function Box({ style, children }) {
	return /* @__PURE__ */ jsx("div", {
		style: {
			display: "flex",
			...style
		},
		children
	});
}
Box.displayName = "NebulaPdfBox";
/**
* Renders text content. Supports Satori's text styling properties.
*
* Usage:
* ```tsx
* <Text style={{ fontSize: 16, color: '#333' }}>
*   Hello, World!
* </Text>
* ```
*
* The layout engine may split this component across pages
* if the text overflows the available space.
*/
function Text({ style, children }) {
	return /* @__PURE__ */ jsx("span", {
		style: {
			display: "flex",
			...style
		},
		children
	});
}
Text.displayName = "NebulaPdfText";
/**
* Displays an image inside the PDF. Sources can be URLs, absolute paths,
* or paths relative to `process.cwd()`.
*
* The engine's AssetResolver will fetch and convert the image to a
* base64 PNG data URI before passing it to Satori.
*
* Usage:
* ```tsx
* <Image src="/assets/logo.png" width={200} height={100} />
* ```
*
* Note: `width` and `height` are required so the engine can:
* 1. Downsample the image to the correct size (reducing PDF weight)
* 2. Reserve space during the layout prepass
*/
function Image({ src, width, height, style, alt }) {
	return /* @__PURE__ */ jsx("img", {
		src,
		width,
		height,
		style: {
			objectFit: "contain",
			...style
		}
	});
}
Image.displayName = "NebulaPdfImage";
//#endregion
export { Box, Image, PAGE_SIZES, Page, PdfEngine, Text };

//# sourceMappingURL=index.mjs.map