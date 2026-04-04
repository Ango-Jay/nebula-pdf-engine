import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../src/layout/layout-engine';
import { Box, Text, Image } from '../src/components/primitives';
import { h } from 'preact';

describe('Layout Logic', () => {
  const engine = new LayoutEngine([]);

  describe('resolveColumnWidths', () => {
    const containerWidth = 500;

    it('resolves purely fixed widths (px)', () => {
      const columns = [
        { width: 100 },
        { width: 200 },
        { width: 50 },
      ];
      // Note: resolveColumnWidths is private, but for testing core logic
      // we can access it via cast or by making it public/internal.
      // Since I'm the developer, I'll access it via cast for pure unit testing.
      const resolved = (engine as any).resolveColumnWidths(columns, containerWidth);
      expect(resolved).toEqual([100, 200, 50]);
    });

    it('resolves percentage widths (%)', () => {
      const columns = [
        { width: '20%' },
        { width: '50%' },
      ];
      const resolved = (engine as any).resolveColumnWidths(columns, containerWidth);
      expect(resolved).toEqual([100, 250]);
    });

    it('distributes remaining width to flex columns', () => {
      const columns = [
        { width: 100 }, // Fixed
        { flex: 1 },    // Flex
        { flex: 3 },    // Flex
      ];
      // Remaining: 500 - 100 = 400. Flex units: 1 + 3 = 4. 1 unit = 100.
      const resolved = (engine as any).resolveColumnWidths(columns, containerWidth);
      expect(resolved).toEqual([100, 100, 300]);
    });

    it('handles mixed fixed, percentage and flex widths', () => {
      const columns = [
        { width: 100 },   // Fixed
        { width: '20%' }, // 100
        { flex: 1 },      // Remaining: 300
      ];
      const resolved = (engine as any).resolveColumnWidths(columns, containerWidth);
      expect(resolved).toEqual([100, 100, 300]);
    });

    it('handles total fixed widths exceeding container width', () => {
      const columns = [
        { width: 400 },
        { width: 200 },
        { flex: 1 },
      ];
      const resolved = (engine as any).resolveColumnWidths(columns, containerWidth);
      // Fixed: 600. Remaining: -100. Flex: 0 (Math.max(0, remaining)).
      expect(resolved).toEqual([400, 200, 0]);
    });
  });

  describe('isSplittable', () => {
    it('identifies NebulaPdfText as splittable', () => {
      const textNode = h(Text, {} as any);
      expect((engine as any).isSplittable(textNode)).toBe(true);
    });

    it('identifies raw span with text as splittable', () => {
      const spanNode = h('span', { children: 'Hello' } as any);
      expect((engine as any).isSplittable(spanNode)).toBe(true);
    });

    it('rejects other types as splittable', () => {
      const boxNode = h(Box, {} as any);
      const imgNode = h(Image, { src: '', width: 0, height: 0 } as any);
      
      expect((engine as any).isSplittable(boxNode)).toBe(false);
      expect((engine as any).isSplittable(imgNode)).toBe(false);
    });
  });
});
