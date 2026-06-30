import { Node, mergeAttributes } from "@tiptap/core";

export const EnhancingPlaceholder = Node.create({
  name: "enhancingPlaceholder",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-enhancing-placeholder]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-enhancing-placeholder": "",
        class: "enhancing-placeholder",
      }),
      [
        "span",
        { class: "enhancing-placeholder-spinner" },
      ],
      ["span", { class: "enhancing-placeholder-text" }, "Enhancing screenshot…"],
    ];
  },
});
