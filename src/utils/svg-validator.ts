import { MIN_DIMENSION } from '../types';

/**
 * Sanitizes and validates an SVG string before passing it to the Rust engine.
 */
export function validateAndSanitizeSvg(svg: string, context: string): string {
  if (!svg) return svg;

  // 1. Sanitize standard XML attributes (width, height, rx, ry, r)
  let sanitized = svg
    .replace(/(width|height|rx|ry|r)\s*=\s*["']([-.\deEa-zA-Z%]+)["']/g, (match, attr, val) => {
        const v = parseFloat(val);
        if (isNaN(v) || v < MIN_DIMENSION) {
            const unit = val.replace(/[-.\deE]+/g, '') || '';
            const floor = (attr === 'width' || attr === 'height') ? MIN_DIMENSION : 0.1;
            if (v < floor || isNaN(v)) {
              return `${attr}="${floor}${unit}"`;
            }
        }
        return match;
    });

  // 2. Sanitize inline CSS styles
  sanitized = sanitized.replace(/style\s*=\s*["']([^"']+)["']/g, (match: string, styleBody: string) => {
    const newStyle = styleBody.replace(/(width|height)\s*:\s*([-.\deEa-zA-Z%]+)/g, (sMatch: string, sAttr: string, sVal: string) => {
      const v = parseFloat(sVal);
      if (isNaN(v) || v < MIN_DIMENSION) {
        const unit = sVal.replace(/[-.\deE]+/g, '') || 'px';
        return `${sAttr}: ${MIN_DIMENSION}${unit}`;
      }
      return sMatch;
    });
    return `style="${newStyle}"`;
  });

  // 3. Sanitize Path Data (d="...")
  // Using 's' flag to handle multi-line path data and nudge geometry.
  sanitized = sanitized.replace(/d\s*=\s*["']([^"']+)["']/gs, (match, dBody) => {
    let newD = dBody
      .replace(/A\s*0\s*[, ]\s*0/g, 'A0.1,0.1')
      .replace(/([hH])\s*0(\s|$|["'])/g, '$10.0001$2')
      .replace(/([vV])\s*0(\s|$|["'])/g, '$10.0001$2');
    
    // The "Nudge": Ensure non-zero height/width for all paths
    newD += " m 0,0.001"; 
    
    return `d="${newD}"`;
  });

  // 4. Sanitize viewBox (handles both space and comma delimiters)
  sanitized = sanitized.replace(/viewBox\s*=\s*["']([-.\deE\s,]+)["']/g, (match, val) => {
    const parts = val.trim().split(/[\s,]+/).map((p: string) => parseFloat(p));
    if (parts.length === 4) {
        const [x, y, w, h] = parts;
        if (isNaN(w) || w < MIN_DIMENSION || isNaN(h) || h < MIN_DIMENSION) {
            return `viewBox="${parts[0]} ${parts[1]} ${isNaN(w) || w < MIN_DIMENSION ? MIN_DIMENSION : w} ${isNaN(h) || h < MIN_DIMENSION ? MIN_DIMENSION : h}"`;
        }
    }
    return match;
  });

  // 5. Final Safety Check
  if (sanitized.includes('NaN')) {
    throw new Error(`[PDF-ENGINE] Fatal SVG error in ${context}: Output contains NaN values.`);
  }

  return sanitized;
}
