import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import {
  DEFAULT_QUESTION_GROUP_COLOR,
  QUESTION_GROUP_COLORS,
  applyQuestionGroupTheme,
  getQuestionGroupTheme,
} from "@/lib/question-group-colors";
import { findQuestionGroupStartPos } from "@/lib/question-group-editor";

function resolveQuestionGroupPos(
  editor: Editor,
  getPos: () => number | undefined,
  storedPos: number | undefined,
  groupId: string | null
): number | null {
  const livePos = getPos();
  if (typeof livePos === "number") {
    const node = editor.state.doc.nodeAt(livePos);
    if (node?.type.name === "questionGroup") return livePos;
  }

  if (typeof storedPos === "number") {
    const node = editor.state.doc.nodeAt(storedPos);
    if (
      node?.type.name === "questionGroup" &&
      (!groupId || node.attrs.id === groupId)
    ) {
      return storedPos;
    }
  }

  if (groupId) {
    return findQuestionGroupStartPos(editor, groupId);
  }

  return null;
}

export const QuestionGroup = Node.create({
  name: "questionGroup",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-question-group-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { "data-question-group-id": attributes.id };
        },
      },
      title: {
        default: "Question",
        parseHTML: (element) => {
          const header = element.querySelector(".question-group-header");
          const input = element.querySelector(
            ".question-group-header-input"
          ) as HTMLInputElement | null;
          return (
            input?.value?.trim() ||
            header?.textContent?.trim() ||
            element.getAttribute("data-title") ||
            "Question"
          );
        },
        renderHTML: (attributes) => ({
          "data-title": attributes.title ?? "Question",
        }),
      },
      color: {
        default: DEFAULT_QUESTION_GROUP_COLOR,
        parseHTML: (element) =>
          element.getAttribute("data-group-color") ||
          DEFAULT_QUESTION_GROUP_COLOR,
        renderHTML: (attributes) => ({
          "data-group-color":
            (attributes.color as string) || DEFAULT_QUESTION_GROUP_COLOR,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-question-group]",
        contentElement: ".question-group-body",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const title = (node.attrs.title as string) || "Question";
    const color =
      (node.attrs.color as string) || DEFAULT_QUESTION_GROUP_COLOR;

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-question-group": "",
        class: "question-group",
        "data-group-color": color,
      }),
      ["div", { class: "question-group-header" }, title],
      ["div", { class: "question-group-body" }, 0],
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      let storedPos: number | undefined;

      const dom = document.createElement("div");
      dom.className = "question-group";
      dom.setAttribute("data-question-group", "");

      const headerRow = document.createElement("div");
      headerRow.className = "question-group-header-row";
      headerRow.contentEditable = "false";

      const header = document.createElement("input");
      header.type = "text";
      header.className = "question-group-header-input";
      header.value = (node.attrs.title as string) || "Question";
      header.setAttribute("aria-label", "Question title");

      const colorPicker = document.createElement("div");
      colorPicker.className = "question-group-color-picker";

      const colorTrigger = document.createElement("button");
      colorTrigger.type = "button";
      colorTrigger.className = "question-group-color-trigger";
      colorTrigger.setAttribute("aria-label", "Group color");
      colorTrigger.title = "Group color";

      const colorMenu = document.createElement("div");
      colorMenu.className = "question-group-color-menu";
      colorMenu.hidden = true;

      const body = document.createElement("div");
      body.className = "question-group-body";

      colorPicker.appendChild(colorTrigger);
      colorPicker.appendChild(colorMenu);
      headerRow.appendChild(header);
      headerRow.appendChild(colorPicker);
      dom.appendChild(headerRow);
      dom.appendChild(body);

      const getGroupPos = () =>
        resolveQuestionGroupPos(
          editor,
          getPos,
          storedPos,
          (currentNode.attrs.id as string) || null
        );

      const updateColorTrigger = (colorId: string) => {
        const theme = getQuestionGroupTheme(colorId);
        colorTrigger.style.backgroundColor = theme.swatch;
      };

      const applyTheme = () => {
        const groupId = currentNode.attrs.id as string | null;
        if (groupId) {
          dom.setAttribute("data-question-group-id", groupId);
        }
        dom.setAttribute(
          "data-title",
          (currentNode.attrs.title as string) || "Question"
        );
        applyQuestionGroupTheme(
          dom,
          (currentNode.attrs.color as string) || DEFAULT_QUESTION_GROUP_COLOR,
          { header, headerRow }
        );
        updateColorTrigger(
          (currentNode.attrs.color as string) || DEFAULT_QUESTION_GROUP_COLOR
        );
      };

      const positionColorMenu = () => {
        const rect = colorTrigger.getBoundingClientRect();
        colorMenu.style.position = "fixed";
        colorMenu.style.top = `${rect.bottom + 6}px`;
        colorMenu.style.left = `${Math.max(8, rect.right - 120)}px`;
        colorMenu.style.right = "auto";
        colorMenu.style.zIndex = "100";
      };

      const closeColorMenu = () => {
        colorMenu.hidden = true;
      };

      const openColorMenu = () => {
        colorMenu.hidden = false;
        positionColorMenu();
      };

      const setGroupColor = (colorId: string) => {
        const pos = getGroupPos();
        if (pos === null) return;

        editor.commands.command(({ tr, state }) => {
          const current = state.doc.nodeAt(pos);
          if (!current || current.type.name !== "questionGroup") return false;
          tr.setNodeMarkup(pos, undefined, {
            ...current.attrs,
            color: colorId,
          });
          return true;
        });
      };

      QUESTION_GROUP_COLORS.forEach((color) => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "question-group-color-swatch";
        swatch.style.backgroundColor = color.swatch;
        swatch.title = color.name;
        swatch.setAttribute("aria-label", color.name);
        swatch.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setGroupColor(color.id);
          closeColorMenu();
        });
        colorMenu.appendChild(swatch);
      });

      colorTrigger.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      colorTrigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (colorMenu.hidden) openColorMenu();
        else closeColorMenu();
      });

      const onDocumentMouseDown = (event: MouseEvent) => {
        const target = event.target;
        if (target instanceof globalThis.Node && colorPicker.contains(target)) {
          return;
        }
        closeColorMenu();
      };

      document.addEventListener("mousedown", onDocumentMouseDown);

      const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const onDarkModeChange = () => applyTheme();
      darkModeQuery.addEventListener("change", onDarkModeChange);

      const commitTitle = () => {
        const pos = getGroupPos();
        if (pos === null) return;

        const nextTitle = header.value.trim() || "Question";
        if (nextTitle === currentNode.attrs.title) return;

        editor.commands.command(({ tr, state }) => {
          const current = state.doc.nodeAt(pos);
          if (!current || current.type.name !== "questionGroup") return false;
          tr.setNodeMarkup(pos, undefined, {
            ...current.attrs,
            title: nextTitle,
          });
          return true;
        });
      };

      header.addEventListener("blur", commitTitle);
      header.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          header.blur();
        }
      });
      header.addEventListener("mousedown", (event) => {
        event.stopPropagation();
      });

      applyTheme();

      const livePos = getPos();
      if (typeof livePos === "number") storedPos = livePos;

      return {
        dom,
        contentDOM: body,
        update(updatedNode) {
          if (updatedNode.type.name !== "questionGroup") return false;

          const live = getPos();
          if (typeof live === "number") storedPos = live;

          const colorChanged =
            updatedNode.attrs.color !== currentNode.attrs.color;
          const idChanged = updatedNode.attrs.id !== currentNode.attrs.id;
          const titleChanged =
            updatedNode.attrs.title !== currentNode.attrs.title;

          currentNode = updatedNode;

          if (
            titleChanged &&
            document.activeElement !== header
          ) {
            header.value = (updatedNode.attrs.title as string) || "Question";
          }

          if (colorChanged || idChanged) {
            applyTheme();
          }

          return true;
        },
        ignoreMutation(mutation) {
          if (!(mutation instanceof MutationRecord)) return false;

          if (mutation.type === "attributes") {
            const target = mutation.target;
            return (
              target === dom ||
              target === header ||
              target === headerRow ||
              target === colorTrigger ||
              (target instanceof globalThis.Node && colorPicker.contains(target))
            );
          }

          if (mutation.type === "childList") {
            return (
              mutation.target instanceof globalThis.Node &&
              colorPicker.contains(mutation.target)
            );
          }

          return false;
        },
        destroy() {
          document.removeEventListener("mousedown", onDocumentMouseDown);
          darkModeQuery.removeEventListener("change", onDarkModeChange);
        },
      };
    };
  },
});
