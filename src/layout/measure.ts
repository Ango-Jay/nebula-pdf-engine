import type { VNode } from 'preact';
import type { FontConfig } from '../types';
import { renderToSvg } from '../core/renderer';
import { Resvg } from '@resvg/resvg-js';
import { h } from 'preact';
import { MIN_DIMENSION } from '../types';
import { validateAndSanitizeSvg } from '../utils/svg-validator';

// ─── Constants ───

const UNCONSTRAINED_HEIGHT = 5000;


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
  // Resvg getBBox only measures painted pixels (ignoring padding/margins).
  // We add a 1px colored marker above and below the node to force the bbox 
  // to encompass the entire CSS layout bounds.
  const marker = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: 1,
        flexShrink: 0,
        backgroundColor: '#000',
      }
    },
    key: null, __k: null, __: null, __b: 0, __e: null, __c: null, __v: 0, __i: 0, constructor: undefined, ref: null,
  } as any;

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
      children: [marker, node, marker],
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

  let svg = await renderToSvg(measureWrapper, {
    width: safeWidth,
    height: UNCONSTRAINED_HEIGHT,
    fonts,
  });

  // Sanitize and validate before passing to Resvg to prevent Rust panics
  svg = validateAndSanitizeSvg(svg, 'measurement (measureNodeHeight)');

  // Use Resvg to get the content's bounding box
  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: false },
  });

  const bbox = resvg.getBBox();
  
  // Subtract the 2px of markers to get the node's true layout height
  return bbox ? Math.max(0, bbox.height - 2) : 0;
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
  itemStyle?: any,
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

    // Cell style must perfectly match createRowVNode's cellStyle.
    const cellVNode = h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        padding: 5,
        ...itemStyle,
        ...(isHeader ? col.headerStyle : col.cellStyle),
        ...col.style, // Note: createRowVNode doesn't even have this, but keeping it for safety or remove it?
        textAlign: col.align || 'left',
        width: width, // Important: must be after user styles to force resolved width!
        wordBreak: 'break-word',
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

  // Add 1px for the row's borderBottomWidth (applied in createRowVNode)
  return maxHeight + 1;
}

