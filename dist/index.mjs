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
//#region src/layout/measure.ts
/**
* Measures the rendered height of a single VNode using Satori.
*
* Strategy: We render the node inside a flex container with the target
* page width and an extremely tall height (effectively unconstrained).
* Satori will produce an SVG whose content only occupies as much
* vertical space as needed. We then parse the SVG to extract the
* actual content height.
*
* This is a "render to measure" approach — slightly more expensive than
* a pure Yoga layout pass, but it guarantees our measurements match
* exactly what Satori will render (no drift between measurement and
* final output).
*
* @param node - The VNode to measure
* @param pageWidth - Available width in PDF points
* @param fonts - Registered font configurations
* @returns The rendered height in PDF points
*/
async function measureNodeHeight(node, pageWidth, fonts) {
	const measureWrapper = {
		type: "div",
		props: {
			style: {
				display: "flex",
				flexDirection: "column",
				width: "100%"
			},
			children: node
		},
		key: null,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		__v: 0,
		__i: 0,
		constructor: void 0,
		ref: null
	};
	const UNCONSTRAINED_HEIGHT = 1e5;
	return extractContentHeight(await renderToSvg(measureWrapper, {
		width: pageWidth,
		height: UNCONSTRAINED_HEIGHT,
		fonts
	}), UNCONSTRAINED_HEIGHT);
}
/**
* Measures the heights of all children in a list.
*
* @param children - Array of VNodes to measure
* @param pageWidth - Available width in PDF points
* @param fonts - Registered font configurations
* @returns Array of measured nodes with their heights
*/
async function measureAllChildren(children, pageWidth, fonts) {
	const measured = [];
	for (const child of children) {
		if (!child || typeof child !== "object") continue;
		const height = await measureNodeHeight(child, pageWidth, fonts);
		measured.push({
			node: child,
			height
		});
	}
	return measured;
}
/**
* Extracts the content height from a rendered SVG string.
*
* Satori sets the SVG dimensions to the container size we provided,
* but the actual content may be smaller. This function attempts to
* determine the true content height by examining the SVG structure.
*/
function extractContentHeight(svg, containerHeight) {
	const heightMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);
	if (heightMatch) {
		const svgHeight = parseFloat(heightMatch[1]);
		if (svgHeight < containerHeight) return svgHeight;
	}
	const viewBoxMatch = svg.match(/viewBox="[\d.]+ [\d.]+ [\d.]+ ([\d.]+)"/);
	if (viewBoxMatch) return parseFloat(viewBoxMatch[1]);
	return containerHeight;
}
//#endregion
//#region src/layout/text-splitter.ts
/**
* Calculates text metrics for a given font at a specific size.
*
* Uses fontkit to analyze the font buffer and compute accurate
* character widths. Falls back to heuristic estimates if fontkit
* analysis fails.
*
* @param fontConfig - The font configuration (with buffer)
* @param fontSize - Target font size in PDF points
* @param containerWidth - Available width in PDF points
* @returns Computed text metrics
*/
async function calculateTextMetrics(fontConfig, fontSize, containerWidth) {
	try {
		const fontkit = await import("fontkit");
		const fontBuffer = fontConfig.data instanceof ArrayBuffer ? Buffer.from(fontConfig.data) : fontConfig.data;
		const font = fontkit.create(fontBuffer);
		const scale = fontSize / (font.unitsPerEm ?? 1e3);
		const averageCharacterWidth = font.layout("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ").glyphs.reduce((sum, glyph) => sum + (glyph.advanceWidth ?? 0), 0) * scale / 63;
		const lineHeight = fontSize * 1.2;
		const charsPerLine = Math.floor(containerWidth / averageCharacterWidth);
		return {
			averageCharacterWidth,
			lineHeight,
			charsPerLine: Math.max(charsPerLine, 1)
		};
	} catch {
		const averageCharacterWidth = fontSize * .55;
		return {
			averageCharacterWidth,
			lineHeight: fontSize * 1.2,
			charsPerLine: Math.max(Math.floor(containerWidth / averageCharacterWidth), 1)
		};
	}
}
/**
* Splits a `<Text>` VNode at a page boundary.
*
* Given a Text node whose content overflows the remaining page space,
* this function estimates how many lines fit and splits the text
* string at that boundary.
*
* @param textNode - The Text VNode to split
* @param remainingHeight - Available vertical space in PDF points on the current page
* @param fonts - Registered font configurations
* @param containerWidth - Available content width in PDF points
* @returns A SplitResult with the "fits" and "overflow" portions, or null if can't split
*/
async function splitTextNode(textNode, remainingHeight, fonts, containerWidth) {
	const props = textNode.props;
	const textContent = extractTextContent(props.children);
	if (!textContent || textContent.length === 0) return null;
	const fontSize = props.style?.fontSize ?? 16;
	const fontFamily = props.style?.fontFamily ?? fonts[0]?.name;
	const customLineHeight = props.style?.lineHeight;
	const fontConfig = fonts.find((f) => f.name === fontFamily) ?? fonts[0];
	if (!fontConfig) return null;
	const metrics = await calculateTextMetrics(fontConfig, fontSize, containerWidth);
	const effectiveLineHeight = typeof customLineHeight === "number" ? customLineHeight : metrics.lineHeight;
	const linesThatFit = Math.floor(remainingHeight / effectiveLineHeight);
	if (linesThatFit <= 0) return null;
	if (linesThatFit >= Math.ceil(textContent.length / metrics.charsPerLine)) return null;
	const splitIndex = findWordBoundary(textContent, linesThatFit * metrics.charsPerLine);
	if (splitIndex <= 0 || splitIndex >= textContent.length) return null;
	const fitsText = textContent.slice(0, splitIndex).trimEnd();
	const overflowText = textContent.slice(splitIndex).trimStart();
	if (!fitsText || !overflowText) return null;
	return {
		fits: createTextVNode(props, fitsText),
		overflow: createTextVNode(props, overflowText)
	};
}
/**
* Extracts plain text content from a Text node's children.
* Handles strings, numbers, and arrays of mixed content.
*/
function extractTextContent(children) {
	if (children === null || children === void 0) return "";
	if (typeof children === "string") return children;
	if (typeof children === "number") return String(children);
	if (Array.isArray(children)) return children.map(extractTextContent).join("");
	return "";
}
/**
* Finds the nearest word boundary (space, newline) at or before the given index.
* Falls back to the original index if no boundary is found.
*/
function findWordBoundary(text, targetIndex) {
	if (targetIndex >= text.length) return text.length;
	for (let i = targetIndex; i >= targetIndex - 50 && i >= 0; i--) {
		const char = text[i];
		if (char === " " || char === "\n" || char === "	") return i + 1;
	}
	return targetIndex;
}
/**
* Creates a new Text VNode with the same styles but different text content.
*/
function createTextVNode(originalProps, textContent) {
	return {
		type: "span",
		props: {
			style: {
				display: "flex",
				...originalProps.style
			},
			children: textContent
		},
		key: null,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		__v: 0,
		__i: 0,
		constructor: void 0,
		ref: null
	};
}
//#endregion
//#region src/layout/layout-engine.ts
/**
* The Layout Engine distributes child VNodes across multiple pages.
*
* It implements a bin-packing algorithm:
* 1. Measure each child's rendered height
* 2. Walk children, accumulating height per page
* 3. When a child overflows:
*    - **Atomic nodes** (Image, Box) → move entirely to next page
*    - **Splittable nodes** (Text) → split at the boundary
* 4. Return children grouped by page
*/
var LayoutEngine = class {
	constructor(fonts) {
		this.fonts = fonts;
	}
	/**
	* Distributes an array of child VNodes across pages.
	*
	* @param children - The children of a `<Page>` component
	* @param dimensions - Resolved page dimensions (width, height, padding)
	* @returns Array of page groups — each group is the children for one page
	*/
	async paginate(children, dimensions) {
		const { contentWidth, contentHeight } = dimensions;
		const validChildren = children.filter((child) => child !== null && child !== void 0 && typeof child === "object");
		if (validChildren.length === 0) return [[]];
		const measured = await measureAllChildren(validChildren, contentWidth, this.fonts);
		const pages = [];
		let currentPage = [];
		let remainingHeight = contentHeight;
		for (const item of measured) if (item.height <= remainingHeight) {
			currentPage.push(item.node);
			remainingHeight -= item.height;
		} else if (this.isSplittable(item.node)) {
			const splitAttempt = await this.trySplit(item, remainingHeight, contentWidth, contentHeight);
			if (splitAttempt) {
				const { fits, overflowPages } = splitAttempt;
				if (fits) currentPage.push(fits);
				pages.push(currentPage);
				for (let i = 0; i < overflowPages.length - 1; i++) pages.push(overflowPages[i]);
				if (overflowPages.length > 0) {
					currentPage = overflowPages[overflowPages.length - 1];
					remainingHeight = contentHeight;
				} else {
					currentPage = [];
					remainingHeight = contentHeight;
				}
			} else {
				pages.push(currentPage);
				currentPage = [item.node];
				remainingHeight = contentHeight - item.height;
			}
		} else {
			if (currentPage.length > 0) pages.push(currentPage);
			currentPage = [item.node];
			remainingHeight = contentHeight - item.height;
			if (remainingHeight < 0) {
				pages.push(currentPage);
				currentPage = [];
				remainingHeight = contentHeight;
			}
		}
		if (currentPage.length > 0) pages.push(currentPage);
		return pages.length > 0 ? pages : [[]];
	}
	/**
	* Checks if a VNode can be split across pages.
	*
	* Currently, only `<Text>` nodes are splittable.
	* In the future, `<Box>` with only Text children could be recursive.
	*/
	isSplittable(node) {
		const nodeType = node.type;
		if (typeof nodeType === "function" && nodeType.displayName === "NebulaPdfText") return true;
		if (nodeType === "span" && typeof node.props?.children === "string") return true;
		return false;
	}
	/**
	* Attempts to split a measured node at the page boundary.
	*
	* If the text is too long to fit on multiple pages, this will
	* recursively split into multiple overflow chunks.
	*/
	async trySplit(item, remainingHeight, contentWidth, pageHeight) {
		const splitResult = await splitTextNode(item.node, remainingHeight, this.fonts, contentWidth);
		if (!splitResult) return null;
		const overflowPages = [];
		let currentOverflow = splitResult.overflow;
		let overflowHeight = item.height - remainingHeight;
		while (overflowHeight > pageHeight) {
			const furtherSplit = await splitTextNode(currentOverflow, pageHeight, this.fonts, contentWidth);
			if (!furtherSplit) {
				overflowPages.push([currentOverflow]);
				currentOverflow = null;
				break;
			}
			overflowPages.push([furtherSplit.fits]);
			currentOverflow = furtherSplit.overflow;
			overflowHeight -= pageHeight;
		}
		if (currentOverflow) overflowPages.push([currentOverflow]);
		return {
			fits: splitResult.fits,
			overflowPages
		};
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
		const inputPageElements = this.extractPages(element);
		if (inputPageElements.length === 0) throw new Error("[nebula-pdf-engine] No <Page> components found in the element tree. Wrap your content in a <Page> component.");
		await this.resolveImages(element);
		const pageBuffers = [];
		const layoutEngine = new LayoutEngine(this.fonts);
		for (const inputPage of inputPageElements) {
			const { size, orientation, padding } = this.extractPageProps(inputPage);
			const dimensions = resolvePageDimensions(size, orientation, padding);
			const inputChildren = this.extractChildren(inputPage);
			const synthesizedPages = await layoutEngine.paginate(inputChildren, dimensions);
			for (const children of synthesizedPages) {
				const pngBuffer = await renderToImage({
					type: "div",
					props: {
						style: {
							display: "flex",
							flexDirection: "column",
							width: "100%",
							height: "100%",
							backgroundColor: "#fff"
						},
						children
					},
					key: null,
					__k: null,
					__: null,
					__b: 0,
					__e: null,
					__c: null,
					__v: 0,
					__i: 0,
					constructor: void 0,
					ref: null
				}, {
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
		}
		const pdfBytes = await assemblePdf(pageBuffers, {
			title: options.title,
			author: options.author,
			subject: options.subject
		});
		return Buffer.from(pdfBytes);
	}
	/**
	* Extracts children from a VNode (handles arrays, single nodes, fragments).
	*/
	extractChildren(element) {
		const children = element.props?.children;
		if (!children) return [];
		if (Array.isArray(children)) return children.filter((c) => !!c);
		return [children];
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