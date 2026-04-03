import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  platform: 'node',
  // Use Preact's automatic JSX runtime
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  // We bundle preact so the user doesn't have to install it
  // Keep Sharp and Resvg external (native C++ addons)
  external: ['sharp', '@resvg/resvg-js'],
});