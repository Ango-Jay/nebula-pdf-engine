import { jsx } from "preact/jsx-runtime";
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
//#endregion
export { Box, Image, PAGE_SIZES, Page, Text };

//# sourceMappingURL=index.mjs.map