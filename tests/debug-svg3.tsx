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
      width: '100%',
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
  }, 'TXN-1000'));

  const wrapper = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      },
      children: [
        { type: 'div', props: { style: { width: '100%', height: 1, backgroundColor: '#000' } } },
        cellVNode,
        { type: 'div', props: { style: { width: '100%', height: 1, backgroundColor: '#000' } } },
      ],
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

  const svg = await renderToSvg(wrapper, {
    width: 100,
    height: 5000,
    fonts,
  });
  
  const { Resvg } = await import('@resvg/resvg-js');
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  const bbox = resvg.getBBox();
  console.log(`\nResvg getBBox with markers: width=${bbox?.width}, height=${bbox?.height}, x=${bbox?.x}, y=${bbox?.y}`);
  // If height includes 1px top and 1px bottom marker, the node's height is bbox.height - 2.
  console.log(`Computed node height: ${(bbox?.height ?? 2) - 2}`);
}

main().catch(console.error);
