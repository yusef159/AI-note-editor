import type { Editor as TiptapEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { generateId } from "@/lib/uuid";

export function countQuestionGroups(editor: TiptapEditor): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "questionGroup") count += 1;
  });
  return count;
}

export function findQuestionGroupStartPos(
  editor: TiptapEditor,
  groupId: string
): number | null {
  let startPos: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "questionGroup" && node.attrs.id === groupId) {
      startPos = pos;
      return false;
    }
  });

  return startPos;
}

export function findQuestionGroupEndPos(
  editor: TiptapEditor,
  groupId: string
): number | null {
  let endPos: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "questionGroup" && node.attrs.id === groupId) {
      endPos = pos + node.nodeSize - 1;
      return false;
    }
  });

  return endPos;
}

export function isSelectionInsideQuestionGroup(editor: TiptapEditor): boolean {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "questionGroup") return true;
  }
  return false;
}

export function createQuestionGroupShell(
  title: string,
  groupId: string,
  innerContent: JSONContent[] = [{ type: "paragraph" }]
): JSONContent {
  return {
    type: "questionGroup",
    attrs: { id: groupId, title },
    content: innerContent,
  };
}

export function insertEmptyQuestionGroup(editor: TiptapEditor): boolean {
  const groupId = generateId();
  const title = `Question ${countQuestionGroups(editor) + 1}`;
  const shell = createQuestionGroupShell(title, groupId);

  const inserted = editor.chain().focus().insertContent(shell).run();
  if (!inserted) return false;

  const groupStart = findQuestionGroupStartPos(editor, groupId);
  if (groupStart === null) return true;

  const insidePos = groupStart + 1;
  const { doc } = editor.state;
  const selection = TextSelection.near(doc.resolve(insidePos), 1);
  editor.view.dispatch(editor.state.tr.setSelection(selection));
  editor.commands.focus();

  return true;
}

export function insertContentAtSelection(
  editor: TiptapEditor,
  content: JSONContent | JSONContent[]
): void {
  editor.chain().focus().insertContent(content).run();
}
