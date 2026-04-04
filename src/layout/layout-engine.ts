import type { VNode } from 'preact';
import type { FontConfig, ResolvedPageDimensions, TableProps, TableSegment } from '../types';
import { measureAllChildren, measureRow, type MeasuredNode } from './measure';
import { splitTextNode } from './text-splitter';
import { h } from 'preact';

// ─── Types ───

/** A group of VNodes that fit on a single page */
export type PageGroup = VNode[];

// ─── Layout Engine ───

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
export class LayoutEngine {
  private fonts: FontConfig[];

  constructor(fonts: FontConfig[]) {
    this.fonts = fonts;
  }

  /**
   * Distributes an array of child VNodes across pages.
   *
   * @param children - The children of a `<Page>` component
   * @param dimensions - Resolved page dimensions (width, height, padding)
   * @returns Array of page groups — each group is the children for one page
   */
  async paginate(
    children: VNode[],
    dimensions: ResolvedPageDimensions,
  ): Promise<PageGroup[]> {
    const { contentWidth, contentHeight } = dimensions;

    // Filter out null/undefined children
    const validChildren = children.filter(
      (child) => child !== null && child !== undefined && typeof child === 'object',
    );

    if (validChildren.length === 0) return [[]];

    // ─── 1. Measure all children ───
    const measured = await measureAllChildren(validChildren, contentWidth, this.fonts);

    // ─── 2. Bin-pack into pages ───
    const pages: PageGroup[] = [];
    let currentPage: VNode[] = [];
    let remainingHeight = contentHeight;

    for (const item of measured) {
      if (this.isTableNode(item.node)) {
        // Table Node — run specialized table pagination
        const tableSegments = await this.paginateTable(
          item.node as any,
          remainingHeight,
          contentHeight,
          contentWidth,
        );

        // Add segments to pages
        for (let i = 0; i < tableSegments.length; i++) {
          const segment = tableSegments[i];
          const segmentVNode = this.createTableSegmentVNode(item.node as any, segment);

          if (i === 0) {
            // First segment fits (partially) on the current page
            currentPage.push(segmentVNode);
            // We flush the current page immediately after a table segment if it triggers overflow
            if (tableSegments.length > 1) {
              pages.push(currentPage);
              currentPage = [];
              remainingHeight = contentHeight;
            }
          } else {
            // Subsequent segments get their own fresh pages
            if (i < tableSegments.length - 1) {
              pages.push([segmentVNode]);
            } else {
              // The last segment becomes the start of the new current page
              currentPage = [segmentVNode];
              remainingHeight = contentHeight; // Approximate (will be refined by next item)
            }
          }
        }
      } else if (item.height <= remainingHeight) {
        // Child fits on the current page
        currentPage.push(item.node);
        remainingHeight -= item.height;
      } else if (this.isSplittable(item.node)) {
        // Child overflows but is splittable (Text)
        const splitAttempt = await this.trySplit(
          item,
          remainingHeight,
          contentWidth,
          contentHeight,
        );

        if (splitAttempt) {
          const { fits, overflowPages } = splitAttempt;

          // Add the portion that fits to the current page
          if (fits) {
            currentPage.push(fits);
          }

          if (overflowPages.length > 0) {
            // Flush the current page and handle overflow
            pages.push(currentPage);

            // Add any complete overflow pages
            for (let i = 0; i < overflowPages.length - 1; i++) {
              pages.push(overflowPages[i]);
            }

            // The last overflow page becomes the new current page
            currentPage = overflowPages[overflowPages.length - 1];
            remainingHeight = contentHeight; // Start fresh on new page
          } else {
            // No overflow! The entire node fits after splitting/refining.
            // Just update remaining height (approximate, next measurement will be accurate)
            remainingHeight -= item.height; 
          }
        } else {
          // Split failed — treat as atomic and move to next page
          pages.push(currentPage);
          currentPage = [item.node];
          remainingHeight = contentHeight - item.height;
        }
      } else {
        // Atomic node — move entirely to the next page
        if (currentPage.length > 0) {
          pages.push(currentPage);
        }

        currentPage = [item.node];
        remainingHeight = contentHeight - item.height;

        // If the atomic node itself is taller than a full page,
        // just push it as its own page (it will be clipped/scaled later)
        if (remainingHeight < 0) {
          pages.push(currentPage);
          currentPage = [];
          remainingHeight = contentHeight;
        }
      }
    }

    // Flush any remaining children
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages.length > 0 ? pages : [[]];
  }

