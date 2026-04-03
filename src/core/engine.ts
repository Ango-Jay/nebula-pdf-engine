import type { VNode } from 'preact';
import type { EngineConfig, FontConfig, PageSize, Orientation, Padding } from '../types';
import { resolvePageDimensions, PAGE_SIZES } from '../types';
import { renderToImage } from './renderer';
import { assemblePdf, type AssemblerOptions, type PageBuffer } from './assembler';
import { AssetResolver } from '../utils/asset-resolver';
import { LayoutEngine } from '../layout/layout-engine';

// ─── Types ───

export interface GenerateOptions {
  /** PDF metadata: document title */
  title?: string;
  /** PDF metadata: document author */
  author?: string;
  /** PDF metadata: document subject */
  subject?: string;
}

// ─── PdfEngine ───

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
export class PdfEngine {
  private fonts: FontConfig[];
  private assetResolver: AssetResolver;

  constructor(config: EngineConfig) {
    if (!config.fonts || config.fonts.length === 0) {
      throw new Error(
        '[nebula-pdf-engine] At least one font must be provided in the engine config.',
      );
    }

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
  async generate(
    element: VNode,
    options: GenerateOptions = {},
  ): Promise<Buffer> {
    // ─── 1. Extract page configurations from the JSX tree ───
    const inputPageElements = this.extractPages(element);

    if (inputPageElements.length === 0) {
      throw new Error(
        '[nebula-pdf-engine] No <Page> components found in the element tree. ' +
        'Wrap your content in a <Page> component.',
      );
    }

    // ─── 2. Resolve images in the JSX tree ───
    await this.resolveImages(element);

    // ─── 3. Paginate and Render ───
    const pageBuffers: PageBuffer[] = [];
    const layoutEngine = new LayoutEngine(this.fonts);

    for (const inputPage of inputPageElements) {
      const { size, orientation, padding } = this.extractPageProps(inputPage);
      const dimensions = resolvePageDimensions(size, orientation, padding);

      // Extract children from the input page
      const inputChildren = this.extractChildren(inputPage);

      // Run the layout engine to split children across pages
      const synthesizedPages = await layoutEngine.paginate(
        inputChildren,
        dimensions,
      );

      // Render each synthesized page to a PNG buffer
      for (const children of synthesizedPages) {
        // Build a fresh Page VNode for Satori with the correct dimensions
        const pageVNode: VNode = {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              backgroundColor: '#fff', // Default background
            },
            children,
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
        } as any;

        const pngBuffer = await renderToImage(pageVNode, {
          width: dimensions.width,
          height: dimensions.height,
          fonts: this.fonts,
        });

        pageBuffers.push({
          pngBuffer,
          width: dimensions.width,
          height: dimensions.height,
        });
      }
    }

    // ─── 4. Assemble PNGs into a PDF ───
    const assemblerOptions: AssemblerOptions = {
      title: options.title,
      author: options.author,
      subject: options.subject,
    };

    const pdfBytes = await assemblePdf(pageBuffers, assemblerOptions);

    return Buffer.from(pdfBytes);
  }

  /**
   * Extracts children from a VNode (handles arrays, single nodes, fragments).
   */
  private extractChildren(element: VNode): VNode[] {
    const children = (element.props as any)?.children;
    if (!children) return [];
    if (Array.isArray(children)) return children.filter(c => !!c);
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
  private extractPages(element: VNode): VNode[] {
    // Check if the root element is a Page
    if (this.isPageElement(element)) {
      return [element];
    }

    // Check if it's a fragment or wrapper with Page children
    const children = element.props?.children;

    if (!children) return [];

    // Handle arrays of children
    if (Array.isArray(children)) {
      return children.filter((child: any) => this.isPageElement(child));
    }

    // Single child that might be a Page
    if (this.isPageElement(children as VNode)) {
      return [children as VNode];
    }

    return [];
  }

  /**
   * Checks whether a VNode represents a `<Page>` component.
   */
  private isPageElement(node: VNode): boolean {
    if (!node || typeof node !== 'object') return false;

    const nodeType = node.type as any;

    // Check by displayName (set on our Page component)
    if (typeof nodeType === 'function' && nodeType.displayName === 'NebulaPdfPage') {
      return true;
    }

    return false;
  }

  /**
   * Extracts page configuration props from a `<Page>` VNode.
   */
  private extractPageProps(pageElement: VNode): {
    size: PageSize;
    orientation: Orientation;
    padding: Padding | undefined;
  } {
    const props = (pageElement.props || {}) as any;
    return {
      size: props.size ?? 'A4',
      orientation: props.orientation ?? 'portrait',
      padding: props.padding,
    };
  }

  /**
   * Walks the VNode tree and resolves all image sources to base64 data URIs.
   *
   * This mutates the tree in-place — replacing `src` props on `<Image>`
   * components with their resolved base64 values.
   */
  private async resolveImages(element: VNode): Promise<void> {
    if (!element || typeof element !== 'object') return;

    const nodeType = element.type as any;

    // Check if this is an Image component
    if (typeof nodeType === 'function' && nodeType.displayName === 'NebulaPdfImage') {
      const props = element.props as any;
      const src = props?.src;

      if (src && typeof src === 'string' && !src.startsWith('data:')) {
        // Resolve the image source to a base64 data URI (pass dimensions for optimization)
        const resolvedSrc = await this.assetResolver.resolveImage(
          src, 
          props.width, 
          props.height
        );
        props.src = resolvedSrc;
      }
    }

    // Recursively walk children
    const children = element.props?.children;

    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === 'object') {
          await this.resolveImages(child as VNode);
        }
      }
    } else if (children && typeof children === 'object') {
      await this.resolveImages(children as VNode);
    }
  }
}
