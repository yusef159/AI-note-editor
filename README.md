# Lecture Notes

A web app for students to build lecture notes from recorded classes. Paste screenshots from lecture recordings and they are automatically enhanced for readability, then inserted into a rich-text document editor.

## Features

- **Rich document editor** — headings, lists, bold/italic, undo/redo (TipTap)
- **Screenshot paste & drop** — paste (`Ctrl+V`) or drag images into the editor
- **AI image enhancement** — server-side super-resolution via [Real-ESRGAN on Replicate](https://replicate.com/nightmareai/real-esrgan) (sharpens and upscales without altering content)
- **Local storage** — notes saved in your browser (IndexedDB), no account required
- **Export** — download notes as self-contained HTML or PDF

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Replicate API

Copy the example env file and add your token:

```bash
cp .env.local.example .env.local
```

Get a free API token at [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) and set it in `.env.local`:

```
REPLICATE_API_TOKEN=r8_...
```

Without a token, pasted images are still inserted but **not enhanced**.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:8473](http://localhost:8473).

## Usage

1. Open the app — a note is created automatically
2. Paste screenshots from your lecture recording into the editor
3. Each image is sent to `/api/enhance`, processed by Real-ESRGAN, and inserted when ready
4. Add text, headings, and lists around your screenshots
5. Export your finished notes as HTML or PDF

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **TipTap** — document editor
- **Dexie.js** — IndexedDB local storage
- **Sharp** — server-side image preprocessing
- **Replicate** — Real-ESRGAN super-resolution model
- **Tailwind CSS** — styling

## API

### `GET /api/enhance`

Returns `{ configured: boolean }` — whether `REPLICATE_API_TOKEN` is set.

### `POST /api/enhance`

Accepts `multipart/form-data` with an `image` field (max 10MB). Returns enhanced JPEG bytes.

## Privacy

- Notes are stored locally in your browser only
- Pasted images are sent to your Next.js server, which forwards them to Replicate for enhancement
- No user accounts or cloud note storage in v1
