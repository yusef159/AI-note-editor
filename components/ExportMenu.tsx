"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface ExportMenuProps {
  title: string;
  html: string;
}

async function inlineImages(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const images = doc.querySelectorAll("img[src]");

  await Promise.all(
    Array.from(images).map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUrl);
      } catch {
        // Keep original src on failure
      }
    })
  );

  return doc.body.innerHTML;
}

export default function ExportMenu({ title, html }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportHtml() {
    setExporting(true);
    try {
      const inlined = await inlineImages(html);
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #18181b; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; }
    h2 { margin-top: 1.5rem; }
    ul { padding-left: 1.5rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
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
      const container = document.createElement("div");
      container.style.cssText =
        "position:fixed;left:-9999px;top:0;width:800px;padding:40px;background:#fff;color:#18181b;font-family:system-ui,sans-serif;line-height:1.6;";
      container.innerHTML = `<h1 style="margin-bottom:1rem">${title}</h1>${html}`;
      document.body.appendChild(container);

      const imgs = container.querySelectorAll("img");
      await Promise.all(
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
      );

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
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

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-\s]/gi, "").trim() || "lecture-notes";
}
