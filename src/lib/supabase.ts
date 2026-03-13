import { createClient } from '@supabase/supabase-js';
import type { PuzzleEntry, PageSize } from './types';

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
