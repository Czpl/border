# Border

A local-first tool for adding borders to images and building PDF contact sheets. Everything runs in your browser: no uploads, no server, no accounts.

## Features

- **Border** tab: add a border to a single image
  - Border width as a percentage of the image's shortest side (1-30%)
  - Border color picker
  - Optional second border nested inside the first
  - Outer placement (expands the canvas) or inner placement (overlays the image)
  - Output aspect ratios: original, square (1:1), Instagram vertical (4:5), Instagram story (9:16), and Polaroid (14:17)
  - Presets including a Polaroid frame with a wide bottom band
  - Stackable effects: a frame shadow cast onto the photo and a procedural orange light leak
  - Read EXIF data (camera, aperture, shutter speed, ISO) and render it on the border
  - Camera info text with configurable font size, font family, separator, and alignment
  - Export the result as a PNG at up to 8192px
- **Contact sheet** tab: arrange 12+ images on printer pages and export as a single PDF
  - Page formats: A5, A4, A3, Letter, Tabloid (11×17), portrait or landscape
  - Grid presets: 12, 15, 20, 24, or 30 images per page, or auto-fit
  - Optional caption under each image (index number, filename, or both)
  - Margin, spacing, and background color controls
  - Multiple pages are generated automatically; preview shows the first page
  - Export the result as a PDF (pdf-lib, lazy-loaded)

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

`src/lib/contactSheet.ts` lays a grid of photos onto pages and exports a single PDF:

- Layout math is shared between the preview (`renderSheetPreview`) and the document (`buildContactSheetPDF`)
- Page sizes are points; grid presets are swapped by orientation so the long edge holds more cells
- Each photo is scaled to fit its cell (aspect preserved), with an optional caption below it
- Thumbnails are rasterized to JPEG at ~144dpi and embedded with pdf-lib, which is dynamically imported so the border tab never loads it
- `exifr` reads metadata (`src/lib/exif.ts`) for the border's camera-info line

## Tech stack

- Vite 8
- React 19 + TypeScript
- Canvas 2D API (no image libraries)
- `exifr` for reading EXIF metadata
- `pdf-lib` for generating contact-sheet PDFs
