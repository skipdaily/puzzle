# 🧩 Vocabulary Puzzle Generator

Create printable Japanese vocabulary jigsaw puzzles! Each puzzle is a 2-piece jigsaw where the top piece shows Japanese text (vertical) and the bottom piece shows an image. Generate 3 puzzles per PDF page.

## Features

- **English → Japanese translation** via GPT-4o-mini (kana, kanji, romaji)
- **AI image generation** via DALL-E 3
- **Upload your own images** as an alternative
- **PDF export** with jigsaw puzzle shapes and cut lines
- **Editable Japanese text** before export
- **Save / Load** project as JSON
- **Configurable page size** (US Letter or A4)
- **Matching ID markers** (A1/A2, B1/B2, C1/C2) for teachers

## Getting Started

### Prerequisites

- Node.js 18+
- An OpenAI API key (for translation and image generation)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your OpenAI API key

# 3. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Your OpenAI API key for GPT-4o-mini (translation) and DALL-E 3 (image generation) |

## Usage

### Mode 1: Name the Image (English → Japanese)
1. Enter an English word (e.g., "fox") in the English field
2. Click **🇯🇵 Translate** to generate Japanese text
3. The kana, kanji, and romaji fields populate automatically
4. Edit any field if needed

### Mode 2: Describe the Image (Prompt → Generated Image)
1. Enter an image prompt (e.g., "a cute fox, watercolor style")
2. Click **🎨 Generate** to create an AI image
3. Or click **📁 Upload Image** to use your own

### Export
1. Fill in 1–3 puzzle entries (A, B, C)
2. Select page size (US Letter or A4)
3. Click **📄 Export PDF**
4. Print and cut along the lines!

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/translate` | Translate English to Japanese |
| POST | `/api/generate-image` | Generate image from prompt |
| POST | `/api/export-pdf` | Download puzzle PDF |

## Project Structure

```
puzzle/
├── public/fonts/NotoSansJP-Regular.ttf
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── translate/route.ts
│   │   │   ├── generate-image/route.ts
│   │   │   └── export-pdf/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── PuzzleEntry.tsx
│   │   └── PuzzlePreview.tsx
│   └── lib/
│       ├── types.ts
│       ├── puzzle-shapes.ts
│       └── pdf-generator.ts
├── .env.example
├── next.config.ts
└── README.md
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React + Tailwind CSS
- **PDF Generation**: PDFKit (server-side)
- **Translation**: OpenAI GPT-4o-mini
- **Image Generation**: OpenAI DALL-E 3
- **Font**: Noto Sans JP (embedded in PDF)
