import type { VNode } from 'preact';
import type { FontConfig, ResolvedPageDimensions, TableProps, TableSegment, TableNode } from '../types';
import { MIN_DIMENSION } from '../types';
import { measureAllChildren, measureRow, type MeasuredNode } from './measure';
import { splitTextNode } from './text-splitter';
import { resolveColumnCellStyle } from './column-styles';
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
        const tableNode = item.node as any;
        const { columns, headerStyle } = tableNode.props;
        const resolvedWidths = this.resolveColumnWidths(columns, contentWidth);
        const headerHeight = await measureRow(null, columns, resolvedWidths, this.fonts, true, headerStyle);

        // Table Node — run specialized table pagination
        const tableSegments = await this.paginateTable(
          tableNode,
          contentHeight,
          remainingHeight,
          headerHeight,
          contentWidth,
        );

        // Add segments to pages
        for (let i = 0; i < tableSegments.length; i++) {
          const segment = tableSegments[i];
          const segmentVNode = this.createTableSegmentVNode(item.node as any, segment);
          const segmentHeight = await this.measureTableSegment(item.node as any, segment);

          if (i === 0) {
            // First segment fits (partially) on the current page
            currentPage.push(segmentVNode);
            
            if (tableSegments.length > 1) {
              // We have more segments, flush this page
              pages.push(currentPage);
              currentPage = [];
              remainingHeight = contentHeight;
            } else {
              // Only one segment — subtract its height
              remainingHeight -= segmentHeight;
            }
          } else {
            // Subsequent segments get their own fresh pages
            if (i < tableSegments.length - 1) {
              // Full intermediate pages
              pages.push([segmentVNode]);
            } else {
              // The last segment becomes the start of the new current page
              currentPage = [segmentVNode];
              remainingHeight = contentHeight - segmentHeight;
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
    tableNode: TableNode<any>,
    pageHeight: number,
    remainingHeight: number,
    headerHeight: number,
    contentWidth: number,
  ): Promise<TableSegment[]> {
    const { data, columns, options, headerStyle, rowStyle } = tableNode.props;
    const resolvedWidths = this.resolveColumnWidths(columns, contentWidth);

    const segments: TableSegment[] = [];
    let currentRows: any[] = [];
    let currentHeight = remainingHeight;
    let isFirstSegment = true;

    for (let i = 0; i < data.length; i++) {
      const rowData = data[i];
      const rowHeight = await measureRow(rowData, columns, resolvedWidths, this.fonts, false, rowStyle);

      // Check if we need to start a new page
      const innerHeaderHeight = options?.headerRepeat !== false ? headerHeight : 0;
      
      // If this is the start of a new segment, we MUST account for the header
      const neededHeaderHeight = (currentRows.length === 0) 
        ? (isFirstSegment ? headerHeight : innerHeaderHeight) 
        : 0;
      const neededHeight = rowHeight + neededHeaderHeight;

      // Split only when we have rows to flush and the next row doesn't fit
      if (currentHeight < neededHeight && currentRows.length > 0) {
        // Start a new segment
        segments.push({ 
          header: isFirstSegment || options?.headerRepeat !== false, 
          rows: currentRows,
          resolvedWidths 
        });
        currentRows = [rowData];
        currentHeight = pageHeight - innerHeaderHeight - rowHeight;
        isFirstSegment = false;
      } else {
        currentRows.push(rowData);
        currentHeight -= rowHeight;
        if (currentRows.length === 1 && (isFirstSegment || options?.headerRepeat !== false)) {
            currentHeight -= headerHeight;
        }
      }
    }

    // Always push the final remaining rows
    if (currentRows.length > 0) {
      segments.push({ 
        header: isFirstSegment || options?.headerRepeat !== false, 
        rows: currentRows,
        resolvedWidths 
      });
    } else if (segments.length === 0) {
      // Empty table — at least show the header
      segments.push({ 
        header: true, 
        rows: [],
        resolvedWidths 
      });
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

    // Final pass: ensure all widths are at least the minimum dimension
    return widths.map(w => (isNaN(w) || w < MIN_DIMENSION) ? MIN_DIMENSION : w);
  }

  /**
   * Converts a TableSegment into a VNode tree (Box/Text) for rendering.
   */
  private createTableSegmentVNode(tableNode: TableNode<any>, segment: TableSegment): VNode {
    const { columns, options, headerStyle, rowStyle, style } = tableNode.props;
    const { resolvedWidths } = segment;
    
    const header = segment.header 
      ? this.createRowVNode(null, columns, resolvedWidths, true, false, headerStyle, rowStyle)
      : null;

    const rows = segment.rows.map((rowData: any, idx: number) => 
      this.createRowVNode(
        rowData,
        columns,
        resolvedWidths,
        false,
        (idx % 2 === 1) && !!options?.stripe,
        headerStyle,
        rowStyle,
        options?.stripeColor,
      )
    );

    return h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flexShrink: 0,
        ...style,
      },
      _segment: segment,
    } as any, header ? [header, ...rows] : rows) as any;
  }

  private createRowVNode(
    rowData: any,
    columns: any[],
    resolvedWidths: number[],
    isHeader: boolean,
    stripe: boolean,
    globalHeaderStyle?: any,
    globalRowStyle?: any,
    stripeColor?: string,
  ): VNode {
    const cells = columns.map((col, i) => {
      const content = isHeader ? col.header : rowData[col.key];
      const cellStyle: any = {
        ...resolveColumnCellStyle(col, isHeader, globalHeaderStyle, globalRowStyle),
        width: resolvedWidths[i],
      };

      return h('div', { style: cellStyle }, 
        h('div', { 
            style: { 
                display: 'flex', 
                flexDirection: 'column',
                width: '100%',
                wordBreak: 'break-word',
            } 
        }, String(content ?? ''))
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
        flexShrink: 0,
        ...globalRowStyle,
        ...(stripe ? { backgroundColor: stripeColor || '#f9f9f9' } : {}),
      }
    } as any, cells) as any;
  }

  private isTableNode(node: VNode): boolean {
    const type = node.type as any;
    const isTable = (
      type?.__isNebulaTable === true ||
      type?.displayName === 'NebulaPdfTable' || 
      node.type === 'table-internal'
    );
    
    return isTable;
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

  /**
   * Calculates the total height of a table segment by measuring its rows.
   */
  private async measureTableSegment(tableNode: TableNode<any>, segment: TableSegment): Promise<number> {
    const { columns, headerStyle, rowStyle } = tableNode.props;
    const { rows, header, resolvedWidths } = segment;
    
    let totalHeight = 0;

    if (header) {
      totalHeight += await measureRow(null, columns, resolvedWidths, this.fonts, true, headerStyle);
    }

    for (const rowData of rows) {
      totalHeight += await measureRow(rowData, columns, resolvedWidths, this.fonts, false, rowStyle);
    }

    return totalHeight;
  }
}
