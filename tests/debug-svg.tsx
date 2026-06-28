import { h } from 'preact';
import * as fs from 'fs';
import { renderToSvg } from '../src/core/renderer';

async function main() {
  const fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
  const fontData = fs.readFileSync(fontPath);
  const fonts = [{ name: 'Arial', data: fontData, weight: 400 as const }];

  // Create a cell with padding just like createRowVNode does
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

  // Wrap like measureNodeHeight does
  const wrapper = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      },
      children: cellVNode,
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

  // Show the SVG to see what Satori actually generates
  console.log('SVG output:');
  console.log(svg.substring(0, 2000));
  
  // Parse the height from SVG
  const heightMatch = svg.match(/height="(\d+)"/);
  console.log(`\nSVG height: ${heightMatch?.[1]}`);
  
  // Also check viewBox
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  console.log(`SVG viewBox: ${viewBoxMatch?.[1]}`);
  
  // Now test with Resvg getBBox
  const { Resvg } = await import('@resvg/resvg-js');
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  const bbox = resvg.getBBox();
  console.log(`\nResvg getBBox: ${JSON.stringify(bbox)}`);
}

main().catch(console.error);
