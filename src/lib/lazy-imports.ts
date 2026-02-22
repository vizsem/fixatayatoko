// Lazy loading untuk dependencies berat

interface HtmlToImageOptions {
  backgroundColor?: string;
  width?: number;
  height?: number;
  style?: Record<string, string>;
  filter?: (node: HTMLElement) => boolean;
}

interface Html2CanvasOptions {
  backgroundColor?: string | null;
  scale?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  scrollX?: number;
  scrollY?: number;
  useCORS?: boolean;
  allowTaint?: boolean;
}

interface JsPDFOptions {
  orientation?: 'p' | 'portrait' | 'l' | 'landscape';
  unit?: 'pt' | 'mm' | 'cm' | 'in';
  format?: 'a0' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8' | 'a9' | 'a10' | 'b0' | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8' | 'b9' | 'b10' | 'c0' | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8' | 'c9' | 'c10' | 'dl' | 'letter' | 'government-letter' | 'legal' | 'junior-legal' | 'ledger' | 'tabloid' | 'credit-card' | [number, number];
  compress?: boolean;
  precision?: number;
  filters?: string[];
  putOnlyUsedFonts?: boolean;
  hotfixes?: string[];
}

interface ExcelOptions {
  type?: 'buffer' | 'binary' | 'base64' | 'string' | 'file';
  bookType?: 'xlsx' | 'xlsm' | 'xlsb' | 'xls' | 'csv' | 'txt' | 'ods' | 'fods';
  compression?: boolean;
}

export const lazyImport = <T>(importFn: () => Promise<T>) => {
  let promise: Promise<T> | null = null;
  
  return () => {
    if (!promise) {
      promise = importFn().catch(err => {
        promise = null;
        throw err;
      });
    }
    return promise;
  };
};

// Utility functions dengan lazy loading
export const captureElementAsImage = async (element: HTMLElement, options?: HtmlToImageOptions) => {
  const htmlToImage = await import('html-to-image');
  return htmlToImage.toPng(element, options);
};

export const captureElementAsCanvas = async (element: HTMLElement, options?: Html2CanvasOptions) => {
  const html2canvas = await import('html2canvas');
  return html2canvas.default(element, options);
};

export const generatePDF = async (content: unknown, options?: JsPDFOptions) => {
  const jsPDF = await import('jspdf');
  const doc = new jsPDF.jsPDF(options);
  // Add content to PDF
  return doc;
};

export const generateExcel = async (data: unknown[], options?: ExcelOptions) => {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', ...options });
};