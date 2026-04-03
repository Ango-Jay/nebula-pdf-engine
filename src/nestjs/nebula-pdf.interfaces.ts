import type { ModuleMetadata, Type } from '@nestjs/common';
import type { EngineConfig } from '../types';

export type NebulaPdfModuleOptions = EngineConfig;

export interface NebulaPdfModuleOptionsFactory {
  createNebulaPdfOptions(): Promise<NebulaPdfModuleOptions> | NebulaPdfModuleOptions;
}

export interface NebulaPdfModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useExisting?: Type<NebulaPdfModuleOptionsFactory>;
  useClass?: Type<NebulaPdfModuleOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<NebulaPdfModuleOptions> | NebulaPdfModuleOptions;
}
