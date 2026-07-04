declare module 'pdf-lib-table' {
  import { PDFDocument, RGB, PDFPage } from 'pdf-lib';
  
  export default class PDFTableLib {
    constructor(pdfDoc: PDFDocument);
    createTable(options: TableOptions): PDFTableInstance;
  }
  
  export interface TableOptions {
    data: string[][];
    startX?: number;
    startY?: number;
    columnWidths?: number[];
    headerColor?: RGB;
    headerTextColor?: RGB;
    borderColor?: RGB;
    borderWidth?: number;
    cellPadding?: number;
    striped?: boolean;
    stripeColor?: RGB;
  }
  
  export interface PDFTableInstance {
    draw(): Promise<void>;
  }
}