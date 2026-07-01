"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface ExportMenuProps {
  title: string;
  html: string;
}

const PDF_MARGIN = 40;
const BLOCK_GAP = 20;
const CANVAS_SCALE = 2;

const EXPORT_CSS = `
  * { box-sizing: border-box; }
  body, div { font-family: system-ui, sans-serif; line-height: 1.6; color: #18181b; }
  .export-content { padding: 8px 0; overflow: visible; }
  img { display: block; max-width: 100%; height: auto; border-radius: 8px; }
  p { margin: 0; padding: 4px 0; }
  h1, h2, h3, h4 { margin: 0; padding: 6px 0; line-height: 1.4; }
  h1 { font-size: 1.75em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  ul, ol { margin: 0; padding: 4px 0 4px 1.5em; }
  li { margin: 0.2em 0; }
  blockquote { margin: 0; padding: 4px 0 4px 1em; border-left: 3px solid #d4d4d8; }
`;

const HTML2CANVAS_OPTS = {
  scale: CANVAS_SCALE,
  useCORS: true,
  allowTaint: true,
  logging: false,
  backgroundColor: "#ffffff",
} as const;

function getImageId(img: Element): string | null {
  const attr = img.getAttribute("data-image-id");
  if (attr) return attr;
  const src = img.getAttribute("src");
  if (src?.startsWith("data-image-id://")) {
    return src.slice("data-image-id://".length);
  }
  return null;
}

function findLoadedEditorImage(imageId: string): HTMLImageElement | null {
  const selector = `img[data-image-id="${imageId}"]`;
  const matches = document.querySelectorAll<HTMLImageElement>(
    `.tiptap ${selector}, .ProseMirror ${selector}, ${selector}`
  );
  for (const img of Array.from(matches)) {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) return img;
  }
  return matches[0] ?? null;
}

function waitForSingleImage(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function imageElementToDataUrl(img: HTMLImageElement): Promise<string | null> {
  await waitForSingleImage(img);
  if (!img.naturalWidth || !img.naturalHeight) return null;

  if (img.src.startsWith("data:")) return img.src;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

async function resolveImageData(
  img: HTMLImageElement
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const imageId = getImageId(img);
  const candidates: HTMLImageElement[] = [img];
  if (imageId) {
    const live = findLoadedEditorImage(imageId);
    if (live && live !== img) candidates.unshift(live);
  }

  for (const candidate of candidates) {
    const dataUrl = await imageElementToDataUrl(candidate);
    if (dataUrl) {
      return {
        dataUrl,
        width: candidate.naturalWidth,
        height: candidate.naturalHeight,
      };
    }
  }

  const src = img.getAttribute("src");
  if (src?.startsWith("data:")) {
    const probe = new Image();
    probe.src = src;
    await waitForSingleImage(probe);
    if (probe.naturalWidth && probe.naturalHeight) {
      return {
        dataUrl: src,
        width: probe.naturalWidth,
        height: probe.naturalHeight,
      };
    }
  }

  if (src && !src.startsWith("data:")) {
    try {
      const res = await fetch(src);
      const dataUrl = await blobToDataUrl(await res.blob());
      const probe = new Image();
      probe.src = dataUrl;
      await waitForSingleImage(probe);
      if (probe.naturalWidth && probe.naturalHeight) {
        return {
          dataUrl,
          width: probe.naturalWidth,
          height: probe.naturalHeight,
        };
      }
    } catch {
      // no image data available
    }
  }

  return null;
}

async function inlineImages(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const images = doc.querySelectorAll("img[src]");

  await Promise.all(
    Array.from(images).map(async (img) => {
      const resolved = await resolveImageData(img as HTMLImageElement);
      if (resolved) {
        img.setAttribute("src", resolved.dataUrl);
      }
    })
  );

  return doc.body.innerHTML;
}

function parseContentBlocks(html: string): HTMLElement[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.children).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hasAttribute("data-enhancing-placeholder")) return false;
    if (el.tagName === "IMG") return true;
    if (!el.textContent?.trim() && !el.querySelector("img")) return false;
    return true;
  }) as HTMLElement[];
}

