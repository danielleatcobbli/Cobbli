import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Quote, Link as LinkIcon, Heading2, Heading3, Image as ImageIcon, Undo, Redo } from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  onRequestImageUpload?: () => Promise<string | null>;
};

const btn = "inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors";
const btnActive = "bg-muted";

const RichTextEditor = ({ value, onChange, onRequestImageUpload }: Props) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "underline" } }),
      Image,
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[280px] px-4 py-3 [&_h2]:font-display [&_h3]:font-display",
      },
    },
  });

  // Keep the editor in sync if the parent resets the value externally
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertImage = async () => {
    if (!onRequestImageUpload) return;
    const url = await onRequestImageUpload();
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`${btn} ${editor.isActive("bold") ? btnActive : ""}`} aria-label="Bold"><Bold size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${btn} ${editor.isActive("italic") ? btnActive : ""}`} aria-label="Italic"><Italic size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${btn} ${editor.isActive("heading", { level: 2 }) ? btnActive : ""}`} aria-label="Heading 2"><Heading2 size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`${btn} ${editor.isActive("heading", { level: 3 }) ? btnActive : ""}`} aria-label="Heading 3"><Heading3 size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${btn} ${editor.isActive("bulletList") ? btnActive : ""}`} aria-label="Bullet list"><List size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${btn} ${editor.isActive("orderedList") ? btnActive : ""}`} aria-label="Ordered list"><ListOrdered size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`${btn} ${editor.isActive("blockquote") ? btnActive : ""}`} aria-label="Quote"><Quote size={16} /></button>
        <button type="button" onClick={setLink} className={`${btn} ${editor.isActive("link") ? btnActive : ""}`} aria-label="Link"><LinkIcon size={16} /></button>
        {onRequestImageUpload && (
          <button type="button" onClick={insertImage} className={btn} aria-label="Insert image"><ImageIcon size={16} /></button>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btn} aria-label="Undo"><Undo size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btn} aria-label="Redo"><Redo size={16} /></button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
