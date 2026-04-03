import type { VNode } from 'preact';
import type { FontConfig, ResolvedPageDimensions } from '../types';
import { measureAllChildren, type MeasuredNode } from './measure';
import { splitTextNode } from './text-splitter';

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
      if (item.height <= remainingHeight) {
        // ✅ Child fits on the current page
        currentPage.push(item.node);
        remainingHeight -= item.height;
      } else if (this.isSplittable(item.node)) {
        // 🔀 Child overflows but is splittable (Text)
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

          // Flush the current page
          pages.push(currentPage);

          // Add any complete overflow pages
          for (let i = 0; i < overflowPages.length - 1; i++) {
            pages.push(overflowPages[i]);
          }

          // The last overflow page becomes the new current page
          if (overflowPages.length > 0) {
            currentPage = overflowPages[overflowPages.length - 1];
            // Estimate remaining height — the overflow page may not be full
            // For simplicity, start fresh (layout engine refinement in future)
            remainingHeight = contentHeight;
          } else {
            currentPage = [];
            remainingHeight = contentHeight;
          }
        } else {
          // Split failed — treat as atomic and move to next page
          pages.push(currentPage);
          currentPage = [item.node];
          remainingHeight = contentHeight - item.height;
        }
      } else {
        // 📦 Atomic node — move entirely to the next page
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
