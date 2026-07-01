"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import { CustomImage } from "@/lib/extensions/custom-image";
import { CustomParagraph } from "@/lib/extensions/custom-paragraph";
import { QuestionGroup } from "@/lib/extensions/question-group";
import Placeholder from "@tiptap/extension-placeholder";
import { EnhancingPlaceholder } from "@/lib/extensions/enhancing-placeholder";
import { enhanceImage, EnhanceError } from "@/lib/enhance-client";
import { extractImage, ExtractError } from "@/lib/extract-client";
import { blocksToTiptapContent } from "@/lib/extract-blocks-to-tiptap";
import { migrateDocumentMath } from "@/lib/migrate-document-math";
import {
  insertEmptyQuestionGroup,
  insertContentAtSelection,
} from "@/lib/question-group-editor";
import {
  getPasteSettings,
  modeUsesExtract,
  setPasteSettings,
  type PasteSettings,
} from "@/lib/paste-settings";
import { TEXT_COLORS, HIGHLIGHT_COLORS } from "@/lib/editor-colors";
import EditorColorPicker from "@/components/EditorColorPicker";
import PasteSettingsPanel, {
  type ApiStatus,
} from "@/components/PasteSettingsPanel";
import AddQuestionGroupButton from "@/components/AddQuestionGroupButton";
import { generateId } from "@/lib/uuid";
import { createImageObjectUrl } from "@/lib/image-blob-registry";

export type ProcessingStatus = "idle" | "enhancing" | "extracting" | "error";

interface EditorProps {
  initialContent: string;
  onUpdate: (html: string) => void;
  onProcessingStatus?: (status: ProcessingStatus) => void;
  onToast?: (message: string, type: "info" | "warning") => void;
  apiStatus: ApiStatus;
  onPasteSettingsChange?: (settings: PasteSettings) => void;
}

function extractImageFiles(
  items: DataTransferItemList | undefined
): File[] {
  if (!items) return [];
  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

function findPlaceholderPos(
  editor: TiptapEditor,
  placeholderId: string
): number | null {
  let pos: number | null = null;
  editor.state.doc.descendants((node, nodePos) => {
    if (
      node.type.name === "enhancingPlaceholder" &&
      node.attrs.id === placeholderId
    ) {
      pos = nodePos;
      return false;
    }
  });
  return pos;
}

function replacePlaceholderWithImage(
  editor: TiptapEditor,
  placeholderId: string,
  url: string,
  imageId: string
) {
  editor.commands.command(({ tr, state }) => {
    const pos = findPlaceholderPos(editor, placeholderId);
    if (pos === null) return false;

    const imageNode = state.schema.nodes.image.create({
      src: url,
      "data-image-id": imageId,
    });
    tr.replaceWith(pos, pos + 1, imageNode);
    return true;
  });
}

function replacePlaceholderWithContent(
  editor: TiptapEditor,
  placeholderId: string,
  content: JSONContent[],
  image?: { url: string; imageId: string }
) {
  const pos = findPlaceholderPos(editor, placeholderId);
  if (pos === null) return;

  const nodes = [...content];
  if (image) {
    nodes.push({
      type: "image",
      attrs: {
        src: image.url,
        "data-image-id": image.imageId,
      },
    });
  }

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.delete(pos, pos + 1);
      return true;
    })
    .insertContentAt(pos, nodes)
    .run();
}

