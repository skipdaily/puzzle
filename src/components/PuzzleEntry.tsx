'use client';

import React, { useRef } from 'react';
import type { PuzzleEntry, PuzzleSideData, PuzzleSideKey } from '@/lib/types';
import PuzzlePreview from './PuzzlePreview';
import ShapePicker, { SHAPE_NAMES } from './ShapePicker';

interface PuzzleEntryCardProps {
  entry: PuzzleEntry;
  onChange: (entry: PuzzleEntry) => void;
  loading: Record<PuzzleSideKey, { translate: boolean; image: boolean }>;
  onTranslate: (side: PuzzleSideKey) => void;
  onGenerateImage: (side: PuzzleSideKey) => void;
}

const ENTRY_COLORS: Record<string, string> = {
  A: 'border-blue-400 bg-blue-50',
  B: 'border-emerald-400 bg-emerald-50',
  C: 'border-amber-400 bg-amber-50',
};

const BADGE_COLORS: Record<string, string> = {
  A: 'bg-blue-500',
  B: 'bg-emerald-500',
  C: 'bg-amber-500',
};

export default function PuzzleEntryCard({
  entry,
  onChange,
  loading,
  onTranslate,
  onGenerateImage,
}: PuzzleEntryCardProps) {
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  const updateSide = (side: PuzzleSideKey, fields: Partial<PuzzleSideData>) => {
    onChange({
      ...entry,
      [side]: {
        ...entry[side],
        ...fields,
      },
    });
  };

  const handleImageUpload = (side: PuzzleSideKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateSide(side, { imageData: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (side: PuzzleSideKey) => {
    updateSide(side, { imageData: '' });
    if (side === 'front' && frontFileInputRef.current) frontFileInputRef.current.value = '';
    if (side === 'back' && backFileInputRef.current) backFileInputRef.current.value = '';
  };

  const colorClasses = ENTRY_COLORS[entry.id] || 'border-gray-300 bg-gray-50';
  const badgeColor = BADGE_COLORS[entry.id] || 'bg-gray-500';

  return (
    <div className={`rounded-xl border-2 ${colorClasses} p-5 transition-shadow hover:shadow-md`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`${badgeColor} text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center`}>
          {entry.id}
        </span>
        <h3 className="text-lg font-semibold text-gray-800">Puzzle {entry.id}</h3>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Shape:</label>
          <ShapePicker
            value={entry.templateIndex ?? 0}
            onChange={(index) => onChange({ ...entry, templateIndex: index })}
          />
        </div>
      </div>

      <div className="space-y-5">
        <SideEditor
          title="Front Side"
          sideKey="front"
          side={entry.front}
          templateIndex={entry.templateIndex}
          loading={loading.front}
          onUpdate={updateSide}
          onTranslate={onTranslate}
          onGenerateImage={onGenerateImage}
          fileInputRef={frontFileInputRef}
          onImageUpload={handleImageUpload}
          onRemoveImage={removeImage}
          previewId={`${entry.id}-front`}
        />

        <SideEditor
          title="Back Side"
          sideKey="back"
          side={entry.back}
          templateIndex={entry.templateIndex}
          loading={loading.back}
          onUpdate={updateSide}
          onTranslate={onTranslate}
          onGenerateImage={onGenerateImage}
          fileInputRef={backFileInputRef}
          onImageUpload={handleImageUpload}
          onRemoveImage={removeImage}
          previewId={`${entry.id}-back`}
        />
      </div>
    </div>
  );
}

interface SideEditorProps {
  title: string;
  sideKey: PuzzleSideKey;
  side: PuzzleSideData;
  templateIndex: number;
  loading: { translate: boolean; image: boolean };
  onUpdate: (side: PuzzleSideKey, fields: Partial<PuzzleSideData>) => void;
  onTranslate: (side: PuzzleSideKey) => void;
  onGenerateImage: (side: PuzzleSideKey) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageUpload: (side: PuzzleSideKey, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (side: PuzzleSideKey) => void;
  previewId: string;
}

function SideEditor({
  title,
  sideKey,
  side,
  templateIndex,
  loading,
  onUpdate,
  onTranslate,
  onGenerateImage,
  fileInputRef,
  onImageUpload,
  onRemoveImage,
  previewId,
}: SideEditorProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white/70 p-4">
      <div className="text-sm font-semibold text-gray-700 mb-3">{title}</div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: form fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">English word / phrase</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={side.englishLabel}
                onChange={(e) => onUpdate(sideKey, { englishLabel: e.target.value })}
                placeholder='e.g. "fox"'
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
              <button
                onClick={() => onTranslate(sideKey)}
                disabled={loading.translate || !side.englishLabel.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {loading.translate ? (
                  <span className="flex items-center gap-1"><Spinner /> Translating…</span>
                ) : (
                  '🇯🇵 Translate'
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Japanese (kana)</label>
              <input
                type="text"
                value={side.japaneseText}
                onChange={(e) => onUpdate(sideKey, { japaneseText: e.target.value })}
                placeholder="きつね"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kanji (optional)</label>
              <input
                type="text"
                value={side.kanjiText}
                onChange={(e) => onUpdate(sideKey, { kanjiText: e.target.value })}
                placeholder="狐"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Romaji</label>
              <input
                type="text"
                value={side.romaji}
                onChange={(e) => onUpdate(sideKey, { romaji: e.target.value })}
                placeholder="kitsune"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image prompt</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={side.imagePrompt}
                onChange={(e) => onUpdate(sideKey, { imagePrompt: e.target.value })}
                placeholder='e.g. "a cute fox, watercolor style"'
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
              <button
                onClick={() => onGenerateImage(sideKey)}
                disabled={loading.image || !side.imagePrompt.trim()}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {loading.image ? (
                  <span className="flex items-center gap-1"><Spinner /> Generating…</span>
                ) : (
                  '🎨 Generate'
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors">
              📁 Upload Image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => onImageUpload(sideKey, e)}
                className="hidden"
              />
            </label>
            {side.imageData && (
              <button onClick={() => onRemoveImage(sideKey)} className="text-sm text-red-500 hover:text-red-700">
                ✕ Remove image
              </button>
            )}
          </div>
        </div>

        {/* Right: preview */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-gray-400 mb-1">
            {SHAPE_NAMES[templateIndex] ?? `Shape ${templateIndex}`}
          </span>
          <PuzzlePreview side={side} templateIndex={templateIndex} idKey={previewId} />
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
