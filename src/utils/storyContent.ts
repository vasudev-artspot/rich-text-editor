import DOMPurify from "dompurify";
import type { Editor } from "@tiptap/core";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "hr",
];

const ALLOWED_ATTRIBUTES = ["href", "target", "rel", "title", "start"];

const SUPPORTED_HTML_PATTERN = new RegExp(
  `<\\/?(?:${ALLOWED_TAGS.join("|")})(?:\\s|>|\\/)`,
  "i",
);

export const sanitizeStoryHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    ALLOW_DATA_ATTR: false,
  });

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const plainTextToHtml = (content: string): string => {
  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const paragraphs = normalized.split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
};

export const deserializeStoryContent = (content: string | null | undefined): string => {
  const raw = content ?? "";
  if (!raw.trim()) return "<p></p>";

  const html = SUPPORTED_HTML_PATTERN.test(raw) ? raw : plainTextToHtml(raw);
  return sanitizeStoryHtml(html) || "<p></p>";
};

export const serializeEditorContent = (
  editor: Pick<Editor, "getHTML">,
): string => sanitizeStoryHtml(editor.getHTML());

export const hasMinimumStoryContent = (
  editor: Pick<Editor, "getText">,
  minimumLength = 10,
): boolean => editor.getText().trim().length >= minimumLength;
