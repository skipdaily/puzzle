import { NextResponse } from 'next/server';
import { generateStickerSheetPDF, generateWordSheetPDF } from '@/lib/sticker-pdf-generator';
import type { StickerItem } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: StickerItem[] = body.items || [];
    const pdfType: 'stickers' | 'words' = body.type || 'stickers';
    const shuffledOrder: number[] | undefined = body.shuffledOrder;
    const title: string = typeof body.title === 'string' ? body.title : 'Untitled Sticker Sheet';

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'At least one sticker item is required' },
        { status: 400 },
      );
    }

    let pdfBuffer: Buffer;
    let filename: string;

    if (pdfType === 'words') {
      // Word sheet — needs at least one Japanese label
      const withWords = items.filter((i) => i.japaneseLabel?.trim());
      if (withWords.length === 0) {
        return NextResponse.json(
          { error: 'No sticker items have Japanese labels yet' },
          { status: 400 },
        );
      }
      pdfBuffer = await generateWordSheetPDF(items, shuffledOrder, title);
      filename = 'word-sheet.pdf';
    } else {
      // Sticker sheet — needs at least one image
      const withImages = items.filter((i) => i.imageData);
      if (withImages.length === 0) {
        return NextResponse.json(
          { error: 'No sticker items have generated images yet' },
          { status: 400 },
        );
      }
      pdfBuffer = await generateStickerSheetPDF(items, title);
      filename = 'sticker-sheet.pdf';
    }

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('Sticker PDF generation error:', error);
    const message = error instanceof Error ? error.message : 'Sticker PDF generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
