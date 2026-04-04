import { describe, it, expect } from 'vitest';
import { splitTextNode, findWordBoundary } from '../src/layout/text-splitter';
import { Text } from '../src/components/primitives';
import { h } from 'preact';

describe('Text Splitter', () => {
  const fonts: any[] = [{ name: 'Arial', data: Buffer.alloc(0) }]; // Mock font

  describe('findWordBoundary', () => {

    it('splits at a space boundary', () => {
      const text = "Hello World From Nebula";
      // Target index 10 is 'd' in World. Looking back, should find space after Hello.
      // Wait, findWordBoundary looks back up to 50 chars.
      // Logic: i from targetIndex down.
      expect(findWordBoundary(text, 10)).toBe(6); // After "Hello "
    });

    it('splits at a newline boundary', () => {
      const text = "First Line\nSecond Line";
      expect(findWordBoundary(text, 15)).toBe(11); // After "First Line\n"
    });

    it('falls back to exact index if no boundary found within 50 chars', () => {
      const text = "A".repeat(100);
      expect(findWordBoundary(text, 80)).toBe(80);
    });
  });

  describe('splitTextNode (Integration-ish)', () => {
    // Note: splitTextNode calls calculateTextMetrics which calls fontkit.
    // For unit testing without real fonts, we might need to mock calculateTextMetrics.
    
    it('returns null for empty text', async () => {
      const node = h(Text, { children: '' } as any);
      const result = await splitTextNode(node, 100, fonts, 500);
      expect(result).toBe(null);
    });

    it('returns null if everything fits', async () => {
      // This is hard to test without real metrics as it calculates line count.
      // But we can verify it doesn't crash on simple inputs.
      const node = h(Text, { children: 'Short text' } as any);
      const result = await splitTextNode(node, 1000, fonts, 500);
      expect(result).toBe(null);
    });
  });
});
