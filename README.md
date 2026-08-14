# Border

A local-first tool for adding borders to images. Everything runs in your browser: no uploads, no server, no accounts.

## Features

- Drag and drop or browse to upload an image
- Border width as a percentage of the image's shortest side (1-30%)
- Border color picker
- Optional second border nested inside the first
- Outer placement (expands the canvas) or inner placement (overlays the image)
- Output aspect ratios: original, square (1:1), and Instagram vertical (4:5)
- Read EXIF data (camera, aperture, shutter speed, ISO) and render it on the border
- Camera info text with configurable font size, font family, separator, and alignment
- Responsive UI: sidebar controls on desktop, tabbed bottom drawer on mobile
- Export the result as a PNG at up to 8192px

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (usually http://localhost:5173).

## Scripts

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `npm run dev`    | Start the dev server with HMR        |
| `npm run build`  | Type-check and build for production  |
| `npm run preview`| Preview the production build         |
| `npm run lint`   | Run Oxlint                           |

## How it works

`src/lib/border.ts` renders the image onto a `<canvas>`:

- Border and second-border widths are converted from a percentage of the smallest image dimension to pixels
- Borders are drawn as rounded-rect paths filled with an evenodd rule so the inner border stays inside the outer one
- Aspect ratio constraints grow the canvas to fit and center the content, filling any extra space with the border color
- The preview renders at up to 1600px for speed; downloads re-render at full resolution (up to 8192px) with `dpr: 1`
- Camera info is extracted from EXIF with `exifr` (`src/lib/exif.ts`) and drawn onto the bottom border band, with contrast picked from the border color

## Tech stack

- Vite 8
- React 19 + TypeScript
- Canvas 2D API (no image libraries)
- `exifr` for reading EXIF metadata
