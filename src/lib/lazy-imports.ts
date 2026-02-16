// Lazy loading untuk dependencies berat

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
export const captureElementAsImage = async (element: HTMLElement, options?: any) => {
  const htmlToImage = await import('html-to-image');
  return htmlToImage.toPng(element, options);
};

export const captureElementAsCanvas = async (element: HTMLElement, options?: any) => {
  const html2canvas = await import('html2canvas');
  return html2canvas.default(element, options);
};

export const generatePDF = async (content: any, options?: any) => {
  const jsPDF = await import('jspdf');
  const doc = new jsPDF.jsPDF(options);
  // Add content to PDF
  return doc;
};

export const generateExcel = async (data: any[], options?: any) => {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};