function waitForImages(root: ParentNode): Promise<void> {
  const imgs = root.querySelectorAll("img");
  return Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  ).then(() => undefined);
}

function createStageContainer(contentWidth: number): HTMLDivElement {
  const stage = document.createElement("div");
  stage.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${contentWidth}px`,
    "padding:0",
    "background:#fff",
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
    "overflow:visible",
  ].join(";");
  const style = document.createElement("style");
  style.textContent = EXPORT_CSS;
  stage.appendChild(style);
  const content = document.createElement("div");
  content.className = "export-content";
  stage.appendChild(content);
  return stage;
}

function isImageBlock(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.tagName === "IMG") return true;
  const imgs = el.querySelectorAll("img");
  return imgs.length === 1 && el.textContent?.trim() === "";
}

function getBlockImage(el: HTMLElement): HTMLImageElement | null {
  if (el.tagName === "IMG") return el as HTMLImageElement;
  return el.querySelector("img");
}

function imageFormat(src: string): "JPEG" | "PNG" {
  return src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")
    ? "JPEG"
    : "PNG";
}

function ensureSpace(
  pdf: jsPDF,
  y: number,
  needed: number,
  pageHeight: number,
  margin: number
): number {
  if (y + needed > pageHeight - margin) {
    pdf.addPage();
    return margin;
  }
  return y;
}

async function renderTitle(
  pdf: jsPDF,
  title: string,
  y: number,
  contentWidth: number,
  pageHeight: number,
  margin: number
): Promise<number> {
  const stage = createStageContainer(contentWidth);
  const content = stage.querySelector(".export-content") as HTMLDivElement;
  const h1 = document.createElement("h1");
  h1.textContent = title;
  content.appendChild(h1);
  document.body.appendChild(stage);

  try {
    const canvas = await html2canvas(content, {
      ...HTML2CANVAS_OPTS,
      height: content.scrollHeight + 16,
      windowHeight: content.scrollHeight + 16,
    });
    const blockHeight = canvas.height / CANVAS_SCALE;
    y = ensureSpace(pdf, y, blockHeight, pageHeight, margin);
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      margin,
      y,
      contentWidth,
      blockHeight
    );
    return y + blockHeight + BLOCK_GAP;
  } finally {
    document.body.removeChild(stage);
  }
}

async function placeImageBlock(
  pdf: jsPDF,
  img: HTMLImageElement,
  y: number,
  contentWidth: number,
  contentHeight: number,
  pageHeight: number,
  margin: number
): Promise<number> {
  const resolved = await resolveImageData(img);
  if (!resolved) return y;

  const { dataUrl, width: naturalW, height: naturalH } = resolved;

  let drawW = contentWidth;
  let drawH = (naturalH / naturalW) * drawW;

  if (drawH > contentHeight) {
    const scale = contentHeight / drawH;
    drawH = contentHeight;
    drawW = drawW * scale;
  }

  y = ensureSpace(pdf, y, drawH, pageHeight, margin);

  const x = margin + (contentWidth - drawW) / 2;
  pdf.addImage(dataUrl, imageFormat(dataUrl), x, y, drawW, drawH);
  return y + drawH + BLOCK_GAP;
}

function addCanvasSlice(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  srcY: number,
  sliceHeight: number,
  y: number,
  contentWidth: number,
  margin: number
): void {
  const sliceCanvas = document.createElement("canvas");
  sliceCanvas.width = canvas.width;
  sliceCanvas.height = sliceHeight * CANVAS_SCALE;
  const ctx = sliceCanvas.getContext("2d")!;
  ctx.drawImage(
    canvas,
    0,
    srcY * CANVAS_SCALE,
    canvas.width,
    sliceHeight * CANVAS_SCALE,
    0,
    0,
    canvas.width,
    sliceHeight * CANVAS_SCALE
  );
  pdf.addImage(
    sliceCanvas.toDataURL("image/png"),
    "PNG",
    margin,
    y,
    contentWidth,
    sliceHeight
  );
}

async function placeHtmlBlock(
  pdf: jsPDF,
  stage: HTMLDivElement,
  y: number,
  contentWidth: number,
  contentHeight: number,
  pageHeight: number,
  margin: number
): Promise<number> {
  const content = stage.querySelector(".export-content") as HTMLDivElement;
  const canvas = await html2canvas(content, {
    ...HTML2CANVAS_OPTS,
    height: content.scrollHeight + 16,
    windowHeight: content.scrollHeight + 16,
  });

  const blockHeight = canvas.height / CANVAS_SCALE;
  if (blockHeight <= 0) return y;

  if (blockHeight <= contentHeight) {
    y = ensureSpace(pdf, y, blockHeight, pageHeight, margin);
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      margin,
      y,
      contentWidth,
      blockHeight
    );
    return y + blockHeight + BLOCK_GAP;
  }

  let srcY = 0;
  while (srcY < blockHeight) {
    const remaining = blockHeight - srcY;
    const spaceOnPage = pageHeight - margin - y;
    let sliceHeight = Math.min(remaining, contentHeight, spaceOnPage);

    if (sliceHeight <= 0) {
      pdf.addPage();
      y = margin;
      sliceHeight = Math.min(remaining, contentHeight);
    }

    addCanvasSlice(pdf, canvas, srcY, sliceHeight, y, contentWidth, margin);
    srcY += sliceHeight;
    y += sliceHeight;

    if (srcY < blockHeight) {
      pdf.addPage();
      y = margin;
    }
  }

  return y + BLOCK_GAP;
}

export default function ExportMenu({ title, html }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportHtml() {
    setExporting(true);
    try {
      const displayTitle = noteDisplayTitle(title);
      const inlined = await inlineImages(html);
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${displayTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #18181b; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; }
    h2 { margin-top: 1.5rem; }
    ul { padding-left: 1.5rem; }
  </style>
</head>
<body>
  <h1>${displayTitle}</h1>
  ${inlined}
</body>
</html>`;

      const blob = new Blob([fullHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeFilename(title)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setOpen(false);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const displayTitle = noteDisplayTitle(title);
      const inlined = await inlineImages(html);
      const blocks = parseContentBlocks(inlined);

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - PDF_MARGIN * 2;
      const contentHeight = pageHeight - PDF_MARGIN * 2;

      let y = PDF_MARGIN;
      y = await renderTitle(
        pdf,
        displayTitle,
        y,
        contentWidth,
        pageHeight,
        PDF_MARGIN
      );

      const stage = createStageContainer(contentWidth);
      const content = stage.querySelector(".export-content") as HTMLDivElement;
      document.body.appendChild(stage);

      try {
        for (const block of blocks) {
          content.innerHTML = "";
          const blockEl = document.importNode(block, true) as HTMLElement;
          content.appendChild(blockEl);
          await waitForImages(content);

          const blockImage = getBlockImage(blockEl);
          if (blockImage && isImageBlock(blockEl)) {
            y = await placeImageBlock(
              pdf,
              blockImage,
              y,
              contentWidth,
              contentHeight,
              pageHeight,
              PDF_MARGIN
            );
          } else {
            y = await placeHtmlBlock(
              pdf,
              stage,
              y,
              contentWidth,
              contentHeight,
              pageHeight,
              PDF_MARGIN
            );
          }
        }
      } finally {
        document.body.removeChild(stage);
      }

      pdf.save(`${sanitizeFilename(title)}.pdf`);
    } finally {
      setExporting(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {exporting ? "Exporting…" : "Export"}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
            <button
              type="button"
              onClick={exportHtml}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Export as HTML
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Export as PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function noteDisplayTitle(title: string): string {
  return title.trim() || "Untitled note";
}

function sanitizeFilename(title: string): string {
  const safe = noteDisplayTitle(title)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[\x00-\x1f]/g, "")
    .trim()
    .replace(/[.\s]+$/g, "")
    .slice(0, 200);
  return safe || "Untitled note";
}
