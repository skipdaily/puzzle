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

// ─── Sticker Sheet Types ────────────────────────────────────────────────────

export interface StickerItem {
  id: number;          // 1–20
  prompt: string;      // user description for AI image
  japaneseLabel: string; // Japanese text for the matching word sheet
  imageData: string;   // base64 data URL or Supabase URL
  generating: boolean; // true while AI is working
}

export interface StickerSheetLayout {
  columns: number;       // 4
  rows: number;          // 5
  labelWidth: number;    // 2" = 144pt
  labelHeight: number;   // 2" = 144pt
  cornerRadius: number;  // 0.0625" = 4.5pt
  topMargin: number;     // 0.25" = 18pt
  bottomMargin: number;  // 0.25" = 18pt
  leftMargin: number;    // 0.25" = 18pt
  rightMargin: number;   // 0.25" = 18pt
  hPitch: number;        // 2" = 144pt
  vPitch: number;        // 2.125" = 153pt
  hSpacing: number;      // 0"
  vSpacing: number;      // 0.125" = 9pt
}

export interface StickerSheetExportRequest {
  items: StickerItem[];
  title?: string;
  shuffledOrder?: number[];
  type?: 'stickers' | 'words';
}
