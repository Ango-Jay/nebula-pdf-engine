import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  platform: 'node',
  // This is the "Magic" — it tells the library how to handle JSX
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  // We bundle preact so the user doesn't have to install it
  external: ['sharp', 'resvg-js'], 
});