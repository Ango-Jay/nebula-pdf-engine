import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export class AssetResolver {
  private cache = new Map<string, string>();

  async resolveImage(src: string): Promise<string> {
    // 1. Check Cache
    if (this.cache.has(src)) return this.cache.get(src)!;

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

    // 3. Normalize with Sharp (Senior move: optimize PDF size)
    const processedBuffer = await sharp(buffer)
      .png() // Satori loves PNGs
      .toBuffer();

    const base64 = `data:image/png;base64,${processedBuffer.toString('base64')}`;
    
    // 4. Cache and Return
    this.cache.set(src, base64);
    return base64;
  }
}