import { JSX as PreactJSX } from 'preact';

declare global {
  namespace JSX {
    interface Element extends PreactJSX.Element {}
    interface IntrinsicElements extends PreactJSX.IntrinsicElements {
      'table-internal': any;
    }
    interface ElementClass extends PreactJSX.ElementClass {}
    interface ElementAttributesProperty extends PreactJSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends PreactJSX.ElementChildrenAttribute {}
    interface LibraryManagedAttributes<Component, Props> extends PreactJSX.LibraryManagedAttributes<Component, Props> {}
  }
}