import type { VNode } from 'preact';

// ─── Page Sizes (in PDF Points: 1pt = 1/72 inch) ───

export const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612, height: 792 },
  LEGAL: { width: 612, height: 1008 },
} as const;

export type PageSize = keyof typeof PAGE_SIZES;
export type Orientation = 'portrait' | 'landscape';

// ─── Padding ───

export interface PaddingObject {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type Padding = number | Partial<PaddingObject>;

/**
 * Normalizes a padding value into a full PaddingObject.
 * - `number` → uniform on all sides
 * - `Partial<PaddingObject>` → missing sides default to 0
 */
export function normalizePadding(padding?: Padding): PaddingObject {
  if (padding === undefined) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }

  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
  };
}

// ─── Page Props ───

export interface PageProps {
  /** Paper size preset. Default: 'A4' */
  size?: PageSize;
  /** Page orientation. Default: 'portrait' */
  orientation?: Orientation;
  /** Page padding in PDF points */
  padding?: Padding;
  /** Page content */
  children: VNode | VNode[];
}

// ─── Font Configuration ───

export interface FontConfig {
  /** Font family name (e.g. 'Inter', 'Roboto') */
  name: string;
  /** Font file data — loaded from disk or fetched */
  data: Buffer | ArrayBuffer;
  /** Font weight. Default: 400 */
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  /** Font style. Default: 'normal' */
  style?: 'normal' | 'italic';
}

// ─── Sharp / Image Options ───

export interface ImageOptions {
  /** Image quality for lossy formats (1-100). Default: 80 */
  quality?: number;
  /** Max width in pixels for downsampling. Images wider than this will be resized. */
  maxWidth?: number;
  /** Max height in pixels for downsampling. */
  maxHeight?: number;
}

// ─── Engine Configuration ───

export interface EngineConfig {
  /** One or more font buffers to register with Satori */
  fonts: FontConfig[];
  /** Asset caching strategy. Default: 'memory' */
  assetCache?: 'memory' | 'none';
  /** 
   * The pixel ratio used for rendering SVGs to PNGs. 
   * Higher values result in crisper PDFs but larger file sizes.
   * Default: 2 (Retina quality)
   */
  devicePixelRatio?: number;
  /** Options passed to Sharp for image processing */
  imageOptions?: ImageOptions;
}

// ─── Component Style Types ───

/**
 * Subset of CSS properties supported by Satori.
 * @see https://github.com/vercel/satori#css
 */
export interface SatoriStyle {
  // Layout
  display?: 'flex' | 'none';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  flexWrap?: 'wrap' | 'nowrap';
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  alignSelf?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  gap?: number;
  rowGap?: number;
  columnGap?: number;

  // Sizing
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;

  // Spacing
  margin?: number | string;
  marginTop?: number | string;
  marginRight?: number | string;
  marginBottom?: number | string;
  marginLeft?: number | string;
  padding?: number | string;
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;

  // Position
  position?: 'relative' | 'absolute';
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;

  // Border
  borderWidth?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderColor?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderRadius?: number | string;
  borderTopLeftRadius?: number | string;
  borderTopRightRadius?: number | string;
  borderBottomRightRadius?: number | string;
  borderBottomLeftRadius?: number | string;
  borderStyle?: 'solid' | 'dashed';

  // Background
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y';

  // Typography
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'right' | 'center' | 'justify';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  lineHeight?: number | string;
  letterSpacing?: number | string;
  wordBreak?: 'normal' | 'break-all' | 'break-word' | 'keep-all';
  textOverflow?: 'clip' | 'ellipsis';
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line';

  // Visual
  overflow?: 'visible' | 'hidden';
  opacity?: number;
  boxShadow?: string;
  transform?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
}

// ─── Primitive Component Props ───

export interface BoxProps {
  /** Flexbox styles applied to this container */
  style?: SatoriStyle;
  children?: VNode | VNode[] | string | number | (VNode | string | number)[];
}

export interface TextProps {
  /** Typography and layout styles */
  style?: SatoriStyle;
  children?: string | number | (string | number)[];
}

export interface ImageProps {
  /** Image source — URL, absolute path, or relative path */
  src: string;
  /** Display width in PDF points */
  width: number;
  /** Display height in PDF points */
  height: number;
  /** Additional styles */
  style?: SatoriStyle;
  /** Alt text (used for accessibility metadata — future) */
  alt?: string;
}

// ─── Internal Types ───

/** Resolved page dimensions after applying orientation */
export interface ResolvedPageDimensions {
  width: number;
  height: number;
  padding: PaddingObject;
  /** Available content width (width - left padding - right padding) */
  contentWidth: number;
  /** Available content height (height - top padding - bottom padding) */
  contentHeight: number;
}

/**
 * Resolves the final page dimensions based on size, orientation, and padding.
 */
export function resolvePageDimensions(
  size: PageSize = 'A4',
  orientation: Orientation = 'portrait',
  padding?: Padding,
): ResolvedPageDimensions {
  const base = PAGE_SIZES[size];
  const normalizedPadding = normalizePadding(padding);

  const width = orientation === 'portrait' ? base.width : base.height;
  const height = orientation === 'portrait' ? base.height : base.width;

  return {
    width,
    height,
    padding: normalizedPadding,
    contentWidth: width - normalizedPadding.left - normalizedPadding.right,
    contentHeight: height - normalizedPadding.top - normalizedPadding.bottom,
  };
}
