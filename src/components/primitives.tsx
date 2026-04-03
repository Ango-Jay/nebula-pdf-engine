import type { PageProps, BoxProps, TextProps, ImageProps } from '../types';

// ─── Page ───

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
export function Page({ children, size, orientation, padding }: PageProps) {
  // Dimensions are resolved by the engine, not here.
  // This component just wraps children in a flex container.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      }}
      // Store page config as data attributes so the engine can read them
      // during tree traversal without needing a separate config map.
      data-page-size={size ?? 'A4'}
      data-page-orientation={orientation ?? 'portrait'}
      data-page-padding={
        typeof padding === 'number'
          ? String(padding)
          : JSON.stringify(padding ?? 0)
      }
    >
      {children}
    </div>
  );
}

// Mark for engine identification during tree walk
Page.displayName = 'NebulaPdfPage';

// ─── Box ───

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
export function Box({ style, children }: BoxProps) {
  return (
    <div
      style={{
        display: 'flex',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

Box.displayName = 'NebulaPdfBox';

// ─── Text ───

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
export function Text({ style, children }: TextProps) {
  return (
    <span
      style={{
        display: 'flex',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

Text.displayName = 'NebulaPdfText';

// ─── Image ───

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
export function Image({ src, width, height, style, alt }: ImageProps) {
  return (
    <img
      src={src}
      width={width}
      height={height}
      style={{
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}

Image.displayName = 'NebulaPdfImage';