  /**
   * Orchestrates the pagination of a Table node.
   */
  private async paginateTable(
    tableNode: any,
    remainingHeight: number,
    pageHeight: number,
    containerWidth: number,
  ): Promise<TableSegment[]> {
    const { columns, data, options } = (tableNode.props as TableProps);
    const resolvedWidths = this.resolveColumnWidths(columns, containerWidth);

    // 1. Measure Header
    const headerHeight = await measureRow(null, columns, resolvedWidths, this.fonts, true);

    const segments: any[] = [];
    let currentRows: any[] = [];
    let currentHeight = remainingHeight;
    let isFirstSegment = true;

    for (let i = 0; i < data.length; i++) {
      const rowData = data[i];
      const rowHeight = await measureRow(rowData, columns, resolvedWidths, this.fonts, false);

      // Check if we need to start a new page
      // Subtract headerHeight because every NEW page MAY have a header
      const effectiveHeaderHeight = (isFirstSegment || options?.headerRepeat !== false) ? headerHeight : 0;
      const neededHeight = rowHeight + effectiveHeaderHeight;

      if (currentHeight < neededHeight && currentRows.length > 0) {
        // Start a new segment
        segments.push({ header: isFirstSegment || options?.headerRepeat !== false, rows: currentRows });
        currentRows = [rowData];
        currentHeight = pageHeight - effectiveHeaderHeight - rowHeight;
        isFirstSegment = false;
      } else {
        currentRows.push(rowData);
        currentHeight -= rowHeight;
        if (currentRows.length === 1 && (isFirstSegment || options?.headerRepeat !== false)) {
            currentHeight -= headerHeight; // Account for header on this page
        }
      }
    }

    // Always push at least one segment even if data is empty (to show header)
    if (currentRows.length > 0 || segments.length === 0) {
      segments.push({ header: true, rows: currentRows });
    }

    return segments;
  }

  /**
   * Resolves column definitions into absolute pixel widths.
   */
  private resolveColumnWidths(columns: any[], containerWidth: number): number[] {
    const widths = new Array(columns.length).fill(0);
    let remainingWidth = containerWidth;
    let totalFlex = 0;

    // 1. First pass: Fixed widths (px and %)
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (typeof col.width === 'number') {
        widths[i] = col.width;
        remainingWidth -= col.width;
      } else if (typeof col.width === 'string' && col.width.endsWith('%')) {
        const percent = parseFloat(col.width) / 100;
        widths[i] = containerWidth * percent;
        remainingWidth -= widths[i];
      } else if (col.flex) {
        totalFlex += col.flex;
      } else {
        // Default flex: 1 if nothing else is specified
        totalFlex += 1;
      }
    }