export default function Editor({
  initialContent,
  onUpdate,
  onProcessingStatus,
  onToast,
  apiStatus,
  onPasteSettingsChange,
}: EditorProps) {
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const editorInstanceRef = useRef<TiptapEditor | null>(null);
  const onProcessingStatusRef = useRef(onProcessingStatus);
  const onToastRef = useRef(onToast);
  const enqueueImageRef = useRef<(file: File) => void>(() => {});
  const pasteSettingsRef = useRef<PasteSettings>(getPasteSettings());
  const apiStatusRef = useRef(apiStatus);
  const [pasteSettings, setPasteSettingsState] = useState<PasteSettings>(
    getPasteSettings()
  );
  const [, setSelectionTick] = useState(0);

  useEffect(() => {
    pasteSettingsRef.current = pasteSettings;
  }, [pasteSettings]);

  useEffect(() => {
    apiStatusRef.current = apiStatus;
  }, [apiStatus]);

  useEffect(() => {
    onProcessingStatusRef.current = onProcessingStatus;
    onToastRef.current = onToast;
  }, [onProcessingStatus, onToast]);

  const handlePasteSettingsChange = useCallback(
    (settings: PasteSettings) => {
      const saved = setPasteSettings(settings);
      pasteSettingsRef.current = saved;
      setPasteSettingsState(saved);
      onPasteSettingsChange?.(saved);
    },
    [onPasteSettingsChange]
  );

  const handleAddQuestionGroup = useCallback(() => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    insertEmptyQuestionGroup(editor);
  }, []);

  const insertAtCursor = useCallback(
    (editor: TiptapEditor, content: JSONContent | JSONContent[]) => {
      insertContentAtSelection(editor, content);
    },
    []
  );

  const insertImageDirectly = useCallback(
    (file: File) => {
      const editor = editorInstanceRef.current;
      if (!editor) return;

      const imageId = generateId();
      const imageNode: JSONContent = {
        type: "image",
        attrs: {
          src: createImageObjectUrl(file, imageId),
          "data-image-id": imageId,
        },
      };

      insertAtCursor(editor, imageNode);
    },
    [insertAtCursor]
  );

  const fallbackToOriginalImage = useCallback(
    (file: File, placeholderId: string, message: string) => {
      const editor = editorInstanceRef.current;
      if (!editor) return;

      const imageId = generateId();
      const url = createImageObjectUrl(file, imageId);
      replacePlaceholderWithImage(editor, placeholderId, url, imageId);
      onToastRef.current?.(message, "warning");
      onProcessingStatusRef.current?.("error");
    },
    []
  );

  const processEnhance = useCallback(
    async (file: File, placeholderId: string) => {
      const editor = editorInstanceRef.current;
      if (!editor) return;

      if (!apiStatusRef.current.replicateConfigured) {
        fallbackToOriginalImage(
          file,
          placeholderId,
          "Replicate is not configured — inserted original image"
        );
        return;
      }

      onProcessingStatusRef.current?.("enhancing");

      try {
        const enhanced = await enhanceImage(
          file,
          pasteSettingsRef.current.enhanceScale
        );
        const imageId = generateId();
        const url = createImageObjectUrl(enhanced, imageId);
        replacePlaceholderWithImage(
          editor,
          placeholderId,
          url,
          imageId
        );
      } catch (err) {
        fallbackToOriginalImage(
          file,
          placeholderId,
          err instanceof EnhanceError && err.message === "You are offline"
            ? "You are offline — inserted original image"
            : "Enhancement failed — inserted original image"
        );
        return;
      } finally {
        onProcessingStatusRef.current?.("idle");
      }
    },
    [fallbackToOriginalImage]
  );

  const processExtract = useCallback(
    async (
      file: File,
      placeholderId: string,
      includeImage: false | "original" | "enhanced"
    ) => {
      const editor = editorInstanceRef.current;
      if (!editor) return;

      if (!apiStatusRef.current.geminiConfigured) {
        fallbackToOriginalImage(
          file,
          placeholderId,
          "Gemini is not configured — inserted original image"
        );
        return;
      }

      onProcessingStatusRef.current?.("extracting");

      try {
        const extractPromise = extractImage(file);
        const enhancePromise =
          includeImage === "enhanced"
            ? enhanceImage(file, pasteSettingsRef.current.enhanceScale).catch(
                (err) => {
                  onToastRef.current?.(
                    err instanceof EnhanceError &&
                      err.message === "You are offline"
                      ? "You are offline — using original image"
                      : "Enhancement failed — using original image",
                    "warning"
                  );
                  return null;
                }
              )
            : Promise.resolve(null);

        const [extractResult, enhancedBlob] = await Promise.all([
          extractPromise,
          enhancePromise,
        ]);

        const content = blocksToTiptapContent(extractResult.blocks);
        let image: { url: string; imageId: string } | undefined;

        if (includeImage === "original") {
          const imageId = generateId();
          image = {
            url: createImageObjectUrl(file, imageId),
            imageId,
          };
        } else if (includeImage === "enhanced") {
          const blob = enhancedBlob ?? file;
          const imageId = generateId();
          image = {
            url: createImageObjectUrl(blob, imageId),
            imageId,
          };
        }

        replacePlaceholderWithContent(editor, placeholderId, content, image);
      } catch (err) {
        fallbackToOriginalImage(
          file,
          placeholderId,
          err instanceof ExtractError && err.message === "You are offline"
            ? "You are offline — inserted original image"
            : "Text extraction failed — inserted original image"
        );
        return;
      } finally {
        onProcessingStatusRef.current?.("idle");
      }
    },
    [fallbackToOriginalImage]
  );

  const insertProcessingPlaceholder = useCallback(
    (placeholderId: string, label: string) => {
      const editor = editorInstanceRef.current;
      if (!editor) return;

      const placeholder: JSONContent = {
        type: "enhancingPlaceholder",
        attrs: { id: placeholderId, label },
      };

      insertAtCursor(editor, placeholder);
    },
    [insertAtCursor]
  );

  const enqueueImage = useCallback(
    (file: File) => {
      const { mode } = pasteSettingsRef.current;

      if (mode === "original") {
        insertImageDirectly(file);
        return;
      }

      const placeholderId = generateId();
      const label = modeUsesExtract(mode)
        ? "Extracting text…"
        : "Enhancing screenshot…";

      insertProcessingPlaceholder(placeholderId, label);

      queueRef.current = queueRef.current.then(async () => {
        switch (mode) {
          case "enhanced":
            await processEnhance(file, placeholderId);
            break;
          case "text_only":
            await processExtract(file, placeholderId, false);
            break;
          case "text_original":
            await processExtract(file, placeholderId, "original");
            break;
          case "text_enhanced":
            await processExtract(file, placeholderId, "enhanced");
            break;
        }
      });
    },
    [
      insertImageDirectly,
      insertProcessingPlaceholder,
      processEnhance,
      processExtract,
    ]
  );

  useEffect(() => {
    enqueueImageRef.current = enqueueImage;
  }, [enqueueImage]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
      }),
      CustomParagraph,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
      }),
      CustomImage.configure({ inline: false, allowBase64: true }),
      QuestionGroup,
      Placeholder.configure({
        placeholder: "Paste screenshots from your lecture recording here…",
      }),
      EnhancingPlaceholder,
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      handlePaste: (_view, event) => {
        const files = extractImageFiles(event.clipboardData?.items);
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => enqueueImageRef.current(file));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = extractImageFiles(event.dataTransfer?.items);
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => enqueueImageRef.current(file));
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      onUpdate(e.getHTML());
    },
    onCreate: ({ editor: e }) => {
      migrateDocumentMath(e);
      onUpdate(e.getHTML());
    },
  });

  useEffect(() => {
    editorInstanceRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const refreshToolbar = () => setSelectionTick((tick) => tick + 1);
    editor.on("selectionUpdate", refreshToolbar);
    editor.on("transaction", refreshToolbar);

    return () => {
      editor.off("selectionUpdate", refreshToolbar);
      editor.off("transaction", refreshToolbar);
    };
  }, [editor]);

  const currentTextColor =
    (editor?.getAttributes("textStyle").color as string | undefined) ?? null;
  const currentHighlightColor =
    (editor?.getAttributes("highlight").color as string | undefined) ?? null;

  if (!editor) {
    return (
      <div className="editor-loading animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800 h-64" />
    );
  }

  return (
    <div className="editor-wrapper flex flex-col h-full">
      <div className="editor-toolbar flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 px-4 py-2 bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="B"
          className="font-bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="I"
          className="italic"
        />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive("heading", { level: 2 })}
          label="H2"
        />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor.isActive("heading", { level: 3 })}
          label="H3"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="• List"
        />
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
        <EditorColorPicker
          editor={editor}
          colors={TEXT_COLORS}
          type="text"
          label="Text color"
          currentColor={currentTextColor}
        />
        <EditorColorPicker
          editor={editor}
          colors={HIGHLIGHT_COLORS}
          type="highlight"
          label="Highlight color"
          currentColor={currentHighlightColor}
        />
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          label="Undo"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          label="Redo"
        />
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
        <AddQuestionGroupButton onClick={handleAddQuestionGroup} />
        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
        <div className="ml-auto">
          <PasteSettingsPanel
            settings={pasteSettings}
            apiStatus={apiStatus}
            onChange={handlePasteSettingsChange}
          />
        </div>
      </div>
      <EditorContent editor={editor} className="editor-content flex-1 overflow-y-auto" />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  className = "",
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 text-sm rounded-md transition-colors ${
        active
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${className}`}
    >
      {label}
    </button>
  );
}
