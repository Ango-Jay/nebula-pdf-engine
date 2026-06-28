import { h } from 'preact';
import * as fs from 'fs';
import { renderToSvg } from '../src/core/renderer';

async function main() {
  const fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
  const fontData = fs.readFileSync(fontPath);
  const fonts = [{ name: 'Arial', data: fontData, weight: 400 as const }];

  const cellVNode = h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      padding: 5,
      width: 35.28, // Narrow width to force wrapping
      fontSize: 9,
      wordBreak: 'break-word' as any,
    }
  }, h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      wordBreak: 'break-word' as any,
    }
  }, 'Investment Dividend'));

  const marker = {
    type: 'div',
    props: {
      style: { width: '100%', height: 1, flexShrink: 0, backgroundColor: '#000' }
    }
  } as any;

  const wrapper = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: 35.28,
      },
      children: [marker, cellVNode, marker],
    },
    key: null, __k: null, __: null, __b: 0, __e: null, __c: null, __v: 0, __i: 0, constructor: undefined, ref: null,
  } as any;

  const svg = await renderToSvg(wrapper, {
    width: 35.28,
    height: 5000,
    fonts,
  });
  
  const { Resvg } = await import('@resvg/resvg-js');
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  const bbox = resvg.getBBox();
  console.log(`\nResvg bbox height: ${bbox?.height}`);
  console.log(`Computed node height: ${(bbox?.height ?? 2) - 2}`);
}

main().catch(console.error);
