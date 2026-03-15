import { createClient } from '@supabase/supabase-js';
import type { PuzzleEntry, PageSize, StickerItem } from './types';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// ─── Database types ───────────────────────────────────────────────────────────

export interface PuzzleRecord {
  id: string;            // uuid
  title: string;
  page_size: PageSize;
  entries: PuzzleEntry[];
  created_at: string;
  updated_at: string;
}

// ─── CRUD helpers ─────────────────────────────────────────────────────────────

export async function fetchPuzzles(): Promise<PuzzleRecord[]> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PuzzleRecord[];
}

export async function fetchPuzzle(id: string): Promise<PuzzleRecord | null> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as PuzzleRecord;
}

export async function savePuzzle(
  title: string,
  pageSize: PageSize,
  entries: PuzzleEntry[],
  existingId?: string,
): Promise<PuzzleRecord> {
  const payload = {
    title,
    page_size: pageSize,
    entries,
    updated_at: new Date().toISOString(),
  };

  if (existingId) {
    const { data, error } = await supabase
      .from('puzzles')
      .update(payload)
      .eq('id', existingId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PuzzleRecord;
  } else {
    const { data, error } = await supabase
      .from('puzzles')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PuzzleRecord;
  }
}

export async function deletePuzzle(id: string): Promise<void> {
  const { error } = await supabase.from('puzzles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function renamePuzzle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('puzzles')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Image Storage ────────────────────────────────────────────────────────────

const IMAGE_BUCKET = 'puzzle-images';

/**
 * Uploads a base64-encoded image to Supabase Storage and returns its public URL.
 * Falls back to a data URL if the upload fails.
 */
export async function uploadPuzzleImage(
  base64Data: string,
  mimeType: string = 'image/png',
): Promise<string> {
  const ext = mimeType.split('/')[1] || 'png';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Convert base64 → Uint8Array
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(filename, bytes, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// ─── Sticker Sheet Database types ─────────────────────────────────────────────

export interface StickerSheetRecord {
  id: string;            // uuid
  title: string;
  items: StickerItem[];
  created_at: string;
  updated_at: string;
}

// ─── Sticker Sheet CRUD helpers ───────────────────────────────────────────────

export async function fetchStickerSheets(): Promise<StickerSheetRecord[]> {
  const { data, error } = await supabase
    .from('sticker_sheets')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as StickerSheetRecord[];
}

export async function fetchStickerSheet(id: string): Promise<StickerSheetRecord | null> {
  const { data, error } = await supabase
    .from('sticker_sheets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as StickerSheetRecord;
}

export async function saveStickerSheet(
  title: string,
  items: StickerItem[],
  existingId?: string,
): Promise<StickerSheetRecord> {
  // Strip out the transient `generating` flag before persisting
  const cleanItems = items.map(({ generating, ...rest }) => rest);

  const payload = {
    title,
    items: cleanItems,
    updated_at: new Date().toISOString(),
  };

  if (existingId) {
    const { data, error } = await supabase
      .from('sticker_sheets')
      .update(payload)
      .eq('id', existingId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as StickerSheetRecord;
  } else {
    const { data, error } = await supabase
      .from('sticker_sheets')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as StickerSheetRecord;
  }
}

export async function deleteStickerSheet(id: string): Promise<void> {
  const { error } = await supabase.from('sticker_sheets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function renameStickerSheet(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('sticker_sheets')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
