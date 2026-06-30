import Image from "@tiptap/extension-image";

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
});
