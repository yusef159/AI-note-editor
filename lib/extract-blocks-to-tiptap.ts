import type { JSONContent } from "@tiptap/core";
import type { ExtractBlock } from "@/lib/extract-blocks-to-html";

const LATEX_COMMAND_RE = /\\[a-zA-Z]+/;
const INLINE_MATH_RE = /\$(?!\d+\$)(.+?)\$(?!\d)/g;

export function isLikelyLatexLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (LATEX_COMMAND_RE.test(trimmed)) return true;
  return (
    /^[\s\\^_{}()+=\-*/|[\]0-9.,A-Za-z]+$/.test(trimmed) &&
    /[\\^_{}]/.test(trimmed)
  );
}

function unwrapLatexDelimiters(text: string): {
  latex: string;
  mode: "inline" | "block" | "mixed";
} {
  const trimmed = text.trim();

  if (
    trimmed.startsWith("$$") &&
    trimmed.endsWith("$$") &&
    trimmed.length > 4
  ) {
    return { latex: trimmed.slice(2, -2).trim(), mode: "block" };
  }

  if (
    trimmed.startsWith("$") &&
    trimmed.endsWith("$") &&
    !trimmed.startsWith("$$") &&
    trimmed.length > 2
  ) {
    return { latex: trimmed.slice(1, -1).trim(), mode: "inline" };
  }

  return { latex: trimmed, mode: "mixed" };
}

function shouldUseBlockMath(latex: string): boolean {
  return (
    latex.length > 72 ||
    /\\(int|frac|sum|prod|begin\{)/.test(latex) ||
    latex.includes("\\implies")
  );
}

function inlineMathNode(latex: string): JSONContent {
  return { type: "inlineMath", attrs: { latex: latex.trim() } };
}

function blockMathNode(latex: string): JSONContent {
  return { type: "blockMath", attrs: { latex: latex.trim() } };
}

export function parseTextToInlineNodes(text: string): JSONContent[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const unwrapped = unwrapLatexDelimiters(trimmed);

  if (unwrapped.mode === "inline") {
    return [inlineMathNode(unwrapped.latex)];
  }

  if (unwrapped.mode === "mixed" && isLikelyLatexLine(trimmed)) {
    return [inlineMathNode(trimmed)];
  }

  const nodes: JSONContent[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(INLINE_MATH_RE.source, "g");
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) nodes.push({ type: "text", text: before });

    nodes.push(inlineMathNode(match[1]));
    lastIndex = match.index + match[0].length;
  }

  const after = text.slice(lastIndex);
  if (after) nodes.push({ type: "text", text: after });

  if (nodes.length === 0) {
    return [{ type: "text", text }];
  }

  return nodes;
}

export function textToBlockNodes(text: string): JSONContent[] {
  const trimmed = text.trim();
  if (!trimmed) return [{ type: "paragraph" }];

  const unwrapped = unwrapLatexDelimiters(trimmed);

  if (unwrapped.mode === "block") {
    return [blockMathNode(unwrapped.latex)];
  }

  if (unwrapped.mode === "inline") {
    return [
      {
        type: "paragraph",
        content: [inlineMathNode(unwrapped.latex)],
      },
    ];
  }

  if (isLikelyLatexLine(trimmed)) {
    if (shouldUseBlockMath(trimmed)) {
      return [blockMathNode(trimmed)];
    }
    return [{ type: "paragraph", content: [inlineMathNode(trimmed)] }];
  }

  return [{ type: "paragraph", content: parseTextToInlineNodes(trimmed) }];
}

function paragraphWithClass(
  className: string,
  prefix: string,
  text: string
): JSONContent {
  const body = text.trim();

  return {
    type: "paragraph",
    attrs: { class: className },
    content: [
      {
        type: "text",
        marks: [{ type: "bold" }],
        text: prefix,
      },
      ...parseTextToInlineNodes(body),
    ],
  };
}

function appendQuestionAnswerBlock(
  content: JSONContent[],
  className: string,
  prefix: string,
  text: string
): void {
  const body = text.trim();
  if (!body) return;

  if (isLikelyLatexLine(body) && shouldUseBlockMath(body) && !body.includes("$")) {
    content.push({
      type: "paragraph",
      attrs: { class: className },
      content: [{ type: "text", marks: [{ type: "bold" }], text: prefix }],
    });
    content.push(blockMathNode(body));
    return;
  }

  content.push(paragraphWithClass(className, prefix, body));
}

export function blocksToTiptapContent(blocks: ExtractBlock[]): JSONContent[] {
  if (blocks.length === 0) {
    return [{ type: "paragraph" }];
  }

  const content: JSONContent[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;

    content.push({
      type: "bulletList",
      content: bulletBuffer.map((text) => {
        const blockNodes = textToBlockNodes(text);
        const first = blockNodes[0];

        if (first?.type === "blockMath") {
          return {
            type: "listItem",
            content: [first],
          };
        }

        return {
          type: "listItem",
          content:
            first?.type === "paragraph"
              ? [first]
              : [{ type: "paragraph", content: parseTextToInlineNodes(text) }],
        };
      }),
    });

    bulletBuffer = [];
  };

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;

    switch (block.type) {
      case "heading": {
        flushBullets();
        content.push({
          type: "heading",
          attrs: { level: block.level === 3 ? 3 : 2 },
          content: parseTextToInlineNodes(text),
        });
        break;
      }
      case "paragraph": {
        flushBullets();
        content.push(...textToBlockNodes(text));
        break;
      }
      case "question": {
        flushBullets();
        appendQuestionAnswerBlock(content, "extract-question", "Q: ", text);
        break;
      }
      case "answer": {
        flushBullets();
        appendQuestionAnswerBlock(content, "extract-answer", "A: ", text);
        break;
      }
      case "bullet": {
        bulletBuffer.push(text);
        break;
      }
    }
  }

  flushBullets();
  return content.length > 0 ? content : [{ type: "paragraph" }];
}
