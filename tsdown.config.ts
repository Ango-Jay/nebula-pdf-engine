import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  platform: 'node',
  // We bundle preact so the user doesn't have to install it

  // Keep Sharp, Resvg, and NestJS external
  external: [
    'sharp', 
    '@resvg/resvg-js', 
    '@nestjs/common', 
    '@nestjs/core', 
    'reflect-metadata'
  ],
});