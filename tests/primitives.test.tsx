/** @jsxImportSource preact */
import { describe, it, expect } from 'vitest';
import { Page, Box, Text, Image } from '../src/components/primitives';

describe('Primitive Components', () => {
  describe('Page', () => {
    it('renders a full-height flex container with data attributes', () => {
      const vnode = (
        <Page size="LETTER" orientation="landscape" padding={20}>
          <Box>Content</Box>
        </Page>
      ) as any;

      const rendered = vnode.type(vnode.props);

      expect(rendered.type).toBe('div');
      expect(rendered.props.style.display).toBe('flex');
      expect(rendered.props.style.height).toBe('100%');
      expect(rendered.props['data-page-size']).toBe('LETTER');
      expect(rendered.props['data-page-orientation']).toBe('landscape');
      expect(rendered.props['data-page-padding']).toBe('20');
    });

    it('handles padding object correctly', () => {
      const vnode = (
        <Page padding={{ top: 10, left: 5 }}>
          <Box />
        </Page>
      ) as any;

      const rendered = vnode.type(vnode.props);

      expect(rendered.props['data-page-padding']).toBe('{"top":10,"left":5}');
    });
  });

  describe('Box', () => {
    it('renders a div with display flex by default', () => {
      const vnode = (<Box style={{ backgroundColor: 'red' }}>Inner</Box>) as any;
      const rendered = vnode.type(vnode.props);

      expect(rendered.type).toBe('div');
      expect(rendered.props.style.display).toBe('flex');
      expect(rendered.props.style.backgroundColor).toBe('red');
      expect(rendered.props.children).toBe('Inner');
    });
  });

  describe('Text', () => {
    it('renders a span with display flex', () => {
      const vnode = (<Text style={{ fontSize: 12 }}>Hello</Text>) as any;
      const rendered = vnode.type(vnode.props);

      expect(rendered.type).toBe('span');
      expect(rendered.props.style.display).toBe('flex');
      expect(rendered.props.style.fontSize).toBe(12);
      expect(rendered.props.children).toBe('Hello');
    });
  });

  describe('Image', () => {
    it('renders an img tag with correct dimensions and objectFit', () => {
      const vnode = (
        <Image 
          src="logo.png" 
          width={100} 
          height={50} 
          style={{ opacity: 0.5 }} 
          alt="Logo"
        />
      ) as any;

      const rendered = vnode.type(vnode.props);

      expect(rendered.type).toBe('img');
      expect(rendered.props.src).toBe('logo.png');
      expect(rendered.props.width).toBe(100);
      expect(rendered.props.height).toBe(50);
      expect(rendered.props.style.objectFit).toBe('contain');
      expect(rendered.props.style.opacity).toBe(0.5);
    });
  });
});
