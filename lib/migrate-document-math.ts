import type { Editor } from "@tiptap/core";
import { createMathMigrateTransaction } from "@tiptap/extension-mathematics";
import { isLikelyLatexLine } from "@/lib/extract-blocks-to-tiptap";

function shouldUseBlockMath(latex: string): boolean {
  return (
    latex.length > 72 ||
    /\\(int|frac|sum|prod|begin\{)/.test(latex) ||
    latex.includes("\\implies")
  );
}

export function migrateRawLatexStrings(editor: Editor): void {
  const { inlineMath, blockMath, paragraph } = editor.schema.nodes;
  if (!inlineMath || !blockMath || !paragraph) return;

  const tr = editor.state.tr;

  tr.doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return;
    if (node.childCount !== 1) return;

    const child = node.firstChild;
    if (!child?.isText || !child.text) return;

    const text = child.text.trim();
    if (!text || text.includes("$") || !isLikelyLatexLine(text)) return;

    const replacement = shouldUseBlockMath(text)
      ? blockMath.create({ latex: text })
      : paragraph.create({}, [inlineMath.create({ latex: text })]);

    tr.replaceWith(pos, pos + node.nodeSize, replacement);
  });

  tr.setMeta("addToHistory", false);
  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }
}

export function migrateDocumentMath(editor: Editor): void {
  const tr = createMathMigrateTransaction(editor, editor.state.tr);
  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }
  migrateRawLatexStrings(editor);
}
