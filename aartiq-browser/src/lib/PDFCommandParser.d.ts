export interface PDFCommand {
  type: 'pdf';
  options: {
    title?: string;
    subtitle?: string;
    author?: string;
    screenshot?: string;
  };
  timestamp: number;
}
