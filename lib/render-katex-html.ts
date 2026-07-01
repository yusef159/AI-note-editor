import katex from "katex";

export function renderKatexInElement(root: ParentNode): void {
  const nodes = root.querySelectorAll(
    '[data-type="inline-math"][data-latex], [data-type="block-math"][data-latex], span[data-latex]:not(.katex)'
  );

  for (const node of Array.from(nodes)) {
    const element = node as HTMLElement;
    if (element.querySelector(".katex")) continue;

    const latex = element.getAttribute("data-latex");
    if (!latex) continue;

    const displayMode =
      element.getAttribute("data-type") === "block-math" ||
      element.tagName === "DIV";

    try {
      katex.render(latex, element, {
        throwOnError: false,
        displayMode,
      });
    } catch {
      element.textContent = latex;
    }
  }
}

export function renderKatexInHtml(html: string): string {
  if (typeof document === "undefined") return html;

  const container = document.createElement("div");
  container.innerHTML = html;
  renderKatexInElement(container);
  return container.innerHTML;
}
