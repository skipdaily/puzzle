import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import {
  LAYOUT,
  leftPiecePath,
  rightPiecePath,
  connectorPath,
  puzzlePositions,
} from './puzzle-shapes';
import type { PuzzleEntry, PuzzleSideData, PageSize } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDoc = any;

// ─── Font Management ─────────────────────────────────────────────────────────

function getFontPath(): string | null {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansJP-Regular.ttf');
  if (fs.existsSync(fontPath)) return fontPath;
  return null;
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

export async function generatePuzzlePDF(
  entries: PuzzleEntry[],
  pageSize: PageSize = 'letter'
): Promise<Buffer> {
  const page = pageSize === 'a4' ? LAYOUT.A4 : LAYOUT.LETTER;

  const doc = new PDFDocument({
    size: [page.width, page.height],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: { Title: 'Vocabulary Puzzle', Author: 'Puzzle Generator' },
  });

  const chunks: Uint8Array[] = [];
  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  // Register Japanese font
  const fontPath = getFontPath();
  if (fontPath) doc.registerFont('NotoSansJP', fontPath);

  const positions = puzzlePositions(page.height, page.width);

  // FRONT page
  for (let i = 0; i < 3; i++) {
    const entry = entries[i];
    const pos   = positions[i];
    if (!entry) continue;
    const side = entry.front;
    const seed = entry.templateIndex ?? i;

    // Left piece: Japanese word
    drawLeftPiece(doc, pos.leftX, pos.y, pos.w, pos.h, side, fontPath !== null, seed);

    // Right piece: image
    await drawRightPiece(doc, pos.rightX, pos.y, pos.w, pos.h, side, seed);

    // Connector cut line (vertical shape between left/right)
    const cx = pos.leftX + pos.w; // connector x = boundary between pieces
    doc.save();
    doc.path(connectorPath(cx, pos.y, pos.h, seed))
      .lineWidth(LAYOUT.STROKE_WIDTH)
      .stroke(LAYOUT.STROKE_COLOR);
    doc.restore();
  }

  // Horizontal divider lines between rows (only between, not at top/bottom)
  for (let i = 1; i < 3; i++) {
    const divY = positions[i].y;
    doc.save();
    doc.moveTo(0, divY).lineTo(page.width, divY)
      .lineWidth(LAYOUT.STROKE_WIDTH)
      .stroke(LAYOUT.STROKE_COLOR);
    doc.restore();
  }

  // BACK page (mirrored for duplex alignment)
  doc.addPage({
    size: [page.width, page.height],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await drawBackPage(doc, entries, positions, page.width, fontPath !== null);

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

// ─── Draw Back Page (duplex) ────────────────────────────────────────────────

async function drawBackPage(
  doc: PDFDoc,
  entries: PuzzleEntry[],
  positions: ReturnType<typeof puzzlePositions>,
  pageWidth: number,
  hasJapaneseFont: boolean,
): Promise<void> {
  // Mirror horizontally so front/back cut lines align when printed duplex.
  doc.save();
  doc.translate(pageWidth, 0);
  doc.scale(-1, 1);

  for (let i = 0; i < 3; i++) {
    const entry = entries[i];
    const pos = positions[i];
    if (!entry) continue;

    const side = entry.back;
    const seed = entry.templateIndex ?? i;
    drawLeftBackPiece(doc, pos.leftX, pos.y, pos.w, pos.h, side, hasJapaneseFont, seed);
    await drawRightBackPiece(doc, pos.rightX, pos.y, pos.w, pos.h, side, seed);

    // Connector cut line
    const cx = pos.leftX + pos.w;
    doc.save();
    doc.path(connectorPath(cx, pos.y, pos.h, seed))
      .lineWidth(LAYOUT.STROKE_WIDTH)
      .stroke(LAYOUT.STROKE_COLOR);
    doc.restore();
  }

  // Horizontal dividers (inside the mirrored context)
  for (let i = 1; i < 3; i++) {
    const divY = positions[i].y;
    doc.save();
    doc.moveTo(0, divY).lineTo(pageWidth, divY)
      .lineWidth(LAYOUT.STROKE_WIDTH)
      .stroke(LAYOUT.STROKE_COLOR);
    doc.restore();
  }

  doc.restore();
}

// ─── Draw Left (Word) Piece ──────────────────────────────────────────────────

function drawLeftPiece(
  doc: PDFDoc,
  x: number, y: number, w: number, h: number,
  side: PuzzleSideData,
  hasJapaneseFont: boolean,
  seed: number = 0
): void {
  const svgPath = leftPiecePath(x, y, w, h, seed);

  doc.save();
  doc.path(svgPath).fill(LAYOUT.FILL_COLOR);
  doc.restore();

  const text = side.japaneseText || side.kanjiText || '?';
  if (hasJapaneseFont) doc.font('NotoSansJP');
  else doc.font('Helvetica');

  // Clip text to the piece shape so it never overflows the connector edge
  doc.save();
  doc.path(svgPath).clip();
  drawCenteredText(doc, text, x, y, w, h);
  doc.restore();
}

function drawLeftBackPiece(
  doc: PDFDoc,
  x: number, y: number, w: number, h: number,
  side: PuzzleSideData,
  hasJapaneseFont: boolean,
  seed: number = 0
): void {
  const svgPath = leftPiecePath(x, y, w, h, seed);

  doc.save();
  doc.path(svgPath).fill(LAYOUT.FILL_COLOR);
  doc.restore();

  const text = side.japaneseText || side.kanjiText || '?';
  if (hasJapaneseFont) doc.font('NotoSansJP');
  else doc.font('Helvetica');

  doc.save();
  doc.path(svgPath).clip();
  // Counter-flip so text reads correctly on the mirrored back page
  const centerX = x + w / 2;
  doc.translate(centerX, 0);
  doc.scale(-1, 1);
  doc.translate(-centerX, 0);
  drawCenteredText(doc, text, x, y, w, h);
  doc.restore();
}

// ─── Draw Right (Image) Piece ─────────────────────────────────────────────────

async function drawRightPiece(
  doc: PDFDoc,
  x: number, y: number, w: number, h: number,
  side: PuzzleSideData,
  seed: number = 0
): Promise<void> {
  const svgPath = rightPiecePath(x, y, w, h, seed);

  doc.save();
  doc.path(svgPath).fill(LAYOUT.FILL_COLOR);
  doc.restore();

  if (side.imageData) {
    try {
      const imageBuffer = await getImageBuffer(side.imageData);

      doc.save();
      doc.path(svgPath).clip();

      doc.image(imageBuffer, x, y, {
        fit: [w, h],
        align: 'center',
        valign: 'center',
      });

      doc.restore();
    } catch (err) {
      console.error('Error embedding image:', err);
      drawPlaceholder(doc, x, y, w, h, svgPath, 'Image error');
    }
  } else {
    drawPlaceholder(doc, x, y, w, h, svgPath, 'No image');
  }
}

async function drawRightBackPiece(
  doc: PDFDoc,
  x: number, y: number, w: number, h: number,
  side: PuzzleSideData,
  seed: number = 0
): Promise<void> {
  const svgPath = rightPiecePath(x, y, w, h, seed);

  doc.save();
  doc.path(svgPath).fill(LAYOUT.FILL_COLOR);
  doc.restore();

  if (side.imageData) {
    try {
      const imageBuffer = await getImageBuffer(side.imageData);

      doc.save();
      doc.path(svgPath).clip();

      // Counter-flip so image isn't mirrored on the back page
      const imgCenterX = x + w / 2;
      doc.translate(imgCenterX, 0);
      doc.scale(-1, 1);
      doc.translate(-imgCenterX, 0);

      doc.image(imageBuffer, x, y, {
        fit: [w, h],
        align: 'center',
        valign: 'center',
      });

      doc.restore();
    } catch (err) {
      console.error('Error embedding back image:', err);
      drawPlaceholder(doc, x, y, w, h, svgPath, 'Image error');
    }
  } else {
    drawPlaceholder(doc, x, y, w, h, svgPath, 'No image');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function drawCenteredText(
  doc: PDFDoc,
  text: string,
  px: number, py: number, pw: number, ph: number
): void {
  // Fit text horizontally (left to right), shrinking font if needed
  let fontSize = LAYOUT.JP_FONT_SIZE;
  doc.fontSize(fontSize);
  let tw = doc.widthOfString(text);

  // Shrink to fit within piece width with extra padding for connector edge
  const maxW = pw - 50;
  if (tw > maxW) {
    fontSize = fontSize * (maxW / tw);
    doc.fontSize(fontSize);
    tw = doc.widthOfString(text);
  }

  doc.fillColor('#111111');
  const cx = px + (pw - tw) / 2;
  const cy = py + (ph - fontSize) / 2;
  doc.text(text, cx, cy, { lineBreak: false });
}

function drawPlaceholder(
  doc: PDFDoc,
  x: number, y: number, w: number, h: number,
  svgPath: string,
  label: string
): void {
  doc.save();
  doc.path(svgPath).clip();
  doc.rect(x, y, w, h).fill('#F0F0F0');
  doc.font('Helvetica').fontSize(13).fillColor('#AAAAAA');
  const tw = doc.widthOfString(label);
  doc.text(label, x + (w - tw) / 2, y + h / 2 - 7, { lineBreak: false });
  doc.restore();
}


function dataUrlToBuffer(dataUrl: string): Buffer {
  if (dataUrl.startsWith('data:')) {
    return Buffer.from(dataUrl.split(',')[1], 'base64');
  }
  return Buffer.from(dataUrl, 'base64');
}

async function getImageBuffer(imageData: string): Promise<Buffer> {
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    const res = await fetch(imageData);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
  return dataUrlToBuffer(imageData);
}
