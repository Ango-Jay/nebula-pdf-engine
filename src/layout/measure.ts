import type { VNode } from 'preact';
import type { FontConfig } from '../types';
import { renderToSvg } from '../core/renderer';
import { Resvg } from '@resvg/resvg-js';
import { h } from 'preact';
import { MIN_DIMENSION } from '../types';

// ─── Constants ───

const UNCONSTRAINED_HEIGHT = 100_000;


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

  const safeWidth = (isNaN(pageWidth) || pageWidth < MIN_DIMENSION) ? MIN_DIMENSION : pageWidth;

  const svg = await renderToSvg(measureWrapper, {
    width: safeWidth,
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

/**
 * Measures the height of a table row by measuring each cell 
 * within its resolved column width and taking the maximum.
 */
export async function measureRow(
  rowData: any,
  columns: any[],
  resolvedWidths: number[],
  fonts: FontConfig[],
  isHeader: boolean = false,
): Promise<number> {
  let maxHeight = 0;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const width = resolvedWidths[i];
    const content = isHeader ? col.header : rowData[col.key];

    if (content === undefined || content === null) continue;

    // Build a temporary cell VNode for measurement using h() for stability
    const contentStr = (content === undefined || content === null || String(content) === '') 
        ? '\u00A0' 
        : String(content);

    const cellVNode = h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        ...(isHeader ? col.headerStyle : col.cellStyle),
        ...col.style, // Keep for backward compatibility if any
      }
    }, h('div', {
        style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            wordBreak: 'break-word',
        }
    }, contentStr));

    const cellHeight = await measureNodeHeight(cellVNode as any, width, fonts);
    maxHeight = Math.max(maxHeight, cellHeight);
  }

  return maxHeight;
}

