import { NextResponse } from 'next/server';
import { generatePuzzlePDF } from '@/lib/pdf-generator';
import type { PuzzleEntry, PageSize } from '@/lib/types';

export const runtime = 'nodejs';

// Increase body size limit for base64 images
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entries: PuzzleEntry[] = body.entries || [];
    const pageSize: PageSize = body.pageSize || 'letter';

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'At least one puzzle entry is required' },
        { status: 400 }
      );
    }

    // Ensure we have exactly 3 entries (pad with empty if needed)
    while (entries.length < 3) {
      entries.push({
        id: String.fromCharCode(65 + entries.length), // A, B, C
        templateIndex: entries.length,
        front: {
          englishLabel: '',
          japaneseText: '',
          kanjiText: '',
          romaji: '',
          imagePrompt: '',
          imageData: '',
        },
        back: {
          englishLabel: '',
          japaneseText: '',
          kanjiText: '',
          romaji: '',
          imagePrompt: '',
          imageData: '',
        },
      });
    }

    const pdfBuffer = await generatePuzzlePDF(entries.slice(0, 3), pageSize);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="vocabulary-puzzle.pdf"',
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    const message = error instanceof Error ? error.message : 'PDF generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
