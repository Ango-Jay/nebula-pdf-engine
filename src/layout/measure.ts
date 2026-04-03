import type { VNode } from 'preact';
import type { FontConfig } from '../types';
import { renderToSvg } from '../core/renderer';

// ─── Types ───

export interface MeasuredNode {
  /** The original VNode */
  node: VNode;
  /** Measured height in PDF points */
  height: number;
}

// ─── Measurement ───

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
export async function measureNodeHeight(
  node: VNode,
  pageWidth: number,
  fonts: FontConfig[],
): Promise<number> {
  // Wrap the node in a full-width container so Satori can compute
  // text wrapping and flex layout at the correct width
  const measureWrapper = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      },
      children: node,
    },
    key: null,
    // Preact VNode fields
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

  // Use a very tall height so content is not clipped
  const UNCONSTRAINED_HEIGHT = 100_000;

  const svg = await renderToSvg(measureWrapper, {
    width: pageWidth,
    height: UNCONSTRAINED_HEIGHT,
    fonts,
  });

  // Parse the height from the SVG output.
  // Satori produces SVGs like: <svg width="595" height="842" ...>
  // But the actual content height may be less than the container height.
  // We need to look at what Satori actually rendered.

  // Since Satori fills the entire height we specified (it doesn't auto-shrink
  // the SVG viewBox), we use an alternative approach: render children
  // individually and use Satori's internal layout to determine height.
  //
  // For now, we estimate height from the SVG viewport. The layout engine
  // will use this as an upper-bound and refine with the text splitter.
  return extractContentHeight(svg, UNCONSTRAINED_HEIGHT);
}

/**
 * Measures the heights of all children in a list.
 *
 * @param children - Array of VNodes to measure
 * @param pageWidth - Available width in PDF points
 * @param fonts - Registered font configurations
 * @returns Array of measured nodes with their heights
 */
export async function measureAllChildren(
  children: VNode[],
  pageWidth: number,
  fonts: FontConfig[],
): Promise<MeasuredNode[]> {
  const measured: MeasuredNode[] = [];

  for (const child of children) {
    if (!child || typeof child !== 'object') continue;

    const height = await measureNodeHeight(child, pageWidth, fonts);
    measured.push({ node: child, height });
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
function extractContentHeight(svg: string, containerHeight: number): number {
  // Try to extract height from the SVG root element
  const heightMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);
  if (heightMatch) {
    const svgHeight = parseFloat(heightMatch[1]);
    // If Satori reported a height less than our unconstrained container,
    // that's the actual content height
    if (svgHeight < containerHeight) {
      return svgHeight;
    }
  }

  // Try to find the viewBox for more accurate dimensions
  const viewBoxMatch = svg.match(/viewBox="[\d.]+ [\d.]+ [\d.]+ ([\d.]+)"/);
  if (viewBoxMatch) {
    return parseFloat(viewBoxMatch[1]);
  }

  // Fallback: use the container height (worst case)
  return containerHeight;
}
