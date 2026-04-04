declare module 'fontkit' {
  export interface Font {
    familyName: string;
    subfamilyName: string;
    unitsPerEm: number;
    ascent: number;
    descent: number;
    lineGap: number;
    bbox: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    };
    layout(text: string): {
      glyphs: any[];
      positions: any[];
      advanceWidth: number;
    };
  }

  export function create(buffer: Buffer | ArrayBuffer): Font;
  export function open(path: string, postscriptName: string, callback: (err: Error | null, font: Font) => void): void;
  export function openSync(path: string, postscriptName?: string): Font;
}
