'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchStickerSheets, deleteStickerSheet, renameStickerSheet } from '@/lib/supabase';
import type { StickerSheetRecord } from '@/lib/supabase';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function sheetPreviewLabel(record: StickerSheetRecord) {
  const prompts = (record.items as { prompt?: string }[])
    .map((i) => i.prompt)
    .filter(Boolean);
  return prompts.length ? prompts.slice(0, 5).join(', ') : 'Empty sheet';
}

export default function MyStickerSheetsPage() {
  const [sheets, setSheets] = useState<StickerSheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStickerSheets();
      setSheets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sticker sheets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEditing = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingTitle(currentTitle);
  };

  const commitRename = async (id: string) => {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    try {
      await renameStickerSheet(id, trimmed);
      setSheets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteStickerSheet(id);
      setSheets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const imageCount = (record: StickerSheetRecord) =>
    (record.items as { imageData?: string }[]).filter((i) => i.imageData).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-800 text-sm transition-colors">
            ← Hub
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <h1 className="text-lg font-bold text-gray-900">🏷️ My Sticker Sheets</h1>
          <div className="ml-auto">
            <Link
              href="/sticker-sheet"
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              + New Sticker Sheet
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading sticker sheets…
          </div>
        ) : sheets.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏷️</div>
            <h2 className="text-xl font-semibold text-gray-700">No sticker sheets yet</h2>
            <p className="text-gray-500 mt-2 mb-6">Create your first sticker sheet and save it to see it here.</p>
            <Link
              href="/sticker-sheet"
              className="px-6 py-3 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors"
            >
              Create a sticker sheet
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    {editingId === sheet.id ? (
                      <input
                        autoFocus
                        className="text-base font-semibold text-gray-900 border-b-2 border-amber-400 outline-none bg-transparent w-full leading-tight"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => commitRename(sheet.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(sheet.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <h3
                        className="text-base font-semibold text-gray-900 leading-tight cursor-pointer hover:text-amber-600 transition-colors group flex items-center gap-1"
                        title="Click to rename"
                        onClick={() => startEditing(sheet.id, sheet.title)}
                      >
                        {sheet.title}
                        <span className="text-gray-300 group-hover:text-amber-400 text-xs">✏️</span>
                      </h3>
                    )}
                    <span className="text-xs bg-amber-50 text-amber-600 rounded px-2 py-0.5 shrink-0">
                      {imageCount(sheet)}/20 images
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    {sheetPreviewLabel(sheet)}
                  </p>
                  <p className="text-xs text-gray-400 mt-3">
                    Updated {formatDate(sheet.updated_at)}
                  </p>
                </div>

                <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-2">
                  <Link
                    href={`/sticker-sheet?id=${sheet.id}`}
                    className="flex-1 text-center text-sm font-medium text-amber-600 hover:text-amber-800 transition-colors"
                  >
                    Open
                  </Link>
                  <div className="w-px h-4 bg-gray-200" />
                  <button
                    onClick={() => handleDelete(sheet.id, sheet.title)}
                    disabled={deleting === sheet.id}
                    className="text-sm text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                  >
                    {deleting === sheet.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
