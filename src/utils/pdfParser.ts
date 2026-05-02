// PDF parsing utility for browser environment using PDF.js
import * as pdfjsLib from 'pdfjs-dist';

// Set up the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export class PDFParser {
  /**
   * Parse a PDF from base64-encoded content and extract all text.
   * @param base64PDF - The base64-encoded PDF content
   * @returns Extracted text from all pages
   */
  static async parsePDF(base64PDF: string): Promise<string> {
    try {
      // Decode base64 to binary array
      const binaryString = atob(base64PDF);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: bytes,
        useSystemFonts: true,
      });
      const pdf = await loadingTask.promise;

      console.log(`PDF loaded: ${pdf.numPages} pages`);

      // Extract text from all pages
      const textParts: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine all text items with proper spacing
          const pageText = textContent.items
            .map((item: any) => {
              if ('str' in item) {
                return item.str;
              }
              return '';
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (pageText.length > 0) {
            textParts.push(pageText);
          }
        } catch (pageError) {
          console.error(`Error extracting text from page ${pageNum}:`, pageError);
          // Continue with other pages
        }
      }

      const fullText = textParts.join('\n\n');

      if (fullText.trim().length === 0) {
        console.warn('PDF parsed but no text content was extracted. The PDF may contain only images.');
        return 'This PDF appears to contain only images or non-extractable content.';
      }

      console.log(`Extracted ${fullText.length} characters from PDF`);
      return fullText;

    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF file: ${(error as Error).message}`);
    }
  }
}
