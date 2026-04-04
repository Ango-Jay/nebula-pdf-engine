import type { VNode } from 'preact';
import type { FontConfig } from '../types';
import { renderToSvg } from '../core/renderer';
import { Resvg } from '@resvg/resvg-js';

// ─── Types ───

export interface MeasuredNode {
  /** The original VNode */
  node: VNode;
  /** Measured height in PDF points */
  height: number;
}

// ─── Measurement ───

/**
 * Measures the rendered height of a single VNode using Satori and Resvg.
 *
 * Strategy:
 * 1. Render the node to SVG using Satori with an unconstrained height.
 * 2. Use Resvg's `getBBox()` to calculate the exact bounding box of the
 *    rendered content.
 *
 * This approach guarantees our measurements match exactly what will
 * eventually be rendered.
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

  // Use a very tall height so content is not clipped by Satori
  const UNCONSTRAINED_HEIGHT = 100_000;

  const svg = await renderToSvg(measureWrapper, {
    width: pageWidth,
    height: UNCONSTRAINED_HEIGHT,
    fonts,
  });

  // Use Resvg to get the content's bounding box
  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: false },
  });

  const bbox = resvg.getBBox();
  
  // Return the content height. If for some reason the BBox fails (empty SVG), 
  // return 0 so it doesn't trigger unnecessary page breaks.
  return bbox?.height ?? 0;
}

/**
 * Measures the heights of all children in a list.
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

