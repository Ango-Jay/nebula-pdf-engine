import satori, { type Font as SatoriFont } from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { FontConfig } from '../types';
import type { VNode } from 'preact';

// ─── Types ───

export interface RenderToSvgOptions {
  /** Page width in PDF points */
  width: number;
  /** Page height in PDF points */
  height: number;
  /** Registered font configurations */
  fonts: FontConfig[];
}

// ─── SVG Rendering (Satori) ───

/**
 * Renders a Preact VNode tree into an SVG string using Satori.
 *
 * Satori uses Yoga layout internally, so you get full flexbox support.
 * The output is a complete SVG document with inlined styles —
 * no external CSS dependencies.
 *
 * @param element - The JSX element tree to render
 * @param options - Page dimensions and font configuration
 * @returns SVG markup as a string
 */
export async function renderToSvg(
  element: VNode,
  options: RenderToSvgOptions,
): Promise<string> {
  const satorifonts: SatoriFont[] = options.fonts.map((font) => ({
    name: font.name,
    data: font.data,
    weight: font.weight,
    style: font.style,
  }));

  const svg = await satori(
    // Satori expects a React-like element. Preact VNodes are structurally
    // compatible since both are { type, props, children } objects.
    element as any,
    {
      width: options.width,
      height: options.height,
      fonts: satorifonts,
    },
  );

  return svg;
}

// ─── PNG Rendering (Resvg) ───

/**
 * Converts an SVG string into a PNG buffer using Resvg (Rust-based).
 *
 * Resvg is significantly faster than alternatives like puppeteer or
 * canvas-based renderers because it's compiled to native code via NAPI.
 *
 * @param svgString - Complete SVG markup
 * @returns PNG image as a Buffer
 */
export function renderToPng(svgString: string): Buffer {
  const resvg = new Resvg(svgString, {
    font: {
      // Don't load system fonts — we embed everything via Satori
      loadSystemFonts: false,
    },
    // Use the SVG's intrinsic size (matches page dimensions)
    fitTo: { mode: 'original' },
  });

  const rendered = resvg.render();
  return rendered.asPng();
}

// ─── Convenience: Full Pipeline ───

/**
 * Renders a Preact VNode directly to a PNG buffer.
 * Combines `renderToSvg` and `renderToPng` in a single call.
 *
 * @param element - The JSX element tree
 * @param options - Page dimensions and font configuration
 * @returns PNG image as a Buffer
 */
export async function renderToImage(
  element: VNode,
  options: RenderToSvgOptions,
): Promise<Buffer> {
  const svg = await renderToSvg(element, options);
  return renderToPng(svg);
}
