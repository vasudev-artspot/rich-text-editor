import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type MouseEvent,
} from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";

import {
  createEditorExtensions,
  EDITOR_FEATURES,
  type EditorFeatures,
} from "../editorConfig";
import {
  deserializeStoryContent,
  serializeEditorContent,
} from "../utils/storyContent";

export interface RichTextEditorHandle {
  clear: () => void;
  getHTML: () => string;
  getText: () => string;
  setContent: (content: string) => void;
}

interface RichTextEditorProps {
  disabled?: boolean;
  features?: EditorFeatures;
  initialContent?: string;
}

interface ToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  title?: string;
}

const ToolbarButton = ({
  active = false,
  disabled = false,
  label,
  onClick,
  title,
}: ToolbarButtonProps) => {
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onClick();
  };

  return (
    <button
      type="button"
      onMouseDown={handleMouseDown}
      disabled={disabled}
      title={title ?? label}
      className={`toolbar-btn ${active ? "active" : ""}`}
    >
      {label}
    </button>
  );
};

export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>(function RichTextEditor(
  {
    disabled = false,
    features = EDITOR_FEATURES,
    initialContent = "<p>Start writing here...</p>",
  },
  ref,
) {
  const editor = useEditor({
    extensions: createEditorExtensions(features),
    content: deserializeStoryContent(initialContent),
    editorProps: {
      attributes: {
        "aria-label": "Story content",
      },
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => editor?.commands.setContent("<p></p>", { emitUpdate: false }),
      getHTML: () => (editor ? serializeEditorContent(editor) : ""),
      getText: () => editor?.getText() ?? "",
      setContent: (content: string) =>
        editor?.commands.setContent(deserializeStoryContent(content), {
          emitUpdate: false,
        }),
    }),
    [editor],
  );

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      blockquote: currentEditor.isActive("blockquote"),
      bold: currentEditor.isActive("bold"),
      bulletList: currentEditor.isActive("bulletList"),
      canRedo: currentEditor.can().redo(),
      canUndo: currentEditor.can().undo(),
      code: currentEditor.isActive("code"),
      codeBlock: currentEditor.isActive("codeBlock"),
      heading1: currentEditor.isActive("heading", { level: 1 }),
      heading2: currentEditor.isActive("heading", { level: 2 }),
      italic: currentEditor.isActive("italic"),
      orderedList: currentEditor.isActive("orderedList"),
      strike: currentEditor.isActive("strike"),
      underline: currentEditor.isActive("underline"),
    }),
  });

  if (!editor || !toolbarState) {
    return <div className="editor-loading">Loading editor…</div>;
  }

  return (
    <div className={`rich-editor ${disabled ? "disabled" : ""}`}>
      <div className="toolbar" aria-label="Formatting toolbar">
        {features.undo && (
          <ToolbarButton
            label="↶ Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={disabled || !toolbarState.canUndo}
          />
        )}
        {features.redo && (
          <ToolbarButton
            label="↷ Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={disabled || !toolbarState.canRedo}
          />
        )}

        {(features.undo || features.redo) && <span className="sep" />}

        {features.heading && (
          <ToolbarButton
            label="H1"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={toolbarState.heading1}
            disabled={disabled}
          />
        )}
        {features.heading && (
          <ToolbarButton
            label="H2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={toolbarState.heading2}
            disabled={disabled}
          />
        )}

        {features.bold && (
          <ToolbarButton
            label="B"
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={toolbarState.bold}
            disabled={disabled}
          />
        )}
        {features.italic && (
          <ToolbarButton
            label="I"
            title="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={toolbarState.italic}
            disabled={disabled}
          />
        )}
        {features.underline && (
          <ToolbarButton
            label="U"
            title="Underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={toolbarState.underline}
            disabled={disabled}
          />
        )}
        {features.strike && (
          <ToolbarButton
            label="S"
            title="Strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={toolbarState.strike}
            disabled={disabled}
          />
        )}
        {features.inlineCode && (
          <ToolbarButton
            label="{ }"
            title="Inline code"
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={toolbarState.code}
            disabled={disabled}
          />
        )}

        <span className="sep" />

        {features.bulletList && (
          <ToolbarButton
            label="• List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={toolbarState.bulletList}
            disabled={disabled}
          />
        )}
        {features.orderedList && (
          <ToolbarButton
            label="1. List"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={toolbarState.orderedList}
            disabled={disabled}
          />
        )}
        {features.blockquote && (
          <ToolbarButton
            label="❝ Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={toolbarState.blockquote}
            disabled={disabled}
          />
        )}
        {features.codeBlock && (
          <ToolbarButton
            label="</> Code"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={toolbarState.codeBlock}
            disabled={disabled}
          />
        )}
      </div>

      <EditorContent editor={editor} className="editor-body" />
    </div>
  );
});
