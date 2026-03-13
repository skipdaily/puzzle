'use client';

import React, { useState, useRef, useEffect } from 'react';
import { leftPiecePath, rightPiecePath } from '@/lib/puzzle-shapes';

interface ShapePickerProps {
  value: number;
  onChange: (index: number) => void;
}

const THUMB_W = 52;
const THUMB_H = 56;
const TOTAL_W = THUMB_W * 2;

const TEMPLATE_GROUPS = [
  {
    label: 'Snake Wave ◀',
    items: [
      { index: 0, name: 'Gentle' },
      { index: 1, name: 'Medium' },
      { index: 2, name: 'Deep' },
      { index: 3, name: 'Tight' },
    ],
  },
  {
    label: 'Snake Wave ▶',
    items: [
      { index: 4, name: 'Gentle' },
      { index: 5, name: 'Medium' },
      { index: 6, name: 'Deep' },
      { index: 7, name: 'Tight' },
    ],
  },
  {
    label: 'Snake Ripple ◀',
    items: [
      { index: 8, name: 'Light' },
      { index: 9, name: 'Medium' },
      { index: 10, name: 'Heavy' },
      { index: 11, name: 'Fine' },
    ],
  },
  {
    label: 'Snake Ripple ▶',
    items: [
      { index: 12, name: 'Light' },
      { index: 13, name: 'Medium' },
      { index: 14, name: 'Heavy' },
      { index: 15, name: 'Fine' },
    ],
  },
  {
    label: 'Zigzag ◀',
    items: [
      { index: 16, name: '1 Small' },
      { index: 17, name: '1 Large' },
      { index: 18, name: '2 Small' },
      { index: 19, name: '2 Large' },
    ],
  },
  {
    label: 'Zigzag ▶',
    items: [
      { index: 20, name: '1 Small' },
      { index: 21, name: '1 Large' },
      { index: 22, name: '2 Small' },
      { index: 23, name: '2 Large' },
    ],
  },
];

// Build a lookup: index → "Group — Name"
export const SHAPE_NAMES: Record<number, string> = {};
for (const g of TEMPLATE_GROUPS) {
  for (const item of g.items) {
    SHAPE_NAMES[item.index] = `${g.label} — ${item.name}`;
  }
}

function ShapeThumb({
  index,
  selected,
  onClick,
}: {
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const lPath = leftPiecePath(0, 0, THUMB_W, THUMB_H, index);
  const rPath = rightPiecePath(THUMB_W, 0, THUMB_W, THUMB_H, index);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg p-1 transition-all ${
        selected
          ? 'bg-blue-100 ring-2 ring-blue-500 shadow-sm'
          : 'bg-white hover:bg-gray-50 ring-1 ring-gray-200 hover:ring-gray-300'
      }`}
      title={`Template ${index}`}
    >
      <svg
        width={TOTAL_W}
        height={THUMB_H}
        viewBox={`-2 -2 ${TOTAL_W + 4} ${THUMB_H + 4}`}
      >
        {/* Left piece */}
        <path
          d={lPath}
          fill={selected ? '#DBEAFE' : '#F9FAFB'}
          stroke={selected ? '#3B82F6' : '#9CA3AF'}
          strokeWidth="1"
        />
        {/* Right piece */}
        <path
          d={rPath}
          fill={selected ? '#EFF6FF' : '#F3F4F6'}
          stroke={selected ? '#3B82F6' : '#9CA3AF'}
          strokeWidth="1"
        />
        {/* Labels */}
        <text
          x={THUMB_W / 2}
          y={THUMB_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="7"
          fill={selected ? '#2563EB' : '#9CA3AF'}
          fontWeight="600"
        >
          TEXT
        </text>
        <text
          x={THUMB_W + THUMB_W / 2}
          y={THUMB_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="7"
          fill={selected ? '#2563EB' : '#9CA3AF'}
          fontWeight="600"
        >
          IMG
        </text>
      </svg>
    </button>
  );
}

export default function ShapePicker({ value, onChange }: ShapePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const selectedLPath = mounted ? leftPiecePath(0, 0, THUMB_W, THUMB_H, value) : '';
  const selectedRPath = mounted ? rightPiecePath(THUMB_W, 0, THUMB_W, THUMB_H, value) : '';

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger: shows currently selected shape */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border px-2 py-1 transition-colors ${
          open
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <svg
          width={TOTAL_W * 0.65}
          height={THUMB_H * 0.65}
          viewBox={`-2 -2 ${TOTAL_W + 4} ${THUMB_H + 4}`}
        >
          <path d={selectedLPath} fill="#F9FAFB" stroke="#6B7280" strokeWidth="1.2" />
          <path d={selectedRPath} fill="#F3F4F6" stroke="#6B7280" strokeWidth="1.2" />
        </svg>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-xl p-3 w-[500px] max-h-[70vh] overflow-y-auto">
          {TEMPLATE_GROUPS.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 px-1">
                {group.label}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {group.items.map((item) => (
                  <div key={item.index} className="flex flex-col items-center gap-0.5">
                    <ShapeThumb
                      index={item.index}
                      selected={value === item.index}
                      onClick={() => {
                        onChange(item.index);
                        setOpen(false);
                      }}
                    />
                    <span className="text-[10px] text-gray-400">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
