import StarterKit from "@tiptap/starter-kit";

export interface EditorFeatures {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  heading: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  inlineCode: boolean;
  codeBlock: boolean;
  undo: boolean;
  redo: boolean;
}

export const EDITOR_FEATURES: EditorFeatures = {
  bold: true,
  italic: true,
  underline: true,
  strike: true,
  heading: false,
  bulletList: true,
  orderedList: true,
  blockquote: true,
  inlineCode: true,
  codeBlock: true,
  undo: true,
  redo: true,
};

export const createEditorExtensions = (
  features: EditorFeatures = EDITOR_FEATURES,
) => [
  StarterKit.configure({
    bold: features.bold ? {} : false,
    italic: features.italic ? {} : false,
    underline: features.underline ? {} : false,
    strike: features.strike ? {} : false,
    heading: features.heading ? { levels: [1, 2] } : false,
    bulletList: features.bulletList ? {} : false,
    orderedList: features.orderedList ? {} : false,
    listItem: features.bulletList || features.orderedList ? {} : false,
    listKeymap: features.bulletList || features.orderedList ? {} : false,
    blockquote: features.blockquote ? {} : false,
    code: features.inlineCode ? {} : false,
    codeBlock: features.codeBlock ? {} : false,
    undoRedo: features.undo || features.redo ? {} : false,
    link: false,
    horizontalRule: false,
  }),
];