    // 2. Second pass: Distribute remaining width to flex columns
    if (totalFlex > 0) {
      const flexUnit = Math.max(0, remainingWidth) / totalFlex;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (!widths[i]) {
          const flex = col.flex || 1;
          widths[i] = flex * flexUnit;
        }
      }
    }

    return widths;
  }

  /**
   * Converts a TableSegment into a VNode tree (Box/Text) for rendering.
   */
  private createTableSegmentVNode(tableNode: any, segment: any): VNode {
    const { columns, options, headerStyle, rowStyle, style } = tableNode.props;
    
    // We use the absolute widths for the final render to match Satori's layout
    // We'll need to pass the actual container width here. 
    // For now, let's assume it's the full content width from the node if possible, 
    // but the safest is to pass it from paginate. 
    // Since we don't have it easily here without changing the signature, 
    // we'll recalculate based on 100% or use a large enough number.
    // Better: let's change createTableSegmentVNode signature or internal logic.
    
    const rows: VNode[] = [];

    // Add Header
    if (segment.header) {
      rows.push(this.createRowVNode(columns, null, headerStyle, true));
    }

    // Add Data Rows
    segment.rows.forEach((rowData: any, idx: number) => {
      let finalRowStyle = { ...rowStyle };
      if (options?.stripe && idx % 2 === 1) {
        finalRowStyle.backgroundColor = options.stripeColor || '#f9f9f9';
      }
      rows.push(this.createRowVNode(columns, rowData, finalRowStyle, false));
    });

    return h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        ...style,
      }
    } as any, rows) as any;
  }

  private createRowVNode(
    columns: any[],
    rowData: any,
    rowStyle: any,
    isHeader: boolean
  ): VNode {
    const cells = columns.map((col, i) => {
      const content = isHeader ? col.header : rowData[col.key];
      const cellStyle: any = {
        display: 'flex',
        padding: 5,
        ...col.style,
        textAlign: col.align || 'left',
      };

      // Set width or flex
      if (typeof col.width === 'number') {
        cellStyle.width = col.width;
      } else if (typeof col.width === 'string') {
        cellStyle.width = col.width;
      } else {
        cellStyle.flex = col.flex || 1;
      }

      return h('div', { style: cellStyle }, 
        h('span', null, String(content ?? ''))
      );
    });

    return h('div', {
      style: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        borderBottomStyle: 'solid',
        ...rowStyle,
      }
    } as any, cells) as any;
  }

  private isTableNode(node: VNode): boolean {
    return (node.type as any)?.displayName === 'NebulaPdfTable' || node.type === 'table-internal';
  }

  /**
   * Checks if a VNode can be split across pages.
   *
   * Currently, only `<Text>` nodes are splittable.
   * In the future, `<Box>` with only Text children could be recursive.
   */
  private isSplittable(node: VNode): boolean {
    const nodeType = node.type as any;

    if (typeof nodeType === 'function' && nodeType.displayName === 'NebulaPdfText') {
      return true;
    }

    // Also handle raw <span> elements with text children
    // (these may be produced by the text splitter itself)
    if (nodeType === 'span' && typeof (node.props as any)?.children === 'string') {
      return true;
    }

    return false;
  }

  /**
   * Attempts to split a measured node at the page boundary.
   *
   * If the text is too long to fit on multiple pages, this will
   * recursively split into multiple overflow chunks.
   */
  private async trySplit(
    item: MeasuredNode,
    remainingHeight: number,
    contentWidth: number,
    pageHeight: number,
  ): Promise<{ fits: VNode | null; overflowPages: PageGroup[] } | null> {
    const splitResult = await splitTextNode(
      item.node,
      remainingHeight,
      this.fonts,
      contentWidth,
    );

    if (!splitResult) return null;

    const overflowPages: PageGroup[] = [];

    // Check if the overflow portion itself needs further splitting
    // (for very long text that spans 3+ pages)
    let currentOverflow = splitResult.overflow;
    let overflowHeight = item.height - remainingHeight; // Rough estimate

    while (overflowHeight > pageHeight) {
      const furtherSplit = await splitTextNode(
        currentOverflow,
        pageHeight,
        this.fonts,
        contentWidth,
      );

      if (!furtherSplit) {
        // Can't split further — push as a single page
        overflowPages.push([currentOverflow]);
        currentOverflow = null as any;
        break;
      }

      overflowPages.push([furtherSplit.fits]);
      currentOverflow = furtherSplit.overflow;
      overflowHeight -= pageHeight;
    }

    // Push the final overflow portion
    if (currentOverflow) {
      overflowPages.push([currentOverflow]);
    }

    return {
      fits: splitResult.fits,
      overflowPages,
    };
  }
}
