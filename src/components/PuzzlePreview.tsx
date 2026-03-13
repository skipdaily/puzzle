'use client';

import React, { useState, useEffect } from 'react';
import type { PuzzleSideData } from '@/lib/types';
import { leftPiecePath, rightPiecePath } from '@/lib/puzzle-shapes';

interface PuzzlePreviewProps {
  side: PuzzleSideData;
  templateIndex: number;
  idKey: string;
}

// Internal coordinate system for SVG paths
const PIECE_W = 214;
const PIECE_H = 230;
const TOTAL_W = PIECE_W * 2;
const TOTAL_H = PIECE_H;

export default function PuzzlePreview({ side, templateIndex, idKey }: PuzzlePreviewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Japanese text rendered horizontally in the left piece
  const text  = side.japaneseText || side.kanjiText || '?';
  const leftCX   = PIECE_W / 2;

  // Centre of right piece (image area)
  const rightCX = PIECE_W + PIECE_W / 2;
  const rightCY = PIECE_H / 2;

  if (!mounted) {
    return <div className="w-full" style={{ aspectRatio: `${TOTAL_W} / ${TOTAL_H + 2}` }} />;
  }

  const lPath = leftPiecePath(0, 0, PIECE_W, PIECE_H, templateIndex);
  const rPath = rightPiecePath(PIECE_W, 0, PIECE_W, PIECE_H, templateIndex);

  return (
    <div className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${TOTAL_W} ${TOTAL_H + 2}`}
        className="drop-shadow-sm"
      >
        <defs>
          <clipPath id={`clip-left-${idKey}`}>
            <path d={lPath} />
          </clipPath>
          <clipPath id={`clip-right-${idKey}`}>
            <path d={rPath} />
          </clipPath>
        </defs>

        {/* ── Left (word) piece ── */}
        <path d={lPath} fill="white" stroke="#444" strokeWidth="1.2" />

        {/* Horizontal Japanese text — clipped to piece shape */}
        <text
          x={leftCX - 4}
          y={PIECE_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(16, (PIECE_W - 28) / Math.max(text.length, 1) * 1.6)}
          fontFamily="'Noto Sans JP', sans-serif"
          fill="#222"
          clipPath={`url(#clip-left-${idKey})`}
        >
          {text}
        </text>

        {/* ── Right (image) piece ── */}
        <path
          d={rPath}
          fill={side.imageData ? '#f9f9f9' : '#f0f0f0'}
          stroke="#444"
          strokeWidth="1.2"
        />

        {side.imageData ? (
          <image
            href={side.imageData}
            x={PIECE_W + 4}
            y={4}
            width={PIECE_W - 8}
            height={PIECE_H - 8}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#clip-right-${idKey})`}
          />
        ) : (
          <text
            x={rightCX}
            y={rightCY + 4}
            textAnchor="middle"
            fontSize="10"
            fill="#aaa"
          >
            No image
          </text>
        )}
      </svg>
    </div>
  );
}
