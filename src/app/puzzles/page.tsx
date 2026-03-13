'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchPuzzles, deletePuzzle } from '@/lib/supabase';
import type { PuzzleRecord } from '@/lib/supabase';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function puzzlePreviewLabel(record: PuzzleRecord) {
  const words = record.entries
    .map((e) => e.front.englishLabel || e.front.japaneseText)
    .filter(Boolean);
  return words.length ? words.join(', ') : 'Empty puzzle';
}

export default function MyPuzzlesPage() {
  const [puzzles, setPuzzles] = useState<PuzzleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPuzzles();
      setPuzzles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load puzzles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deletePuzzle(id);
      setPuzzles((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-800 text-sm transition-colors">
            ← Hub
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <h1 className="text-lg font-bold text-gray-900">My Puzzles</h1>
          <div className="ml-auto">
            <Link
              href="/puzzle"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New Puzzle
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
            Loading puzzles…
          </div>
        ) : puzzles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🧩</div>
            <h2 className="text-xl font-semibold text-gray-700">No puzzles yet</h2>
            <p className="text-gray-500 mt-2 mb-6">Create your first puzzle and save it to see it here.</p>
            <Link
              href="/puzzle"
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Create a puzzle
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {puzzles.map((puzzle) => (
              <div
                key={puzzle.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-base font-semibold text-gray-900 leading-tight">
                      {puzzle.title}
                    </h3>
                    <span className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5 shrink-0">
                      {puzzle.page_size.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    {puzzlePreviewLabel(puzzle)}
                  </p>
                  <p className="text-xs text-gray-400 mt-3">
                    Updated {formatDate(puzzle.updated_at)}
                  </p>
                </div>

                <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-2">
                  <Link
                    href={`/puzzle?id=${puzzle.id}`}
                    className="flex-1 text-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Open
                  </Link>
                  <div className="w-px h-4 bg-gray-200" />
                  <button
                    onClick={() => handleDelete(puzzle.id, puzzle.title)}
                    disabled={deleting === puzzle.id}
                    className="text-sm text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                  >
                    {deleting === puzzle.id ? 'Deleting…' : 'Delete'}
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
