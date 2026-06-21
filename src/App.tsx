// Install: npm install @tiptap/react @tiptap/pm @tiptap/starter-kit

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import "./App.css";

// ── Toolbar config: set false to hide a button ────────────────────────────────
const CONFIG = {
  bold: true,
  italic: true,
  strike: true,
  heading: false,
  bulletList: true,
  orderedList: true,
  blockquote: true,
  codeBlock: true,
  undo: true,
  redo: true,
};

// ── Simulated backend ─────────────────────────────────────────────────────────
const Backend = {
  save: (html) => localStorage.setItem("editor_content", html),
  load: () => localStorage.getItem("editor_content") || "<p>Start writing here...</p>",
};

// ── Toolbar Button ────────────────────────────────────────────────────────────
function ToolbarButton({ onClick, active, disabled, label }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={label}
      className={`toolbar-btn ${active ? "active" : ""}`}
    >
      {label}
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: Backend.load(),  // load saved HTML on mount
  });

  // Save handler — editor.getHTML() returns full HTML string
  const handleSave = () => {
    Backend.save(editor.getHTML());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!editor) return null;

  return (
    <div className="app">
      <h2>Rich Text Editor <span className="badge">TipTap + React 19</span></h2>

      <div className="editor-card">
        {/* ── Toolbar (only enabled buttons render) ── */}
        <div className="toolbar">
          {CONFIG.undo      && <ToolbarButton label="↩ Undo"      onClick={() => editor.chain().focus().undo().run()}          disabled={!editor.can().undo()} />}
          {CONFIG.redo      && <ToolbarButton label="↪ Redo"      onClick={() => editor.chain().focus().redo().run()}          disabled={!editor.can().redo()} />}
          <span className="sep" />
          {CONFIG.heading   && <ToolbarButton label="H1"          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} />}
          {CONFIG.heading   && <ToolbarButton label="H2"          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} />}
          <span className="sep" />
          {CONFIG.bold      && <ToolbarButton label="B"           onClick={() => editor.chain().focus().toggleBold().run()}         active={editor.isActive("bold")} />}
          {CONFIG.italic    && <ToolbarButton label="I"           onClick={() => editor.chain().focus().toggleItalic().run()}       active={editor.isActive("italic")} />}
          {CONFIG.strike    && <ToolbarButton label="S̶"           onClick={() => editor.chain().focus().toggleStrike().run()}       active={editor.isActive("strike")} />}
          <span className="sep" />
          {CONFIG.bulletList  && <ToolbarButton label="• List"    onClick={() => editor.chain().focus().toggleBulletList().run()}   active={editor.isActive("bulletList")} />}
          {CONFIG.orderedList && <ToolbarButton label="1. List"   onClick={() => editor.chain().focus().toggleOrderedList().run()}  active={editor.isActive("orderedList")} />}
          {CONFIG.blockquote  && <ToolbarButton label="❝ Quote"   onClick={() => editor.chain().focus().toggleBlockquote().run()}   active={editor.isActive("blockquote")} />}
          {CONFIG.codeBlock   && <ToolbarButton label="</> Code"  onClick={() => editor.chain().focus().toggleCodeBlock().run()}    active={editor.isActive("codeBlock")} />}
        </div>

        {/* ── TipTap editor area ── */}
        <EditorContent editor={editor} className="editor-body" />

        {/* ── Footer actions ── */}
        <div className="editor-footer">
          <button className="btn-preview" onClick={() => setShowPreview((s) => !s)}>
            {showPreview ? "Hide Preview" : "👁 Blog Preview"}
          </button>
          <button className="btn-save" onClick={handleSave}>
            {saved ? "✓ Saved!" : "💾 Save"}
          </button>
        </div>
      </div>

      {/* ── Blog post preview (renders same HTML identically) ── */}
      {showPreview && (
        <div className="preview-card">
          <h3>Blog Post Preview</h3>
          <div
            className="ProseMirror"  // reuse TipTap's own CSS — identical rendering
            dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
          />
        </div>
      )}

      {/* ── Raw HTML panel ── */}
      <details className="html-panel">
        <summary>View raw HTML (what gets stored in backend)</summary>
        <pre>{editor.getHTML()}</pre>
      </details>
    </div>
  );
}