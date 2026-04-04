import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetResolver } from '../src/utils/asset-resolver';
import fs from 'node:fs/promises';
import sharp from 'sharp';

// Mock sharp
vi.mock('sharp', () => {
    const sharpMock = vi.fn(() => ({
        resize: vi.fn().mockReturnThis(),
        png: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized-image')),
    }));
    return { default: sharpMock };
});

// Mock fs
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn(),
    },
    readFile: vi.fn(),
}));

describe('AssetResolver', () => {
    let resolver: AssetResolver;

    beforeEach(() => {
        vi.clearAllMocks();
        resolver = new AssetResolver();
    });

    it('resolves a local file path to a base64 data URI', async () => {
        const mockData = Buffer.from('mock-image-data');
        vi.mocked(fs.readFile).mockResolvedValue(mockData);
        
        const result = await resolver.resolveImage('test.png', 100, 50);
        
        expect(fs.readFile).toHaveBeenCalled();
        expect(result).toContain('data:image/png;base64,');
        // 'resized-image' in base64 is 'cmVzaXplZC1pbWFnZQ=='
        expect(result).toContain('cmVzaXplZC1pbWFnZQ==');
    });

    it('passes through an existing data URI', async () => {
        const dataUri = 'data:image/png;base64,existing';
        const result = await resolver.resolveImage(dataUri);
        
        expect(result).toBe(dataUri);
        expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('handles error for missing file', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
        
        await expect(resolver.resolveImage('non-existent.png')).rejects.toThrow('File not found');
    });
});
