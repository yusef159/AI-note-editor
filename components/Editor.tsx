"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { CustomImage } from "@/lib/extensions/custom-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EnhancingPlaceholder } from "@/lib/extensions/enhancing-placeholder";
import { enhanceImage, EnhanceError } from "@/lib/enhance-client";
import {
  getAutoEnhancePreference,
  setAutoEnhancePreference,
} from "@/lib/auto-enhance-preference";
import {
  ENHANCE_SCALE_DEFAULT,
  ENHANCE_SCALE_MAX,
  ENHANCE_SCALE_MIN,
  clampEnhanceScale,
  getEnhanceScalePreference,
  setEnhanceScalePreference,
} from "@/lib/enhance-scale-preference";
import { TEXT_COLORS, HIGHLIGHT_COLORS } from "@/lib/editor-colors";
import EditorColorPicker from "@/components/EditorColorPicker";
import { generateId } from "@/lib/uuid";

interface EditorProps {
  initialContent: string;
  onUpdate: (html: string) => void;
  onEnhanceStatus?: (status: "idle" | "enhancing" | "error") => void;
  onToast?: (message: string, type: "info" | "warning") => void;
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

function replacePlaceholderWithImage(
  editor: TiptapEditor,
  placeholderId: string,
  url: string,
  imageId: string
) {
  editor.commands.command(({ tr, state }) => {
    let pos: number | null = null;
    state.doc.descendants((node, nodePos) => {
      if (
        node.type.name === "enhancingPlaceholder" &&
        node.attrs.id === placeholderId
      ) {
        pos = nodePos;
        return false;
      }
    });
    if (pos === null) return false;
    const imageNode = state.schema.nodes.image.create({
      src: url,
      "data-image-id": imageId,
    });
    tr.replaceWith(pos, pos + 1, imageNode);
    return true;
  });
}

export default function Editor({
  initialContent,
  onUpdate,
  onEnhanceStatus,
  onToast,
}: EditorProps) {
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const editorInstanceRef = useRef<TiptapEditor | null>(null);
  const onEnhanceStatusRef = useRef(onEnhanceStatus);
  const onToastRef = useRef(onToast);
  const enqueueImageRef = useRef<(file: File) => void>(() => {});
  const autoEnhanceRef = useRef(true);
  const enhanceScaleRef = useRef(ENHANCE_SCALE_DEFAULT);
  const [autoEnhance, setAutoEnhance] = useState(true);
  const [enhanceScale, setEnhanceScale] = useState(ENHANCE_SCALE_DEFAULT);
  const [, setSelectionTick] = useState(0);

  useEffect(() => {
    const stored = getAutoEnhancePreference();
    setAutoEnhance(stored);
    autoEnhanceRef.current = stored;

    const storedScale = getEnhanceScalePreference();
    setEnhanceScale(storedScale);
    enhanceScaleRef.current = storedScale;
  }, []);

  useEffect(() => {
    onEnhanceStatusRef.current = onEnhanceStatus;
    onToastRef.current = onToast;
  }, [onEnhanceStatus, onToast]);

  const processImage = useCallback(async (file: File, placeholderId: string) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    onEnhanceStatusRef.current?.("enhancing");

    try {
      const enhanced = await enhanceImage(file, enhanceScaleRef.current);
      const url = URL.createObjectURL(enhanced);
      replacePlaceholderWithImage(
        editor,
        placeholderId,
        url,
        generateId()
      );
    } catch (err) {
      const url = URL.createObjectURL(file);
      replacePlaceholderWithImage(
        editor,
        placeholderId,
        url,
        generateId()
      );
      onToastRef.current?.(
        err instanceof EnhanceError && err.message === "You are offline"
          ? "You are offline — inserted original image"
          : "Enhancement failed — inserted original image",
        "warning"
      );
      onEnhanceStatusRef.current?.("error");
    } finally {
      onEnhanceStatusRef.current?.("idle");
    }
  }, []);

  const insertImageDirectly = useCallback((file: File) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    const url = URL.createObjectURL(file);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src: url,
          "data-image-id": generateId(),
        },
      })
      .run();
  }, []);

  const enqueueImage = useCallback(
    (file: File) => {
      if (!autoEnhanceRef.current) {
        insertImageDirectly(file);
        return;
      }

      const editor = editorInstanceRef.current;
      if (!editor) return;

      const placeholderId = generateId();
      editor
        .chain()
        .focus()
        .insertContent({
          type: "enhancingPlaceholder",
          attrs: { id: placeholderId },
        })
        .run();

      queueRef.current = queueRef.current.then(() =>
        processImage(file, placeholderId)
      );
    },
    [processImage, insertImageDirectly]
  );

  const handleEnhanceScaleChange = useCallback((value: number) => {
    const clamped = setEnhanceScalePreference(value);
    enhanceScaleRef.current = clamped;
    setEnhanceScale(clamped);
  }, []);

  const toggleAutoEnhance = useCallback(() => {
    setAutoEnhance((prev) => {
      const next = !prev;
      autoEnhanceRef.current = next;
      setAutoEnhancePreference(next);
      return next;
    });
  }, []);

  useEffect(() => {
    enqueueImageRef.current = enqueueImage;
  }, [enqueueImage]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      CustomImage.configure({ inline: false, allowBase64: true }),
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
        <div className="ml-auto flex items-center gap-3">
          <EnhanceScaleControl
            value={enhanceScale}
            enabled={autoEnhance}
            onChange={handleEnhanceScaleChange}
          />
          <AutoEnhanceToggle enabled={autoEnhance} onToggle={toggleAutoEnhance} />
        </div>
      </div>
      <EditorContent editor={editor} className="editor-content flex-1 overflow-y-auto" />
    </div>
  );
}

function EnhanceScaleControl({
  value,
  enabled,
  onChange,
}: {
  value: number;
  enabled: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    const parsed = Number(draft);
    onChange(clampEnhanceScale(parsed));
  };

  return (
    <label
      className={`flex items-center gap-2 text-sm select-none ${
        enabled
          ? "text-zinc-600 dark:text-zinc-400"
          : "text-zinc-400 dark:text-zinc-500"
      }`}
      title={`Enhancement upscale factor (${ENHANCE_SCALE_MIN}–${ENHANCE_SCALE_MAX}). Lower values keep files smaller.`}
    >
      <span>Scale</span>
      <input
        type="number"
        min={ENHANCE_SCALE_MIN}
        max={ENHANCE_SCALE_MAX}
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-sm tabular-nums text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        aria-label="Enhancement scale"
      />
      <span className="text-xs text-zinc-400 dark:text-zinc-500">×</span>
    </label>
  );
}

function AutoEnhanceToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Auto-enhance pasted images"
      onClick={onToggle}
      className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 select-none"
    >
      <span>Auto-enhance</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          enabled
            ? "bg-indigo-600 dark:bg-indigo-500"
            : "bg-zinc-300 dark:bg-zinc-600"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          } mt-0.5`}
        />
      </span>
    </button>
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
