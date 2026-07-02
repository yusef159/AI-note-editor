import Image from "@tiptap/extension-image";
import type { Editor } from "@tiptap/core";
import { getImageNodeActions } from "@/lib/image-node-actions";

const ENHANCE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`;

const TEXT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 12H3"/><path d="M17 18H3"/><path d="M10 6H3"/><path d="m17 6 4 6-4 6"/></svg>`;

const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

function resolveImagePos(
  editor: Editor,
  getPos: () => number | undefined,
  storedPos: number | undefined
): number | null {
  const livePos = getPos();
  if (typeof livePos === "number") {
    const node = editor.state.doc.nodeAt(livePos);
    if (node?.type.name === "image") return livePos;
  }

  if (typeof storedPos === "number") {
    const node = editor.state.doc.nodeAt(storedPos);
    if (node?.type.name === "image") return storedPos;
  }

  return null;
}

function createToolbarButton(
  className: string,
  ariaLabel: string,
  icon: string,
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", ariaLabel);
  button.title = ariaLabel;
  button.innerHTML = icon;

  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  return button;
}

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-image-id": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-image-id"),
        renderHTML: (attributes) => {
          if (!attributes["data-image-id"]) return {};
          return { "data-image-id": attributes["data-image-id"] };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;
      let storedPos: number | undefined;

      const wrapper = document.createElement("div");
      wrapper.className = "image-node-wrapper";
      wrapper.contentEditable = "false";

      const toolbar = document.createElement("div");
      toolbar.className = "image-node-toolbar";
      toolbar.hidden = true;

      const img = document.createElement("img");
      img.className = "image-node-img";
      img.draggable = false;

      const getImagePos = () =>
        resolveImagePos(editor, getPos, storedPos);

      const syncImage = () => {
        img.src = currentNode.attrs.src as string;
        const imageId = currentNode.attrs["data-image-id"] as string | null;
        if (imageId) {
          img.setAttribute("data-image-id", imageId);
        } else {
          img.removeAttribute("data-image-id");
        }
      };

      const showSelection = () => {
        wrapper.classList.add("is-selected");
        toolbar.hidden = false;
      };

      const hideSelection = () => {
        wrapper.classList.remove("is-selected");
        toolbar.hidden = true;
      };

      const runAction = (action: "onEnhance" | "onExtract" | "onDelete") => {
        const pos = getImagePos();
        const handlers = getImageNodeActions();
        if (pos === null || !handlers) return;
        handlers[action](pos);
      };

      toolbar.appendChild(
        createToolbarButton(
          "image-node-toolbar-btn",
          "Enhance image",
          ENHANCE_ICON,
          () => runAction("onEnhance")
        )
      );
      toolbar.appendChild(
        createToolbarButton(
          "image-node-toolbar-btn",
          "Convert to text",
          TEXT_ICON,
          () => runAction("onExtract")
        )
      );
      toolbar.appendChild(
        createToolbarButton(
          "image-node-toolbar-btn image-node-toolbar-btn-danger",
          "Delete image",
          DELETE_ICON,
          () => runAction("onDelete")
        )
      );

      wrapper.appendChild(toolbar);
      wrapper.appendChild(img);

      img.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const pos = getImagePos();
        if (typeof pos === "number") {
          editor.commands.setNodeSelection(pos);
        }
      });

      syncImage();

      const livePos = getPos();
      if (typeof livePos === "number") storedPos = livePos;

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== "image") return false;

          const live = getPos();
          if (typeof live === "number") storedPos = live;

          const srcChanged = updatedNode.attrs.src !== currentNode.attrs.src;
          const idChanged =
            updatedNode.attrs["data-image-id"] !==
            currentNode.attrs["data-image-id"];

          currentNode = updatedNode;

          if (srcChanged || idChanged) {
            syncImage();
          }

          return true;
        },
        selectNode() {
          showSelection();
        },
        deselectNode() {
          hideSelection();
        },
        ignoreMutation(mutation) {
          if (!(mutation instanceof MutationRecord)) return false;

          if (mutation.type === "attributes") {
            const target = mutation.target;
            return (
              target === wrapper ||
              target === img ||
              target === toolbar ||
              (target instanceof globalThis.Node && toolbar.contains(target))
            );
          }

          if (mutation.type === "childList") {
            return mutation.target === toolbar;
          }

          return false;
        },
      };
    };
  },
});
