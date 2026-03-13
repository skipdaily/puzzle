import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { englishText } = await request.json();

    if (!englishText || typeof englishText !== 'string') {
      return NextResponse.json(
        { error: 'englishText is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY not configured. Set it in .env.local' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a Japanese language translator. Translate the given English word or phrase to Japanese. Return ONLY a JSON object (no markdown, no code fences) with these fields:
- "kana": the word in hiragana/katakana (use katakana for foreign words, hiragana for native Japanese words)
- "kanji": the word in kanji if applicable (empty string if no kanji exists)
- "romaji": the romanized pronunciation

Example for "fox": {"kana": "きつね", "kanji": "狐", "romaji": "kitsune"}
Example for "coffee": {"kana": "コーヒー", "kanji": "", "romaji": "koohii"}
Example for "mountain": {"kana": "やま", "kanji": "山", "romaji": "yama"}

Translate: ${englishText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });

    const content = response.text;

    if (!content) {
      return NextResponse.json(
        { error: 'No response from translation API' },
        { status: 500 }
      );
    }

    // Strip markdown code fences if present
    const cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const result = JSON.parse(cleaned);

    return NextResponse.json({
      kana: result.kana || '',
      kanji: result.kanji || '',
      romaji: result.romaji || '',
    });
  } catch (error) {
    console.error('Translation error:', error);
    const message = error instanceof Error ? error.message : 'Translation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
