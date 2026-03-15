import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import type { StickerItem } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDoc = any;

// ─── Constants ──────────────────────────────────────────────────────────────

export const TOTAL_USER_STICKERS = 16; // 4 × 4 grid for user content
const BRAND_URL = 'https://puzzle-khaki-six.vercel.app/';

// ─── Sticker Sheet Layout (all values in PDF points: 1 inch = 72 pt) ────────

const SHEET = {
  pageWidth: 612,        // 8.5"
  pageHeight: 792,       // 11"

  columns: 4,
  rows: 5,              // 4 user rows + 1 branding row

  labelWidth: 144,       // 2"
  labelHeight: 144,      // 2"
  cornerRadius: 4.5,     // 0.0625"

  topMargin: 18,         // 0.25"
  leftMargin: 18,        // 0.25"

  hPitch: 144,           // 2"
  vPitch: 153,           // 2.125"
} as const;

// ─── Rounded-rect SVG path ──────────────────────────────────────────────────

function roundedRectPath(
  x: number, y: number, w: number, h: number, r: number
): string {
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

// ─── Fetch image as Buffer (handles URLs and data-URLs) ─────────────────────

async function getImageBuffer(imageData: string): Promise<Buffer> {
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    const res = await fetch(imageData);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
  if (imageData.startsWith('data:')) {
    return Buffer.from(imageData.split(',')[1], 'base64');
  }
  return Buffer.from(imageData, 'base64');
}

// ─── Draw one sticker label ─────────────────────────────────────────────────

async function drawStickerLabel(
  doc: PDFDoc,
  item: StickerItem,
  col: number,
  row: number,
): Promise<void> {
  const x = SHEET.leftMargin + col * SHEET.hPitch;
  const y = SHEET.topMargin + row * SHEET.vPitch;
  const w = SHEET.labelWidth;
  const h = SHEET.labelHeight;
  const r = SHEET.cornerRadius;

  const rr = roundedRectPath(x, y, w, h, r);

  // Light cut-line border
  doc.save();
  doc.path(rr).lineWidth(0.25).dash(2, { space: 2 }).stroke('#CCCCCC');
  doc.restore();

  if (item.imageData) {
    try {
      const imgBuf = await getImageBuffer(item.imageData);
      doc.save();
      doc.path(rr).clip();
      doc.image(imgBuf, x, y, {
        fit: [w, h],
        align: 'center',
        valign: 'center',
      });
      doc.restore();
    } catch (err) {
      console.error(`Error embedding sticker image #${item.id}:`, err);
      drawEmptyLabel(doc, x, y, w, h, rr, 'Image error');
    }
  } else {
    drawEmptyLabel(doc, x, y, w, h, rr, item.prompt || `#${item.id}`);
  }
}

function drawEmptyLabel(
  doc: PDFDoc,
  x: number, y: number, w: number, h: number,
  clipPath: string,
  label: string,
): void {
  doc.save();
  doc.path(clipPath).clip();
  doc.rect(x, y, w, h).fill('#FAFAFA');
  doc.font('Helvetica').fontSize(9).fillColor('#BBBBBB');
  const tw = doc.widthOfString(label);
  const maxW = w - 10;
  if (tw > maxW) {
    doc.text(label, x + 5, y + h / 2 - 5, { width: maxW, lineBreak: false, ellipsis: true });
  } else {
    doc.text(label, x + (w - tw) / 2, y + h / 2 - 5, { lineBreak: false });
  }
  doc.restore();
}

// ─── Branding Row (row index 4 = bottom row) ────────────────────────────────

async function drawBrandingRow(doc: PDFDoc, sheetTitle: string): Promise<void> {
  const row = 4;

  // ── Slot 1: Brand name ──
  {
    const col = 0;
    const x = SHEET.leftMargin + col * SHEET.hPitch;
    const y = SHEET.topMargin + row * SHEET.vPitch;
    const w = SHEET.labelWidth;
    const h = SHEET.labelHeight;
    const r = SHEET.cornerRadius;
    const rr = roundedRectPath(x, y, w, h, r);

    doc.save();
    doc.path(rr).lineWidth(0.25).dash(2, { space: 2 }).stroke('#CCCCCC');
    doc.restore();

    doc.save();
    doc.path(rr).clip();
    doc.rect(x, y, w, h).fill('#FFFFFF');
    doc.font('Helvetica-Bold').fillColor('#333333');

    doc.fontSize(15);
    doc.text('Japanese Learning Stickers', x + 8, y + 26, {
      width: w - 16,
      align: 'center',
    });

    doc.fontSize(10).fillColor('#666666');
    doc.text('Puzzle:', x + 10, y + 74, {
      width: w - 20,
      align: 'center',
      lineBreak: false,
    });

    doc.fontSize(13).fillColor('#111111');
    doc.text(sheetTitle || 'Untitled Sticker Sheet', x + 10, y + 90, {
      width: w - 20,
      align: 'center',
      ellipsis: true,
      height: 32,
    });
    doc.restore();
  }

  // ── Slot 2: QR Code + "Need more paper?" ──
  {
    const col = 1;
    const x = SHEET.leftMargin + col * SHEET.hPitch;
    const y = SHEET.topMargin + row * SHEET.vPitch;
    const w = SHEET.labelWidth;
    const h = SHEET.labelHeight;
    const r = SHEET.cornerRadius;
    const rr = roundedRectPath(x, y, w, h, r);

    doc.save();
    doc.path(rr).lineWidth(0.25).dash(2, { space: 2 }).stroke('#CCCCCC');
    doc.restore();

    doc.save();
    doc.path(rr).clip();
    doc.rect(x, y, w, h).fill('#FFFFFF');

    // "Need more paper?" label above QR
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333');
    doc.text('Need more paper?', x, y + 8, { width: w, align: 'center', lineBreak: false });

    // Generate QR code as PNG buffer
    try {
      const qrBuffer = await QRCode.toBuffer(BRAND_URL, {
        type: 'png',
        width: 300,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      const qrSize = 90;
      const qrX = x + (w - qrSize) / 2;
      const qrY = y + 28;
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    } catch (err) {
      console.error('QR code generation failed:', err);
      doc.font('Helvetica').fontSize(8).fillColor('#999999');
      doc.text('(QR code)', x, y + h / 2 - 5, { width: w, align: 'center', lineBreak: false });
    }

    // URL below QR
    doc.font('Helvetica').fontSize(6).fillColor('#888888');
    doc.text(BRAND_URL, x, y + h - 18, { width: w, align: 'center', lineBreak: false });

    doc.restore();
  }

  // ── Slot 3: Website URL ──
  {
    const col = 2;
    const x = SHEET.leftMargin + col * SHEET.hPitch;
    const y = SHEET.topMargin + row * SHEET.vPitch;
    const w = SHEET.labelWidth;
    const h = SHEET.labelHeight;
    const r = SHEET.cornerRadius;
    const rr = roundedRectPath(x, y, w, h, r);

    doc.save();
    doc.path(rr).lineWidth(0.25).dash(2, { space: 2 }).stroke('#CCCCCC');
    doc.restore();

    doc.save();
    doc.path(rr).clip();
    doc.rect(x, y, w, h).fill('#FFFFFF');

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#333333');
    doc.text('Visit us at:', x, y + h / 2 - 22, { width: w, align: 'center', lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#2563EB');
    doc.text(BRAND_URL, x + 4, y + h / 2, { width: w - 8, align: 'center', lineBreak: false });

    doc.restore();
  }

  // ── Slot 4: Smiley Face ──
  {
    const col = 3;
    const x = SHEET.leftMargin + col * SHEET.hPitch;
    const y = SHEET.topMargin + row * SHEET.vPitch;
    const w = SHEET.labelWidth;
    const h = SHEET.labelHeight;
    const r = SHEET.cornerRadius;
    const rr = roundedRectPath(x, y, w, h, r);

    doc.save();
    doc.path(rr).lineWidth(0.25).dash(2, { space: 2 }).stroke('#CCCCCC');
    doc.restore();

    doc.save();
    doc.path(rr).clip();
    doc.rect(x, y, w, h).fill('#FFFFFF');

    // Draw a smiley face using vector drawing
    const cx = x + w / 2;
    const cy = y + h / 2;
    const faceR = 45;

    // Face circle — yellow fill
    doc.circle(cx, cy, faceR).fill('#FFD93D');
    doc.circle(cx, cy, faceR).lineWidth(2).stroke('#E6A800');

    // Left eye
    doc.circle(cx - 15, cy - 12, 5).fill('#333333');
    // Right eye
    doc.circle(cx + 15, cy - 12, 5).fill('#333333');

    // Smile — bezier curve
    doc.save();
    doc.lineWidth(3).strokeColor('#333333');
    doc.moveTo(cx - 22, cy + 8);
    doc.bezierCurveTo(cx - 12, cy + 28, cx + 12, cy + 28, cx + 22, cy + 8);
    doc.stroke();
    doc.restore();

    doc.restore();
  }
}

// ─── Main: generate a full sticker sheet PDF ────────────────────────────────

export async function generateStickerSheetPDF(
  items: StickerItem[],
  title = 'Untitled Sticker Sheet',
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [SHEET.pageWidth, SHEET.pageHeight],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: { Title: 'Sticker Sheet', Author: 'Japanese Learning Stickers' },
  });

  const chunks: Uint8Array[] = [];
  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  // Lay out 16 user items (4 cols × 4 rows)
  for (let i = 0; i < TOTAL_USER_STICKERS; i++) {
    const col = i % SHEET.columns;
    const row = Math.floor(i / SHEET.columns);

    if (i < items.length && (items[i].imageData || items[i].prompt)) {
      await drawStickerLabel(doc, items[i], col, row);
    }
  }

  // Draw branding row (row 4)
  await drawBrandingRow(doc, title);

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

// ─── Font Management ─────────────────────────────────────────────────────────

function getJapaneseFontPath(): string | null {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansJP-Regular.ttf');
  if (fs.existsSync(fontPath)) return fontPath;
  return null;
}

// ─── Word Sheet PDF ─────────────────────────────────────────────────────────
//
// 4 rows × 4 cols = 16 word labels (matching the 16 user stickers).
// With only 4 rows, we spread them out with a generous gap for large
// peek/answer text underneath each label row.

const WORD_ROWS = 4;
const WORD_SHEET_TOP_MARGIN = 10;
const WORD_SHEET_V_PITCH = 172; // 28pt gap below each 144pt label

function drawWordLabel(
  doc: PDFDoc,
  text: string,
  col: number,
  row: number,
  hasJapaneseFont: boolean,
): void {
  const x = SHEET.leftMargin + col * SHEET.hPitch;
  const y = WORD_SHEET_TOP_MARGIN + row * WORD_SHEET_V_PITCH;
  const w = SHEET.labelWidth;
  const h = SHEET.labelHeight;
  const r = SHEET.cornerRadius;

  const rr = roundedRectPath(x, y, w, h, r);

  // Draw a light rounded-rect border
  doc.save();
  doc.path(rr).lineWidth(0.5).stroke('#CCCCCC');
  doc.restore();

  if (!text) return;

  // ── Main text — bold, centered in label ──
  if (hasJapaneseFont) doc.font('NotoSansJP');
  else doc.font('Helvetica-Bold');

  let fontSize = 28;
  doc.fontSize(fontSize);
  let tw = doc.widthOfString(text);
  const maxW = w - 16;

  if (tw > maxW) {
    fontSize = fontSize * (maxW / tw);
    fontSize = Math.max(fontSize, 10);
    doc.fontSize(fontSize);
    tw = doc.widthOfString(text);
  }

  doc.save();
  doc.path(rr).clip();
  doc.fillColor('#111111');
  const cy = y + (h - fontSize) / 2;
  doc.text(text, x, cy, { width: w, align: 'center', lineBreak: false });
  doc.restore();

  // ── Peek text BELOW the label — large bold black in the 28pt gap ──
  const gapSize = WORD_SHEET_V_PITCH - SHEET.labelHeight; // 28pt
  const peekFontSize = 16;
  doc.save();
  if (hasJapaneseFont) doc.font('NotoSansJP');
  else doc.font('Helvetica-Bold');
  doc.fontSize(peekFontSize);
  doc.fillColor('#000000');
  const gapTop = y + h;
  const peekH = doc.currentLineHeight();
  const scy = gapTop + (gapSize - peekH) / 2;
  doc.text(text, x, scy, { width: w, align: 'center', lineBreak: false });
  doc.restore();
}

export async function generateWordSheetPDF(
  items: StickerItem[],
  shuffledOrder?: number[],
  title = 'Untitled Sticker Sheet',
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [SHEET.pageWidth, SHEET.pageHeight],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: { Title: 'Word Sheet', Author: 'Japanese Learning Stickers' },
  });

  const chunks: Uint8Array[] = [];
  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  // Register Japanese font
  const fontPath = getJapaneseFontPath();
  if (fontPath) doc.registerFont('NotoSansJP', fontPath);

  // Build the order array for 16 slots
  const totalSlots = SHEET.columns * WORD_ROWS; // 16
  const order = shuffledOrder && shuffledOrder.length === totalSlots
    ? shuffledOrder
    : Array.from({ length: totalSlots }, (_, i) => i);

  for (let slot = 0; slot < totalSlots; slot++) {
    const col = slot % SHEET.columns;
    const row = Math.floor(slot / SHEET.columns);
    const srcIdx = order[slot];
    const text = srcIdx < items.length ? (items[srcIdx].japaneseLabel || '') : '';
    drawWordLabel(doc, text, col, row, fontPath !== null);
  }

  // ── Puzzle name + branding footer ──
  const footerY = WORD_SHEET_TOP_MARGIN + WORD_ROWS * WORD_SHEET_V_PITCH + 10;
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#222222');
  doc.text(
    title || 'Untitled Sticker Sheet',
    SHEET.leftMargin,
    footerY,
    { width: SHEET.pageWidth - SHEET.leftMargin * 2, align: 'center', lineBreak: false },
  );

  doc.font('Helvetica').fontSize(9).fillColor('#AAAAAA');
  doc.text(
    'Japanese Learning Stickers  •  ' + BRAND_URL,
    SHEET.leftMargin,
    footerY + 16,
    { width: SHEET.pageWidth - SHEET.leftMargin * 2, align: 'center', lineBreak: false },
  );

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
