import type { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

import {
  DEFAULT_QUESTION_GROUP_COLOR,
  stylePdfContinuedLabel,
  stylePdfGroupHeader,
  stylePdfGroupWrapper,
} from "@/lib/question-group-colors";

const GROUP_PDF_CSS = `
  .qg-pdf-closed {
    border-radius: 10px;
    padding: 0.75rem 1rem 1rem;
    margin: 0;
  }
  .qg-pdf-start {
    border-radius: 10px 10px 0 0;
    padding: 0.75rem 1rem 0.5rem;
    margin: 0;
  }
  .qg-pdf-mid {
    padding: 0.5rem 1rem;
    margin: 0;
  }
  .qg-pdf-end {
    border-radius: 0 0 10px 10px;
    padding: 0.5rem 1rem 0.75rem;
    margin: 0 0 0.5rem;
  }
  .qg-pdf-continued {
    font-size: 0.7rem;
    font-weight: 600;
    margin: 0 0 0.35rem;
    padding: 0;
  }
  .question-group-header {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    padding-bottom: 0.5rem;
  }
  .qg-pdf-body > * + * { margin-top: 0.5rem; }
  img { display: block; max-width: 100%; height: auto; border-radius: 8px; }
`;

export interface ParsedQuestionGroup {
  title: string;
  colorId: string;
  nodes: HTMLElement[];
}

export function parseQuestionGroupContent(
  group: HTMLElement
): ParsedQuestionGroup {
  const title =
    group.getAttribute("data-title") ||
    (
      group.querySelector(
        ".question-group-header-input"
      ) as HTMLInputElement | null
    )?.value?.trim() ||
    group.querySelector(".question-group-header")?.textContent?.trim() ||
    "Question";

  const body =
    (group.querySelector(".question-group-body") as HTMLElement | null) ??
    group;

  const nodes = Array.from(body.children).filter(
    (child) => !child.classList.contains("question-part-label")
  ) as HTMLElement[];

  const colorId =
    group.getAttribute("data-group-color") || DEFAULT_QUESTION_GROUP_COLOR;

  return { title, colorId, nodes };
}

export function isQuestionGroupElement(el: HTMLElement): boolean {
  return el.hasAttribute("data-question-group");
}

type Html2CanvasOpts = {
  scale: number;
  useCORS: boolean;
  allowTaint: boolean;
  logging: boolean;
  backgroundColor: string;
};

type ResolveImageData = (
  img: HTMLImageElement
) => Promise<{ dataUrl: string; width: number; height: number } | null>;

type PlaceHtmlBlock = (
  pdf: jsPDF,
  stage: HTMLDivElement,
  y: number,
  contentWidth: number,
  contentHeight: number,
  pageHeight: number,
  margin: number,
  options?: { allowSlice?: boolean; blockGap?: number }
) => Promise<number>;

type EnsureSpace = (
  pdf: jsPDF,
  y: number,
  needed: number,
  pageHeight: number,
  margin: number
) => number;

function appendTitleHeader(
  container: HTMLElement,
  title: string,
  colorId: string
): void {
  const header = document.createElement("div");
  header.className = "question-group-header";
  header.textContent = title;
  stylePdfGroupHeader(header, colorId);
  container.appendChild(header);
}

function appendContinuedLabel(
  container: HTMLElement,
  title: string,
  colorId: string
): void {
  const label = document.createElement("div");
  label.className = "qg-pdf-continued";
  label.textContent = `${title} (continued)`;
  stylePdfContinuedLabel(label, colorId);
  container.appendChild(label);
}

async function measureStageContent(
  stage: HTMLDivElement,
  html2canvasOpts: Html2CanvasOpts
): Promise<number> {
  const content = stage.querySelector(".export-content") as HTMLDivElement;
  const canvas = await html2canvas(content, {
    ...html2canvasOpts,
    height: content.scrollHeight + 16,
    windowHeight: content.scrollHeight + 16,
  });
  return canvas.height / html2canvasOpts.scale;
}

async function measureNodesHeight(
  stage: HTMLDivElement,
  nodes: HTMLElement[],
  html2canvasOpts: Html2CanvasOpts,
  waitForImages: (root: ParentNode) => Promise<void>,
  maxImageHeight?: number
): Promise<number> {
  const content = stage.querySelector(".export-content") as HTMLDivElement;
  content.innerHTML = "";
  const probe = document.createElement("div");
  const body = document.createElement("div");
  body.className = "qg-pdf-body";

  for (const node of nodes) {
    if (node.tagName === "IMG" && maxImageHeight) {
      const img = document.importNode(node, true) as HTMLImageElement;
      img.style.display = "block";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.maxHeight = `${maxImageHeight}px`;
      body.appendChild(img);
    } else {
      body.appendChild(document.importNode(node, true));
    }
  }

  probe.appendChild(body);
  content.appendChild(probe);
  await waitForImages(content);
  return measureStageContent(stage, html2canvasOpts);
}

async function measureHeaderHeight(
  stage: HTMLDivElement,
  buildHeader: (container: HTMLElement) => void,
  html2canvasOpts: Html2CanvasOpts,
  waitForImages: (root: ParentNode) => Promise<void>
): Promise<number> {
  const content = stage.querySelector(".export-content") as HTMLDivElement;
  content.innerHTML = "";
  const probe = document.createElement("div");
  buildHeader(probe);
  content.appendChild(probe);
  await waitForImages(content);
  return measureStageContent(stage, html2canvasOpts);
}

function getWrapperClass(
  isFirstSegment: boolean,
  isLastSegment: boolean
): string {
  if (isFirstSegment && isLastSegment) return "qg-pdf-closed";
  if (isFirstSegment) return "qg-pdf-start";
  if (isLastSegment) return "qg-pdf-end";
  return "qg-pdf-mid";
}

function buildSegmentWrapper(
  title: string,
  nodes: HTMLElement[],
  isFirstSegment: boolean,
  contentHeight: number,
  colorId: string,
  segmentClass: string
): HTMLElement {
  const wrapper = document.createElement("div");
  const body = document.createElement("div");
  body.className = "qg-pdf-body";

  if (isFirstSegment) {
    appendTitleHeader(wrapper, title, colorId);
  } else {
    appendContinuedLabel(wrapper, title, colorId);
  }

  for (const node of nodes) {
    if (node.tagName === "IMG") {
      const img = document.importNode(node, true) as HTMLImageElement;
      img.style.display = "block";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.maxHeight = `${contentHeight - 48}px`;
      body.appendChild(img);
    } else {
      body.appendChild(document.importNode(node, true));
    }
  }

  wrapper.appendChild(body);
  wrapper.className = segmentClass;
  stylePdfGroupWrapper(wrapper, segmentClass, colorId);
  return wrapper;
}

export async function placeQuestionGroupPdf(
  pdf: jsPDF,
  stage: HTMLDivElement,
  groupEl: HTMLElement,
  y: number,
  contentWidth: number,
  contentHeight: number,
  pageHeight: number,
  margin: number,
  deps: {
    html2canvasOpts: Html2CanvasOpts;
    ensureSpace: EnsureSpace;
    placeHtmlBlock: PlaceHtmlBlock;
    resolveImageData: ResolveImageData;
    waitForImages: (root: ParentNode) => Promise<void>;
    blockGap: number;
  }
): Promise<number> {
  const { title, colorId, nodes } = parseQuestionGroupContent(groupEl);
  const content = stage.querySelector(".export-content") as HTMLDivElement;
  const styleEl = stage.querySelector("style");

  if (styleEl && !styleEl.textContent?.includes("qg-pdf-closed")) {
    styleEl.textContent += GROUP_PDF_CSS;
  }

  if (nodes.length === 0) {
    content.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "qg-pdf-closed";
    appendTitleHeader(wrapper, title, colorId);
    stylePdfGroupWrapper(wrapper, "qg-pdf-closed", colorId);
    content.appendChild(wrapper);
    await deps.waitForImages(content);
    y = deps.ensureSpace(
      pdf,
      y,
      await measureStageContent(stage, deps.html2canvasOpts),
      pageHeight,
      margin
    );
    return deps.placeHtmlBlock(
      pdf,
      stage,
      y,
      contentWidth,
      contentHeight,
      pageHeight,
      margin,
      { allowSlice: false }
    );
  }

  let nodeIndex = 0;
  let segmentIndex = 0;

  while (nodeIndex < nodes.length) {
    const isFirstSegment = segmentIndex === 0;
    let spaceOnPage = pageHeight - margin - y;

    if (spaceOnPage < 72) {
      pdf.addPage();
      y = margin;
      spaceOnPage = contentHeight;
    }

    const headerHeight = await measureHeaderHeight(
      stage,
      isFirstSegment
        ? (container) => appendTitleHeader(container, title, colorId)
        : (container) => appendContinuedLabel(container, title, colorId),
      deps.html2canvasOpts,
      deps.waitForImages
    );

    const segmentNodes: HTMLElement[] = [];
    let bodyHeight = 0;

    while (nodeIndex < nodes.length) {
      const candidate = [...segmentNodes, nodes[nodeIndex]];
      const candidateHeight = await measureNodesHeight(
        stage,
        candidate,
        deps.html2canvasOpts,
        deps.waitForImages,
        contentHeight - headerHeight - 24
      );

      if (
        segmentNodes.length > 0 &&
        headerHeight + candidateHeight > spaceOnPage
      ) {
        break;
      }

      if (
        segmentNodes.length === 0 &&
        headerHeight + candidateHeight > spaceOnPage
      ) {
        if (!isFirstSegment) {
          pdf.addPage();
          y = margin;
          spaceOnPage = contentHeight;
          break;
        }
      }

      segmentNodes.push(nodes[nodeIndex]);
      bodyHeight = candidateHeight;
      nodeIndex++;
    }

    if (segmentNodes.length === 0) {
      pdf.addPage();
      y = margin;
      continue;
    }

    const isLastSegment = nodeIndex >= nodes.length;
    const segmentClass = getWrapperClass(isFirstSegment, isLastSegment);
    const wrapper = buildSegmentWrapper(
      title,
      segmentNodes,
      isFirstSegment,
      contentHeight,
      colorId,
      segmentClass
    );

    content.innerHTML = "";
    content.appendChild(wrapper);
    await deps.waitForImages(content);

    const blockHeight = await measureStageContent(stage, deps.html2canvasOpts);
    y = deps.ensureSpace(pdf, y, blockHeight, pageHeight, margin);
    y = await deps.placeHtmlBlock(
      pdf,
      stage,
      y,
      contentWidth,
      contentHeight,
      pageHeight,
      margin,
      {
        allowSlice: false,
        blockGap: isLastSegment ? deps.blockGap : 0,
      }
    );

    segmentIndex++;

    if (nodeIndex < nodes.length) {
      pdf.addPage();
      y = margin;
    }
  }

  return y;
}
