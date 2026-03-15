'use client';

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { saveStickerSheet, fetchStickerSheet } from '@/lib/supabase';
import type { StickerItem } from '@/lib/types';

function makeEmptyItems(count: number): StickerItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    prompt: '',
    japaneseLabel: '',
    imageData: '',
    generating: false,
  }));
}

function StickerSheetBuilder() {
  const searchParams = useSearchParams();
  const sheetId = searchParams.get('id');

  const [sheetDbId, setSheetDbId] = useState<string | null>(sheetId);
  const [sheetTitle, setSheetTitle] = useState('Untitled Sticker Sheet');
  const [items, setItems] = useState<StickerItem[]>(makeEmptyItems(16));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkJapanese, setBulkJapanese] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const autoGenerateRef = useRef(false);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // ─── Shuffled word order (so word sheet doesn't match sticker positions) ──
  const [shuffledOrder, setShuffledOrder] = useState<number[]>(() =>
    Array.from({ length: 16 }, (_, i) => i)
  );

  const reshuffleWords = useCallback(() => {
    setShuffledOrder((prev) => {
      const arr = [...prev];
      // Fisher-Yates shuffle
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  }, []);

  // Auto-shuffle once when the first Japanese label is entered
  const hadWordsRef = useRef(false);
  useEffect(() => {
    const hasWords = items.some((it) => it.japaneseLabel?.trim());
    if (hasWords && !hadWordsRef.current) {
      hadWordsRef.current = true;
      reshuffleWords();
    }
  }, [items, reshuffleWords]);

  // ─── Load from Supabase if ?id= is present ─────────────────────────
  useEffect(() => {
    if (!sheetId) return;
    fetchStickerSheet(sheetId).then((record) => {
      if (!record) return;
      setSheetTitle(record.title);
      // Re-hydrate items with generating: false
      const loaded = (record.items as Omit<StickerItem, 'generating'>[]).map((it) => ({
        ...it,
        japaneseLabel: (it as StickerItem).japaneseLabel || '',
        generating: false,
      }));
      // Pad to 16 if fewer stored
      while (loaded.length < 16) {
        loaded.push({ id: loaded.length + 1, prompt: '', japaneseLabel: '', imageData: '', generating: false });
      }
      // Trim to 16 if more stored (migration from old 20-item sheets)
      if (loaded.length > 16) loaded.length = 16;
      setItems(loaded);
      setSheetDbId(record.id);
    });
  }, [sheetId]);

  // ─── Save to Supabase ──────────────────────────────────────────────
  const openSaveModal = () => {
    setDraftTitle(sheetTitle);
    setShowSaveModal(true);
  };

  const handleSaveToCloud = async () => {
    setShowSaveModal(false);
    const titleToSave = draftTitle.trim() || 'Untitled Sticker Sheet';
    setSheetTitle(titleToSave);
    setSaving(true);
    setError(null);
    try {
      const record = await saveStickerSheet(titleToSave, items, sheetDbId ?? undefined);
      setSheetDbId(record.id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      window.history.replaceState({}, '', `/sticker-sheet?id=${record.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ─── Update a single item ──────────────────────────────────────────
  const updateItem = useCallback((index: number, patch: Partial<StickerItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  // ─── Bulk-fill prompts from textarea ───────────────────────────────
  const applyBulkPrompts = () => {
    // Filter out blank lines so pasted text with gaps doesn't skip slots
    const promptLines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const japaneseLines = bulkJapanese
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const lineCount = Math.max(promptLines.length, japaneseLines.length);
    setItems((prev) => {
      const next = [...prev];
      for (let i = 0; i < Math.min(lineCount, 16); i++) {
        next[i] = {
          ...next[i],
          prompt: i < promptLines.length ? promptLines[i] : next[i].prompt,
          japaneseLabel: i < japaneseLines.length ? japaneseLines[i] : next[i].japaneseLabel,
        };
      }
      return next;
    });
    setShowBulk(false);
    // Flag auto-generate; a useEffect will pick it up after state settles
    autoGenerateRef.current = true;
  };

  // Fires bulk generation once after bulk-fill updates items state
  useEffect(() => {
    if (autoGenerateRef.current) {
      autoGenerateRef.current = false;
      generateAllImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ─── Generate a single image ──────────────────────────────────────
  const generateImage = async (index: number) => {
    const item = items[index];
    if (!item.prompt.trim()) return;

    updateItem(index, { generating: true });
    setError(null);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: item.prompt.trim(),
          enforceWhiteBackground: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed');
      updateItem(index, { imageData: data.imageData, generating: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
      updateItem(index, { generating: false });
    }
  };

  // ─── Generate ALL images — all 20 in parallel ─────────────────────
  const generatingAllRef = useRef(false);

  const generateAllImages = async () => {
    // Guard against re-entry from useEffect
    if (generatingAllRef.current) return;
    generatingAllRef.current = true;
    setGeneratingAll(true);
    setError(null);

    // Read latest items via ref to avoid stale closure
    const currentItems = itemsRef.current;

    // Collect ALL indices that need generation
    const pending = currentItems
      .map((item, i) => (item.prompt.trim() && !item.imageData ? i : -1))
      .filter((i) => i !== -1);

    if (pending.length === 0) {
      setGeneratingAll(false);
      generatingAllRef.current = false;
      return;
    }

    // Mark everything as generating at once
    setItems((prev) => {
      const next = [...prev];
      pending.forEach((idx) => { next[idx] = { ...next[idx], generating: true }; });
      return next;
    });

    // Fire ALL requests concurrently
    const results = await Promise.allSettled(
      pending.map(async (idx) => {
        const prompt = itemsRef.current[idx].prompt.trim();
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            enforceWhiteBackground: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Image generation failed');
        return { idx, imageData: data.imageData as string };
      }),
    );

    // Apply all results in one state update
    setItems((prev) => {
      const next = [...prev];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { idx, imageData } = result.value;
          next[idx] = { ...next[idx], imageData, generating: false };
        }
      }
      // Clear generating flag for any that failed
      pending.forEach((idx) => {
        if (next[idx].generating) {
          next[idx] = { ...next[idx], generating: false };
        }
      });
      return next;
    });

    // Report errors
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      const firstErr = (failures[0] as PromiseRejectedResult).reason;
      setError(firstErr instanceof Error ? firstErr.message : `${failures.length} image(s) failed to generate`);
    }

    setGeneratingAll(false);
    generatingAllRef.current = false;
  };

  // ─── Export PDF (stickers or words) ───────────────────────────────────────
  const [exportingWords, setExportingWords] = useState(false);

  const handleExportPDF = async (type: 'stickers' | 'words') => {
    const isStickerExport = type === 'stickers';
    if (isStickerExport) setExporting(true);
    else setExportingWords(true);
    setError(null);

    try {
      const res = await fetch('/api/export-sticker-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, type, shuffledOrder, title: sheetTitle }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'PDF export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isStickerExport ? 'sticker-sheet.pdf' : 'word-sheet.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      if (isStickerExport) setExporting(false);
      else setExportingWords(false);
    }
  };

  // ─── Counts ───────────────────────────────────────────────────────
  const filledCount = items.filter((i) => i.prompt.trim()).length;
  const imageCount = items.filter((i) => i.imageData).length;  const wordCount = items.filter((i) => i.japaneseLabel.trim()).length;  const anyGenerating = items.some((i) => i.generating);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-800 transition"
          >
            ← Home
          </Link>
          <Link
            href="/sticker-sheets"
            className="text-sm text-gray-500 hover:text-gray-800 transition"
          >
            📚 My Sheets
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">🏷️ Sticker Sheet Generator</h1>
        </div>

        {/* Title */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-lg font-medium text-gray-700">{sheetTitle}</span>
          {sheetDbId && <span className="text-xs text-gray-400">Saved</span>}
        </div>

        {/* Info banner */}
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <strong>Sheet layout:</strong> 16 sticker labels (4 × 4) + branding row — each 2″ × 2″ on 8.5″ × 11″ sticker paper.<br/>
          <strong>Sticker PDF:</strong> Print on sticker paper — 16 AI-generated images you peel off, plus branding row.<br/>
          <strong>Word PDF:</strong> Print on regular paper — Japanese words in shuffled positions with answer text below.
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
          >
            📋 Bulk Fill Prompts
          </button>

          <button
            onClick={generateAllImages}
            disabled={generatingAll || anyGenerating || filledCount === 0}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {generatingAll ? '⏳ Generating…' : `🎨 Generate All Images (${filledCount - imageCount} remaining)`}
          </button>

          <button
            onClick={() => handleExportPDF('stickers')}
            disabled={exporting || imageCount === 0}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {exporting ? '⏳ Exporting…' : `🖼️ Sticker PDF (${imageCount} images)`}
          </button>

          <button
            onClick={() => handleExportPDF('words')}
            disabled={exportingWords || wordCount === 0}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {exportingWords ? '⏳ Exporting…' : `🇯🇵 Word PDF (${wordCount} words)`}
          </button>

          <button
            onClick={openSaveModal}
            disabled={saving || filledCount === 0}
            className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? '⏳ Saving…' : saveSuccess ? '✅ Saved!' : '💾 Save'}
          </button>

          <span className="ml-auto text-sm text-gray-500">
            {imageCount}/{filledCount} images generated
          </span>
        </div>

        {/* Bulk fill */}
        {showBulk && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">
              Paste up to 16 entries, one per line. Image prompts on the left, Japanese words on the right. Lines are matched by row number.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Image Prompts (English)</label>
                <textarea
                  className="w-full h-40 rounded-lg border border-gray-300 p-3 text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:outline-none"
                  placeholder={"a cute red apple\na happy golden retriever\na blue bicycle\n..."}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Japanese Words</label>
                <textarea
                  className="w-full h-40 rounded-lg border border-gray-300 p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                  placeholder={"りんご\nいぬ\nじてんしゃ\n..."}
                  value={bulkJapanese}
                  onChange={(e) => setBulkJapanese(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={applyBulkPrompts}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Apply
              </button>
              <button
                onClick={() => setShowBulk(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sheet Previews — side by side */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sticker Preview */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-3">🖼️ Sticker Sheet Preview</h2>
            <div
              className="mx-auto bg-white border border-gray-300 shadow-md relative"
              style={{ width: '100%', aspectRatio: '8.5 / 11' }}
            >
              {/* 4×4 user stickers */}
              <div
                className="absolute grid"
                style={{
                  top: `${(0.25 / 11) * 100}%`,
                  left: `${(0.25 / 8.5) * 100}%`,
                  width: `${(8.0 / 8.5) * 100}%`,
                  height: `${((4 * 2.125 - 0.125) / 11) * 100}%`,
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: 'repeat(4, 1fr)',
                  rowGap: `${(0.125 / (4 * 2.125 - 0.125)) * 100}%`,
                  columnGap: '0',
                }}
              >
                {items.map((item, i) => (
                  <div
                    key={item.id}
                    className="relative rounded-[3px] border border-dashed border-gray-300 overflow-hidden bg-gray-50 flex items-center justify-center"
                  >
                    {item.imageData ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageData}
                        alt={item.prompt}
                        className="w-full h-full object-cover"
                      />
                    ) : item.generating ? (
                      <div className="text-xs text-blue-500 animate-pulse">⏳</div>
                    ) : item.prompt ? (
                      <div className="text-[7px] text-gray-400 text-center px-1 leading-tight truncate">
                        {item.prompt}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-300">{i + 1}</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Branding row preview */}
              <div
                className="absolute grid"
                style={{
                  top: `${((0.25 + 4 * 2.125) / 11) * 100}%`,
                  left: `${(0.25 / 8.5) * 100}%`,
                  width: `${(8.0 / 8.5) * 100}%`,
                  height: `${(2.0 / 11) * 100}%`,
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: '1fr',
                  columnGap: '0',
                }}
              >
                <div className="rounded-[3px] border border-dashed border-gray-300 bg-white flex items-center justify-center">
                  <div className="px-1 text-center leading-tight">
                    <div className="text-[6px] font-bold text-gray-500">Japanese Learning Stickers</div>
                    <div className="mt-1 text-[5px] font-semibold text-gray-400">Puzzle:</div>
                    <div className="text-[6px] font-bold text-gray-700 break-words">{sheetTitle}</div>
                  </div>
                </div>
                <div className="rounded-[3px] border border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-0.5">
                  <div className="text-[6px] font-bold text-gray-500">Need more paper?</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/branding/learing_qr.png"
                    alt="Need more paper QR code"
                    className="h-[58%] w-auto object-contain"
                  />
                </div>
                <div className="rounded-[3px] border border-dashed border-gray-300 bg-white flex flex-col items-center justify-center">
                  <div className="text-[6px] font-bold text-gray-500">Visit us at:</div>
                  <div className="text-[5px] text-blue-500 break-all text-center px-1">puzzle-khaki-six.vercel.app</div>
                </div>
                <div className="rounded-[3px] border border-dashed border-gray-300 bg-white flex items-center justify-center">
                  <div className="text-[24px]">😊</div>
                </div>
              </div>
            </div>
          </div>

          {/* Word Sheet Preview */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-800">🇯🇵 Word Sheet Preview</h2>
              <button
                onClick={reshuffleWords}
                className="px-3 py-1 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
                title="Randomize word positions"
              >
                🔀 Reshuffle
              </button>
            </div>
            <div
              className="mx-auto bg-white border border-gray-300 shadow-md relative"
              style={{ width: '100%', aspectRatio: '8.5 / 11' }}
            >
              <div
                className="absolute grid"
                style={{
                  top: `${(0.12 / 11) * 100}%`,
                  left: `${(0.25 / 8.5) * 100}%`,
                  width: `${(8.0 / 8.5) * 100}%`,
                  height: `${((4 * 2.39) / 11) * 100}%`,
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: 'repeat(4, 1fr)',
                  rowGap: `${(0.39 / (4 * 2.39)) * 100}%`,
                  columnGap: '0',
                }}
              >
                {shuffledOrder.map((srcIdx, slotIdx) => {
                  const item = items[srcIdx];
                  return (
                    <div key={slotIdx} className="flex flex-col">
                      <div className="flex-1 rounded-[3px] border border-gray-300 overflow-hidden bg-white flex items-center justify-center">
                        {item?.japaneseLabel ? (
                          <div className="text-[16px] font-black text-black text-center px-1 leading-tight">
                            {item.japaneseLabel}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-300">{slotIdx + 1}</div>
                        )}
                      </div>
                      {/* Peek text below label */}
                      {item?.japaneseLabel ? (
                        <div className="text-[8px] font-bold text-black text-center truncate mt-[1px]">
                          {item.japaneseLabel}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {/* Footer branding */}
              <div className="absolute bottom-[4.5%] left-0 right-0 text-center text-[10px] font-semibold text-gray-700 px-4 truncate">
                {sheetTitle}
              </div>
              <div className="absolute bottom-[2%] left-0 right-0 text-center text-[6px] text-gray-400">
                Japanese Learning Stickers • puzzle-khaki-six.vercel.app
              </div>
            </div>
          </div>
        </div>

        {/* Individual sticker editors */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Sticker Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-2"
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">#{item.id}</span>
                {item.imageData && (
                  <button
                    onClick={() => updateItem(i, { imageData: '' })}
                    className="text-xs text-red-400 hover:text-red-600"
                    title="Remove image"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Image preview */}
              <div className="w-full aspect-square rounded-lg border border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                {item.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageData}
                    alt={item.prompt}
                    className="w-full h-full object-cover"
                  />
                ) : item.generating ? (
                  <div className="text-sm text-blue-500 animate-pulse">Generating…</div>
                ) : (
                  <div className="text-sm text-gray-300">No image</div>
                )}
              </div>

              {/* Prompt input */}
              <input
                type="text"
                placeholder="Describe this sticker…"
                value={item.prompt}
                onChange={(e) => updateItem(i, { prompt: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
              />

              {/* Generate button */}
              <button
                onClick={() => generateImage(i)}
                disabled={!item.prompt.trim() || item.generating}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {item.generating ? '⏳ Generating…' : item.imageData ? '🔄 Regenerate' : '🎨 Generate'}
              </button>

              {/* Japanese label input */}
              <input
                type="text"
                placeholder="日本語…"
                value={item.japaneseLabel}
                onChange={(e) => updateItem(i, { japaneseLabel: e.target.value })}
                className="w-full rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
              />
              {item.japaneseLabel && (
                <div className="text-center text-base font-medium text-gray-700">
                  {item.japaneseLabel}
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Save modal */}
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Sticker Sheet</h3>
              <input
                autoFocus
                type="text"
                placeholder="Sticker sheet title…"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveToCloud()}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:outline-none mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveToCloud}
                  className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function StickerSheetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <StickerSheetBuilder />
    </Suspense>
  );
}
