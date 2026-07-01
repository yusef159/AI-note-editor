export type ExtractBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "question"; text: string }
  | { type: "answer"; text: string }
  | { type: "bullet"; text: string };

export interface ExtractResult {
  blocks: ExtractBlock[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function blocksToHtml(blocks: ExtractBlock[]): string {
  if (blocks.length === 0) {
    return "<p></p>";
  }

  const parts: string[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    parts.push(
      `<ul>${bulletBuffer.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>`
    );
    bulletBuffer = [];
  };

  for (const block of blocks) {
    const text = escapeHtml(block.text.trim());
    if (!text) continue;

    switch (block.type) {
      case "heading": {
        flushBullets();
        const tag = block.level === 3 ? "h3" : "h2";
        parts.push(`<${tag}>${text}</${tag}>`);
        break;
      }
      case "paragraph": {
        flushBullets();
        parts.push(`<p>${text}</p>`);
        break;
      }
      case "question": {
        flushBullets();
        parts.push(`<p class="extract-question"><strong>Q:</strong> ${text}</p>`);
        break;
      }
      case "answer": {
        flushBullets();
        parts.push(`<p class="extract-answer"><strong>A:</strong> ${text}</p>`);
        break;
      }
      case "bullet": {
        bulletBuffer.push(block.text.trim());
        break;
      }
    }
  }

  flushBullets();
  return parts.length > 0 ? parts.join("") : "<p></p>";
}
