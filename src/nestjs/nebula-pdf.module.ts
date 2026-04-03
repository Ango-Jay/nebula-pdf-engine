import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { NebulaPdfService } from './nebula-pdf.service';
import { NEBULA_PDF_OPTIONS } from './nebula-pdf.constants';
import type {
  NebulaPdfModuleOptions,
  NebulaPdfModuleAsyncOptions,
  NebulaPdfModuleOptionsFactory,
} from './nebula-pdf.interfaces';

@Global()
@Module({
  providers: [NebulaPdfService],
  exports: [NebulaPdfService],
})
export class NebulaPdfModule {
  static forRoot(options: NebulaPdfModuleOptions): DynamicModule {
    return {
      module: NebulaPdfModule,
      providers: [
        {
          provide: NEBULA_PDF_OPTIONS,
          useValue: options,
        },
      ],
    };
  }

  static forRootAsync(options: NebulaPdfModuleAsyncOptions): DynamicModule {
    return {
      module: NebulaPdfModule,
      imports: options.imports || [],
      providers: [...this.createAsyncProviders(options)],
    };
  }

  private static createAsyncProviders(options: NebulaPdfModuleAsyncOptions): Provider[] {
    if (options.useFactory || options.useExisting) {
      return [this.createAsyncOptionsProvider(options)];
    }

    const useClass = options.useClass as any;

    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(options: NebulaPdfModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: NEBULA_PDF_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    const inject = [options.useExisting || options.useClass].filter(Boolean) as any[];

    return {
      provide: NEBULA_PDF_OPTIONS,
      useFactory: async (optionsFactory: NebulaPdfModuleOptionsFactory) =>
        await optionsFactory.createNebulaPdfOptions(),
      inject,
    };
  }
}
