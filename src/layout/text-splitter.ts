import type { VNode } from "preact";
import type { FontConfig, TextProps } from "../types";

// ─── Types ───

export interface SplitResult {
  /** The portion that fits in the remaining space */
  fits: VNode;
  /** The overflow portion for the next page */
  overflow: VNode;
}

export interface TextMetrics {
  /** Average character width in PDF points at the given font size */
  averageCharacterWidth: number;
  /** Line height in PDF points */
  lineHeight: number;
  /** Estimated characters per line at the given container width */
  charsPerLine: number;
}

// ─── Font Metrics ───

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
export async function calculateTextMetrics(
  fontConfig: FontConfig,
  fontSize: number,
  containerWidth: number,
): Promise<TextMetrics> {
  try {
    // Dynamic import — fontkit is ESM-only in newer versions
    const fontkit = await import("fontkit");

    // Create a font instance from the buffer
    const fontBuffer =
      fontConfig.data instanceof ArrayBuffer
        ? Buffer.from(fontConfig.data)
        : fontConfig.data;

    const font = fontkit.create(fontBuffer as any);

    // Calculate the scale factor from font units to PDF points
    const unitsPerEm = (font as any).unitsPerEm ?? 1000;
    const scale = fontSize / unitsPerEm;

    // Sample common characters to get average width
    const sampleText =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ";
    const layout = (font as any).layout(sampleText);

    const totalAdvanceWidth = layout.glyphs.reduce(
      (sum: number, glyph: any) => sum + (glyph.advanceWidth ?? 0),
      0,
    );

    const averageCharacterWidth =
      (totalAdvanceWidth * scale) / sampleText.length;

    // Default line-height is typically 1.2x the font size
    const lineHeight = fontSize * 1.2;

    // Characters that fit on one line
    const charsPerLine = Math.floor(containerWidth / averageCharacterWidth);

    return {
      averageCharacterWidth,
      lineHeight,
      charsPerLine: Math.max(charsPerLine, 1),
    };
  } catch {
    // Fallback: use heuristic estimates
    // Average character width is roughly 0.5–0.6x the font size
    const averageCharacterWidth = fontSize * 0.55;
    const lineHeight = fontSize * 1.2;
    const charsPerLine = Math.max(
      Math.floor(containerWidth / averageCharacterWidth),
      1,
    );

    return { averageCharacterWidth, lineHeight, charsPerLine };
  }
}

// ─── Text Splitting ───

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
export async function splitTextNode(
  textNode: VNode,
  remainingHeight: number,
  fonts: FontConfig[],
  containerWidth: number,
): Promise<SplitResult | null> {
  const props = textNode.props as any;
  const textContent = extractTextContent(props.children);

  if (!textContent || textContent.length === 0) return null;

  // Resolve the font to use for this Text node
  const fontSize = props.style?.fontSize ?? 16; // Default Satori font size
  const fontFamily = props.style?.fontFamily ?? fonts[0]?.name;
  const customLineHeight = props.style?.lineHeight;

  // Find the matching font config
  const fontConfig = fonts.find((f) => f.name === fontFamily) ?? fonts[0];
  if (!fontConfig) return null;

  // Calculate text metrics using the font
  const metrics = await calculateTextMetrics(
    fontConfig,
    fontSize,
    containerWidth,
  );

  // Override line-height if explicitly set
  const effectiveLineHeight =
    typeof customLineHeight === "number"
      ? customLineHeight
      : metrics.lineHeight;

  // How many lines fit in the remaining space?
  const linesThatFit = Math.floor(remainingHeight / effectiveLineHeight);

  if (linesThatFit <= 0) {
    // Nothing fits — move the entire node to the next page
    return null;
  }

  // Estimate total lines in the text
  const totalLines = Math.ceil(textContent.length / metrics.charsPerLine);

  if (linesThatFit >= totalLines) {
    // Everything fits — no split needed (measurement was off)
    return null;
  }

  // Find the character index to split at
  // We split at word boundaries for cleaner text
  const roughSplitIndex = linesThatFit * metrics.charsPerLine;
  const splitIndex = findWordBoundary(textContent, roughSplitIndex);

  if (splitIndex <= 0 || splitIndex >= textContent.length) {
    // Can't meaningfully split — move to next page
    return null;
  }

  const fitsText = textContent.slice(0, splitIndex).trimEnd();
  const overflowText = textContent.slice(splitIndex).trimStart();

  if (!fitsText || !overflowText) return null;

  // Create two new Text VNodes with the same styles but split content
  const fitsNode = createTextVNode(props, fitsText);
  const overflowNode = createTextVNode(props, overflowText);

  return { fits: fitsNode, overflow: overflowNode };
}

// ─── Helpers ───

/**
 * Extracts plain text content from a Text node's children.
 * Handles strings, numbers, and arrays of mixed content.
 */
function extractTextContent(children: any): string {
  if (children === null || children === undefined) return "";

  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);

  if (Array.isArray(children)) {
    return children.map(extractTextContent).join("");
  }

  return "";
}

/**
 * Finds the nearest word boundary (space, newline) at or before the given index.
 * Falls back to the original index if no boundary is found.
 */
export function findWordBoundary(text: string, targetIndex: number): number {
  if (targetIndex >= text.length) return text.length;

  // Look backward for a space or newline
  for (let i = targetIndex; i >= targetIndex - 50 && i >= 0; i--) {
    const char = text[i];
    if (char === " " || char === "\n" || char === "\t") {
      return i + 1; // Split after the whitespace
    }
  }

  // No word boundary found nearby — just split at the target
  return targetIndex;
}

/**
 * Creates a new Text VNode with the same styles but different text content.
 */
function createTextVNode(originalProps: any, textContent: string): VNode {
  return {
    type: "span",
    props: {
      style: {
        display: "flex",
        ...originalProps.style,
      },
      children: textContent,
    },
    key: null,
    __k: null,
    __: null,
    __b: 0,
    __e: null,
    __c: null,
    __v: 0,
    __i: 0,
    constructor: undefined,
    ref: null,
  } as any as VNode;
}
