/**
 * Professional PDF Generator using pdfmake & pdf-lib
 * Provides multiple professional templates for PDF generation
 */

const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

class ProfessionalPDFGenerator {
  constructor() {
    this.defaultFont = 'Roboto';
  }

  /**
   * Generate PDF using pdfmake (declarative JSON approach)
   */
  async generateWithPdfMake(title, content, options = {}) {
    const { author = 'Aartiq', category = 'Report', iconBase64 = null } = options;
    
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      content: this.buildPdfMakeContent(title, content, options),
      styles: this.getPdfMakeStyles(),
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11,
        lineHeight: 1.5
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `© ${new Date().getFullYear()} Aartiq Browser`, fontSize: 8, color: '#666' },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8, color: '#666', alignment: 'right' }
        ],
        margin: [40, 10, 40, 0]
      }),
      header: (currentPage, pageCount) => {
        if (currentPage === 1) return { text: '' };
        return {
          text: title,
          fontSize: 10,
          color: '#38bdf8',
          margin: [40, 20, 40, 0],
          alignment: 'left'
        };
      }
    };

    return new Promise((resolve, reject) => {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.getBuffer((buffer) => {
        resolve(buffer);
      });
    });
  }

  /**
   * Generate PDF using pdf-lib (programmatic approach)
   */
  async generateWithPdfLib(title, content, options = {}) {
    const { author = 'Aartiq', category = 'Report', iconBase64 = null } = options;
    
    const pdfDoc = await PDFDocument.create();
    this.pdfDoc = pdfDoc;
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    
    // Cover page
    this.drawCoverPagePdfLib(page, title, category, helveticaBold, helveticaFont);
    
    // Content page
    page = pdfDoc.addPage([595.28, 841.89]);
    this.drawContentPdfLib(page, content, helveticaFont, helveticaBold);
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  drawCoverPagePdfLib(page, title, category, boldFont, regularFont) {
    const { width, height } = page.getSize();
    
    // Background gradient (simulated with rectangle)
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.059, 0.09, 0.165) // #0f172a
    });
    
    // Cyan accent line
    page.drawRectangle({
      x: 40,
      y: height - 120,
      width: width - 80,
      height: 2,
      color: rgb(0.22, 0.74, 0.97) // #38bdf8
    });
    
    // Title
    page.drawText(title, {
      x: 40,
      y: height - 200,
      size: 28,
      font: boldFont,
      color: rgb(1, 1, 1)
    });
    
    // Category
    page.drawText(category, {
      x: 40,
      y: height - 240,
      size: 14,
      font: regularFont,
      color: rgb(0.58, 0.64, 0.72) // #94a3b8
    });
    
    // Footer info
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: 40,
      y: 80,
      size: 10,
      font: regularFont,
      color: rgb(0.58, 0.64, 0.72)
    });
    
    page.drawText('Aartiq Browser - Premium AI Browser', {
      x: 40,
      y: 60,
      size: 12,
      font: boldFont,
      color: rgb(0.22, 0.74, 0.97)
    });
  }

  drawContentPdfLib(page, content, regularFont, boldFont) {
    const { width, height } = page.getSize();
    const margin = 40;
    const contentWidth = width - margin * 2;
    let y = height - margin;
    
    // Simple content rendering - split by paragraphs
    const paragraphs = content.split('\n\n');
    
    for (const para of paragraphs) {
      const lines = this.wrapText(para, regularFont, 11, contentWidth);
      for (const line of lines) {
        if (y < margin + 20) {
          page = this.addNewPage(this.pdfDoc, boldFont, regularFont);
          y = height - margin;
        }
        page.drawText(line, {
          x: margin,
          y,
          size: 11,
          font: regularFont,
          color: rgb(0.067, 0.098, 0.153)
        });
        y -= 16;
      }
      y -= 12;
    }
  }

  addNewPage(pdfDoc, boldFont, regularFont) {
    return pdfDoc.addPage([595.28, 841.89]);
  }

  wrapText(text, font, fontSize, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  buildPdfMakeContent(title, content, options) {
    const { author = 'Aartiq', category = 'Report', tags = [] } = options;
    const contentBlocks = [];
    
    // Cover page
    contentBlocks.push(
      {
        stack: [
          { text: '', margin: [0, 0, 0, 80] },
          { 
            text: 'Aartiq', 
            style: 'brandTitle',
            color: '#38bdf8'
          },
          { 
            text: 'Premium AI Browser', 
            fontSize: 10,
            color: '#94a3b8',
            margin: [0, 4, 0, 40]
          },
          { text: title, style: 'coverTitle', margin: [0, 0, 0, 12] },
          { text: category, style: 'coverSubtitle', margin: [0, 0, 0, 40] },
          {
            columns: [
              { text: `Generated: ${new Date().toLocaleDateString()}`, fontSize: 9, color: '#94a3b8' },
              { text: `ID: CMT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, fontSize: 9, color: '#94a3b8', alignment: 'right' }
            ],
            margin: [0, 0, 0, 20]
          }
        ],
        pageBreak: 'after'
      }
    );
    
    // Content
    const paragraphs = content.split('\n').filter(p => p.trim());
    for (const para of paragraphs) {
      contentBlocks.push({
        text: para,
        margin: [0, 0, 0, 8]
      });
    }
    
    return contentBlocks;
  }

  getPdfMakeStyles() {
    return {
      brandTitle: {
        fontSize: 24,
        bold: true,
        color: '#38bdf8'
      },
      coverTitle: {
        fontSize: 32,
        bold: true,
        color: '#0f172a'
      },
      coverSubtitle: {
        fontSize: 14,
        color: '#64748b'
      },
      header: {
        fontSize: 14,
        bold: true,
        color: '#0f172a'
      },
      subheader: {
        fontSize: 12,
        bold: true,
        color: '#1e293b'
      },
      body: {
        fontSize: 11,
        color: '#334155'
      }
    };
  }

  /**
   * Legacy HTML-based generation (kept for compatibility)
   */
  async generateHTML(title, content, options = {}) {
    const { iconBase64 = null } = options;
    return this.generateHTMLTemplate(title, content, iconBase64);
  }

  generateHTMLTemplate(title, content, iconBase64) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1e293b; padding: 40px; background: #fff; }
    .cover { background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); color: #fff; padding: 60px 50px; min-height: 88vh; page-break-after: always; }
    .brand { font-size: 24px; font-weight: 700; color: #38bdf8; margin-bottom: 4px; }
    .tagline { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 40px; }
    h1 { font-size: 32px; font-weight: 700; margin-bottom: 12px; }
    .category { font-size: 14px; color: #94a3b8; margin-bottom: 40px; }
    .meta { display: flex; gap: 20px; font-size: 12px; color: #94a3b8; }
    .content { margin-top: 30px; }
    .content p { margin-bottom: 12px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @page { margin: 14mm 14mm 16mm 14mm; size: A4; }
  </style>
</head>
<body>
  <section class="cover">
    <div class="brand">Aartiq</div>
    <div class="tagline">Premium AI Browser</div>
    <h1>${title}</h1>
    <div class="category">Intelligence Report</div>
    <div class="meta">
      <span>Generated: ${new Date().toLocaleDateString()}</span>
      <span>ID: CMT-${Math.random().toString(36).slice(2, 8).toUpperCase()}</span>
    </div>
  </section>
  <div class="content">${content}</div>
  <div class="footer">
    <span>© ${new Date().getFullYear()} Aartiq Browser</span>
    <span>AI Generated</span>
  </div>
</body>
</html>`;
  }
}

module.exports = new ProfessionalPDFGenerator();
