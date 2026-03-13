export interface TranslationResult {
  kana: string;
  kanji?: string;
  romaji?: string;
}

export type PuzzleSideKey = 'front' | 'back';

export interface PuzzleSideData {
  englishLabel: string;
  japaneseText: string;
  kanjiText: string;
  romaji: string;
  imagePrompt: string;
  imageData: string; // base64 data URL
}

export interface PuzzleEntry {
  id: string; // 'A', 'B', 'C'
  templateIndex: number; // shared shape — one physical cutout
  front: PuzzleSideData;
  back: PuzzleSideData;
}

export interface ExportRequest {
  entries: PuzzleEntry[];
  pageSize: 'letter' | 'a4';
}

export type PageSize = 'letter' | 'a4';
