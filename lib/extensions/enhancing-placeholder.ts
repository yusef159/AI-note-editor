import { Node, mergeAttributes } from "@tiptap/core";

export const EnhancingPlaceholder = Node.create({
  name: "enhancingPlaceholder",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      label: { default: "Processing screenshot…" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-enhancing-placeholder]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-enhancing-placeholder": "",
        class: "enhancing-placeholder",
      }),
      ["span", { class: "enhancing-placeholder-spinner" }],
      [
        "span",
        { class: "enhancing-placeholder-text" },
        node.attrs.label ?? "Processing screenshot…",
      ],
    ];
  },
});
