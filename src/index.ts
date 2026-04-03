import 'reflect-metadata';

// Export the main engine
export { PdfEngine } from './core/engine';
export type { GenerateOptions } from './core/engine';

// Export the React Primitives
export { Page, Box, Text, Image } from './components/primitives';

// Core
export * from './core/engine';

// NestJS (Optional integration)
export * from './nestjs/nebula-pdf.module';
export * from './nestjs/nebula-pdf.service';
export * from './nestjs/nebula-pdf.interfaces';
export * from './nestjs/nebula-pdf.constants';


// Export Types for the user
export type {
  PageProps,
  BoxProps,
  TextProps,
  ImageProps,
  EngineConfig,
  FontConfig,
  ImageOptions,
  SatoriStyle,
  PageSize,
  Orientation,
  Padding,
} from './types';

// Export constants
export { PAGE_SIZES } from './types';