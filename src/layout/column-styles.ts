import type { SatoriStyle } from '../types';

type ColumnStyleSource = {
  style?: SatoriStyle;
  headerStyle?: SatoriStyle;
  cellStyle?: SatoriStyle;
  align?: 'left' | 'right' | 'center';
};

/**
 * Resolves per-column cell styles for measurement and rendering.
 *
 * Merge order (later wins):
 * 1. Global row/header styles
 * 2. Legacy `style` (applies to header + data cells, pre-1.1 API)
 * 3. `headerStyle` or `cellStyle`
 */
export function resolveColumnCellStyle(
  col: ColumnStyleSource,
  isHeader: boolean,
  globalHeaderStyle?: SatoriStyle,
  globalRowStyle?: SatoriStyle,
): SatoriStyle {
  return {
    display: 'flex',
    flexDirection: 'column',
    padding: 5,
    ...(isHeader
      ? { ...globalHeaderStyle, ...col.style, ...col.headerStyle }
      : { ...globalRowStyle, ...col.style, ...col.cellStyle }),
    textAlign: col.align || 'left',
    wordBreak: 'break-word',
  };
}
