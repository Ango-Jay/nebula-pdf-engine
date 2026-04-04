import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export class AssetResolver {
  private cache = new Map<string, string>();

  async resolveImage(src: string, width?: number, height?: number): Promise<string> {
    // 1. Check Cache (Include dimensions in cache key if provided)
    const cacheKey = `${src}${width ? `_w${width}` : ''}${height ? `_h${height}` : ''}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    let buffer: Buffer;

    // 2. Fetch or Read
    if (src.startsWith('http')) {
      const response = await fetch(src);
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      const absolutePath = path.isAbsolute(src) 
        ? src 
        : path.join(process.cwd(), src);
      buffer = await fs.readFile(absolutePath);
    }

    // 3. Normalize & Resize with Sharp (optimize PDF size)
    let sharpInstance = sharp(buffer);
    
    if (width || height) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      });
    }

    const processedBuffer = await sharpInstance
      .png() // Satori loves PNGs
      .toBuffer();

    const base64 = `data:image/png;base64,${processedBuffer.toString('base64')}`;
    
    // 4. Cache and Return
    this.cache.set(cacheKey, base64);
    return base64;
  }
}