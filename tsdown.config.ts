import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  platform: 'node',
  
  // 1. Generate type declarations cleanly
  dts: {
    // Explicitly tells the type compiler NOT to inline raw code files from node_modules/preact
    compilerOptions: {
      skipLibCheck: true,
    }
  },

  deps: {
    neverBundle: [
      'sharp', 
      '@resvg/resvg-js', 
      '@nestjs/common', 
      '@nestjs/core', 
      'reflect-metadata',
      // Force the type processor to keep preact external in types
      'preact',
      'preact/jsx-runtime'
    ],
    
    alwaysBundle: [
      /^preact(\/.*)?$/
    ],
  },
});