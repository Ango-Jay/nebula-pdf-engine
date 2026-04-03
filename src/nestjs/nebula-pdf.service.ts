import { Injectable, Inject } from '@nestjs/common';
import { PdfEngine } from '../core/engine';
import { NEBULA_PDF_OPTIONS } from './nebula-pdf.constants';
import type { NebulaPdfModuleOptions } from './nebula-pdf.interfaces';
import type { VNode } from 'preact';
import type { GenerateOptions } from '../core/engine';

@Injectable()
export class NebulaPdfService {
  private readonly engine: PdfEngine;

  constructor(
    @Inject(NEBULA_PDF_OPTIONS) private readonly options: NebulaPdfModuleOptions,
  ) {
    this.engine = new PdfEngine(options);
  }

  async generate(
    element: VNode,
    options?: GenerateOptions,
  ): Promise<Buffer> {
    return this.engine.generate(element, options);
  }
}
