import { h, type FunctionalComponent } from 'preact';
import type { TableProps } from '../types';

/**
 * Renders a structured data table with automatic pagination support.
 * 
 * This component is a "Layout Primitive" — it doesn't render 
 * immediately into standard Box/Text nodes. Instead, it preserves 
 * its schema so the LayoutEngine can perform column resolution 
 * and repeat headers across page boundaries.
 * 
 * Usage:
 * ```tsx
 * const columns = [
 *   { header: 'Date', key: 'date', width: 80 },
 *   { header: 'Description', key: 'desc', flex: 1 },
 *   { header: 'Amount', key: 'amt', width: 100, align: 'right' }
 * ];
 * 
 * <Table columns={columns} data={transactions} options={{ stripe: true }} />
 * ```
 */
export const Table: FunctionalComponent<TableProps> = (_props) => {
  // The engine will intercept this component during its prepass.
  // We return a "marker" element that holds the props.
  return h('table-internal', { ..._props, children: [] });
};

Table.displayName = 'NebulaPdfTable';
