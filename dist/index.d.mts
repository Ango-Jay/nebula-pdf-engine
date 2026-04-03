import * as _$preact from "preact";
import { VNode } from "preact";

//#region src/types/index.d.ts
declare const PAGE_SIZES: {
  readonly A4: {
    readonly width: 595.28;
    readonly height: 841.89;
  };
  readonly LETTER: {
    readonly width: 612;
    readonly height: 792;
  };
  readonly LEGAL: {
    readonly width: 612;
    readonly height: 1008;
  };
};
type PageSize = keyof typeof PAGE_SIZES;
type Orientation = 'portrait' | 'landscape';
interface PaddingObject {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
type Padding = number | Partial<PaddingObject>;
interface PageProps {
  /** Paper size preset. Default: 'A4' */
  size?: PageSize;
  /** Page orientation. Default: 'portrait' */
  orientation?: Orientation;
  /** Page padding in PDF points */
  padding?: Padding;
  /** Page content */
  children: VNode | VNode[];
}
interface FontConfig {
  /** Font family name (e.g. 'Inter', 'Roboto') */
  name: string;
  /** Font file data — loaded from disk or fetched */
  data: Buffer | ArrayBuffer;
  /** Font weight. Default: 400 */
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  /** Font style. Default: 'normal' */
  style?: 'normal' | 'italic';
}
interface ImageOptions {
  /** Image quality for lossy formats (1-100). Default: 80 */
  quality?: number;
  /** Max width in pixels for downsampling. Images wider than this will be resized. */
  maxWidth?: number;
  /** Max height in pixels for downsampling. */
  maxHeight?: number;
}
interface EngineConfig {
  /** One or more font buffers to register with Satori */
  fonts: FontConfig[];
  /** Asset caching strategy. Default: 'memory' */
  assetCache?: 'memory' | 'none';
  /** Options passed to Sharp for image processing */
  imageOptions?: ImageOptions;
}
/**
 * Subset of CSS properties supported by Satori.
 * @see https://github.com/vercel/satori#css
 */
interface SatoriStyle {
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
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
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
  position?: 'relative' | 'absolute';
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
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
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y';
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
  overflow?: 'visible' | 'hidden';
  opacity?: number;
  boxShadow?: string;
  transform?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
}
interface BoxProps {
  /** Flexbox styles applied to this container */
  style?: SatoriStyle;
  children?: VNode | VNode[] | string | number | (VNode | string | number)[];
}
interface TextProps {
  /** Typography and layout styles */
  style?: SatoriStyle;
  children?: string | number | (string | number)[];
}
interface ImageProps {
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
//#endregion
//#region src/components/primitives.d.ts
/**
 * Defines a single PDF page. Acts as the top-level container
 * that the layout engine uses to determine dimensions and breaks.
 *
 * Usage:
 * ```tsx
 * <Page size="A4" orientation="portrait" padding={40}>
 *   <Box>...</Box>
 * </Page>
 * ```
 *
 * Note: `size`, `orientation`, and `padding` are consumed by the engine
 * during the layout prepass — they are NOT passed through to Satori's
 * rendered output. The Page component renders its children inside a
 * full-page flex container.
 */
declare function Page({
  children,
  size,
  orientation,
  padding
}: PageProps): _$preact.JSX.Element;
declare namespace Page {
  var displayName: string;
}
/**
 * A generic flex container. The primary building block for layouts.
 *
 * Usage:
 * ```tsx
 * <Box style={{ flexDirection: 'row', gap: 10 }}>
 *   <Text>Hello</Text>
 *   <Text>World</Text>
 * </Box>
 * ```
 */
declare function Box({
  style,
  children
}: BoxProps): _$preact.JSX.Element;
declare namespace Box {
  var displayName: string;
}
/**
 * Renders text content. Supports Satori's text styling properties.
 *
 * Usage:
 * ```tsx
 * <Text style={{ fontSize: 16, color: '#333' }}>
 *   Hello, World!
 * </Text>
 * ```
 *
 * The layout engine may split this component across pages
 * if the text overflows the available space.
 */
declare function Text({
  style,
  children
}: TextProps): _$preact.JSX.Element;
declare namespace Text {
  var displayName: string;
}
/**
 * Displays an image inside the PDF. Sources can be URLs, absolute paths,
 * or paths relative to `process.cwd()`.
 *
 * The engine's AssetResolver will fetch and convert the image to a
 * base64 PNG data URI before passing it to Satori.
 *
 * Usage:
 * ```tsx
 * <Image src="/assets/logo.png" width={200} height={100} />
 * ```
 *
 * Note: `width` and `height` are required so the engine can:
 * 1. Downsample the image to the correct size (reducing PDF weight)
 * 2. Reserve space during the layout prepass
 */
declare function Image({
  src,
  width,
  height,
  style,
  alt
}: ImageProps): _$preact.JSX.Element;
declare namespace Image {
  var displayName: string;
}
//#endregion
export { Box, type BoxProps, type EngineConfig, type FontConfig, Image, type ImageOptions, type ImageProps, type Orientation, PAGE_SIZES, type Padding, Page, type PageProps, type PageSize, type SatoriStyle, Text, type TextProps };
//# sourceMappingURL=index.d.mts.map