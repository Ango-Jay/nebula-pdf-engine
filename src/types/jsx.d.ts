import { JSX as PreactJSX } from 'preact';

declare global {
  namespace JSX {
    interface IntrinsicElements extends PreactJSX.IntrinsicElements {}
    interface Element extends PreactJSX.Element {}
  }
}