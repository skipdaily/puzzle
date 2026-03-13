'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { PuzzleEntry, PageSize, PuzzleSideData, PuzzleSideKey } from '@/lib/types';
import PuzzleEntryCard from '@/components/PuzzleEntry';
import { savePuzzle, fetchPuzzle } from '@/lib/supabase';

function emptySide(): PuzzleSideData {
  return {
    englishLabel: '',
    japaneseText: '',
    kanjiText: '',
    romaji: '',
    imagePrompt: '',
    imageData: '',
  };
}

function emptyEntry(id: string, templateIndex: number = 0): PuzzleEntry {
  return {
    id,
    templateIndex,
    front: emptySide(),
    back: emptySide(),
  };
}

function PuzzleBuilder() {
  const searchParams = useSearchParams();
  const puzzleId = searchParams.get('id');

  const [puzzleDbId, setPuzzleDbId] = useState<string | null>(puzzleId);
  const [puzzleTitle, setPuzzleTitle] = useState('Untitled Puzzle');
  const [editingTitle, setEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [entries, setEntries] = useState<PuzzleEntry[]>([
    emptyEntry('A', 0),
    emptyEntry('B', 1),
    emptyEntry('C', 2),
  ]);
  const [pageSize, setPageSize] = useState<PageSize>('letter');
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<
    Record<string, Record<PuzzleSideKey, { translate: boolean; image: boolean }>>
  >({
    A: { front: { translate: false, image: false }, back: { translate: false, image: false } },
    B: { front: { translate: false, image: false }, back: { translate: false, image: false } },
    C: { front: { translate: false, image: false }, back: { translate: false, image: false } },
  });
  const [error, setError] = useState<string | null>(null);

  // ─── Load from Supabase if ?id= is present ──────────────────────────
  useEffect(() => {
    if (!puzzleId) return;
    fetchPuzzle(puzzleId).then((record) => {
      if (!record) return;
      setPuzzleTitle(record.title);
      setPageSize(record.page_size);
      setEntries(record.entries);
      setPuzzleDbId(record.id);
    });
  }, [puzzleId]);

  // ─── Save to Supabase ────────────────────────────────────────────────
  const handleSaveToCloud = async () => {
    setSaving(true);
    setError(null);
    try {
      const record = await savePuzzle(puzzleTitle, pageSize, entries, puzzleDbId ?? undefined);
      setPuzzleDbId(record.id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      // Update URL without page reload so refresh keeps the id
      window.history.replaceState({}, '', `/puzzle?id=${record.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = useCallback((index: number, updated: PuzzleEntry) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const setLoading = (
    id: string,
    side: PuzzleSideKey,
    key: 'translate' | 'image',
    value: boolean
  ) => {
    setLoadingState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [side]: { ...prev[id][side], [key]: value },
      },
    }));
  };

  // ─── Translate ───────────────────────────────────────────────────────

  const handleTranslate = async (index: number, side: PuzzleSideKey) => {
    const entry = entries[index];
    const sideData = entry[side];
    if (!sideData.englishLabel.trim()) return;

    setLoading(entry.id, side, 'translate', true);
    setError(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ englishText: sideData.englishLabel.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed');

      updateEntry(index, {
        ...entry,
        [side]: {
          ...sideData,
          japaneseText: data.kana || '',
          kanjiText: data.kanji || '',
          romaji: data.romaji || '',
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setLoading(entry.id, side, 'translate', false);
    }
  };

  // ─── Generate Image ──────────────────────────────────────────────────

  const handleGenerateImage = async (index: number, side: PuzzleSideKey) => {
    const entry = entries[index];
    const sideData = entry[side];
    if (!sideData.imagePrompt.trim()) return;

    setLoading(entry.id, side, 'image', true);
    setError(null);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: sideData.imagePrompt.trim(),
          enforceWhiteBackground: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed');

      updateEntry(index, {
        ...entry,
        [side]: {
          ...sideData,
          imageData: data.imageData,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setLoading(entry.id, side, 'image', false);
    }
  };

  // ─── Export PDF ──────────────────────────────────────────────────────

  const handleExport = async () => {
    const hasContent = entries.some(
      (e) =>
        e.front.japaneseText.trim() ||
        e.front.kanjiText.trim() ||
        e.front.imageData ||
        e.back.japaneseText.trim() ||
        e.back.kanjiText.trim() ||
        e.back.imageData
    );
    if (!hasContent) {
      setError('Add at least one puzzle with Japanese text or an image before exporting.');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, pageSize }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'PDF export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vocabulary-puzzle.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  // ─── Preview PDF ─────────────────────────────────────────────────────

  const handlePreview = async () => {
    const hasContent = entries.some(
      (e) =>
        e.front.japaneseText.trim() ||
        e.front.kanjiText.trim() ||
        e.front.imageData ||
        e.back.japaneseText.trim() ||
        e.back.kanjiText.trim() ||
        e.back.imageData
    );
    if (!hasContent) {
      setError('Add at least one puzzle with Japanese text or an image before previewing.');
      return;
    }

    setPreviewing(true);
    setError(null);

    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, pageSize }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'PDF preview failed');
      }

      const blob = await res.blob();
      // Revoke previous preview URL if any
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // ─── Save / Load Project ────────────────────────────────────────────

  const handleSave = () => {
    const data = JSON.stringify({ entries, pageSize }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'puzzle-project.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.entries) {
            const normalized = data.entries.map((entry: any, i: number) => {
              if (entry.front && entry.back && 'templateIndex' in entry) return entry as PuzzleEntry;

              // Backward compatibility: old project formats
              const fallbackTemplate = Number(
                entry.templateIndex ?? entry.front?.templateIndex ?? i ?? 0
              );
              const legacySide: PuzzleSideData = {
                englishLabel: entry.englishLabel || entry.front?.englishLabel || '',
                japaneseText: entry.japaneseText || entry.front?.japaneseText || '',
                kanjiText: entry.kanjiText || entry.front?.kanjiText || '',
                romaji: entry.romaji || entry.front?.romaji || '',
                imagePrompt: entry.imagePrompt || entry.front?.imagePrompt || '',
                imageData: entry.imageData || entry.front?.imageData || '',
              };
              const backSide: PuzzleSideData = entry.back ? {
                englishLabel: entry.back.englishLabel || '',
                japaneseText: entry.back.japaneseText || '',
                kanjiText: entry.back.kanjiText || '',
                romaji: entry.back.romaji || '',
                imagePrompt: entry.back.imagePrompt || '',
                imageData: entry.back.imageData || '',
              } : emptySide();

              return {
                id: entry.id || String.fromCharCode(65 + i),
                templateIndex: fallbackTemplate,
                front: legacySide,
                back: backSide,
              } as PuzzleEntry;
            });

            setEntries(normalized);
          }
          if (data.pageSize) setPageSize(data.pageSize);
        } catch {
          setError('Invalid project file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Back to hub */}
          <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm transition-colors shrink-0">
            ← Hub
          </Link>
          <div className="h-4 w-px bg-gray-200" />
          {/* Editable title */}
          {editingTitle ? (
            <input
              autoFocus
              className="text-lg font-bold text-gray-900 border-b-2 border-blue-400 outline-none bg-transparent w-52"
              value={puzzleTitle}
              onChange={(e) => setPuzzleTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false); }}
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors text-left"
              title="Click to rename"
            >
              {puzzleTitle}
            </button>
          )}
          {/* spacer */}
          <div className="flex-1" />
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/puzzles"
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📚 My Puzzles
            </Link>
            <button
              onClick={handleLoad}
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📂 Import
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ⬇️ Export
            </button>
            <button
              onClick={handleSaveToCloud}
              disabled={saving}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                saveSuccess
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {saving ? 'Saving…' : saveSuccess ? '✓ Saved!' : '☁️ Save'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Entry Cards */}
        {entries.map((entry, i) => (
          <PuzzleEntryCard
            key={entry.id}
            entry={entry}
            onChange={(updated) => updateEntry(i, updated)}
            loading={loadingState[entry.id]}
            onTranslate={(side) => handleTranslate(i, side)}
            onGenerateImage={(side) => handleGenerateImage(i, side)}
          />
        ))}

        {/* Export controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Page size:</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-blue-400 outline-none"
            >
              <option value="letter">US Letter (8.5×11)</option>
              <option value="a4">A4</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-base"
            >
              {previewing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading Preview…
                </span>
              ) : (
                '👁️ Preview PDF'
              )}
            </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-base"
          >
            {exporting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating PDF…
              </span>
            ) : (
              '📄 Export PDF'
            )}
          </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center text-xs text-gray-400 pb-8">
          <p>Fill in up to 3 puzzle entries. Use &quot;Translate&quot; to convert English → Japanese, or type Japanese directly.</p>
          <p>Use &quot;Generate&quot; to create an image with AI, or upload your own. Then export to PDF for printing.</p>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: '90vw', height: '90vh', maxWidth: '900px' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">PDF Preview</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {exporting ? 'Downloading…' : '📄 Download PDF'}
                </button>
                <button
                  onClick={closePreview}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* PDF iframe */}
            <iframe
              src={previewUrl}
              className="flex-1 w-full rounded-b-2xl"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <PuzzleBuilder />
    </Suspense>
  );
}
