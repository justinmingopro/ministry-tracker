// WYSIWYG note editor. Content is edited as a live-formatted ProseMirror doc
// (via Tiptap) but always round-trips through the same plain-Markdown dialect
// everything else in the app already speaks (bear_notes.content, Bear imports,
// the research assistant's note lookup): **bold**, *italic*, `code`, lists,
// links, blockquotes, headings, ==highlight== and Bear's single-tilde
// ~underline~. HTML is just the bridge format in memory — nothing is ever
// stored as HTML.
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { markInputRule, markPasteRule } from '@tiptap/core';
import TurndownService from 'turndown';
import { useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link2,
  Highlighter, List, ListOrdered, Quote, Heading1, Heading2,
} from 'lucide-react';
import { renderNoteMarkdown } from './noteMarkdown';

// Bear's own convention, same regex family as renderNoteMarkdown: a single
// ~like this~ means underline, never GFM strikethrough (that's ~~double~~,
// handled separately by Tiptap's built-in Strike extension).
const SingleTildeUnderline = Underline.extend({
  addInputRules() {
    return [markInputRule({ find: /(?:^|\s)(~([^~]+)~)$/, type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: /(?:^|\s)(~([^~]+)~)/g, type: this.type })];
  },
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});
turndown.addRule('scriptureHighlight', {
  filter: 'mark',
  replacement: (content) => `==${content}==`,
});
turndown.addRule('bearUnderline', {
  filter: 'u',
  replacement: (content) => `~${content}~`,
});
turndown.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`,
});
// Tiptap/ProseMirror always wraps a list item's text in a <p>, which trips
// turndown's default listItem rule into a wide 4-column gutter with a blank
// padding line after every item. Override it for the plain single-paragraph
// case (the only one these notes ever produce) to keep output matching the
// tight "- one" / "1. one" style the app has always stored.
turndown.addRule('listItem', {
  filter: 'li',
  replacement: (content, node) => {
    content = content.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n/gm, '\n  ');
    const parent = node.parentNode;
    let prefix = `${turndown.options.bulletListMarker} `;
    if (parent && /^ol$/i.test(parent.nodeName)) {
      const start = parent.getAttribute('start');
      const index = Array.prototype.indexOf.call(parent.children, node);
      prefix = `${start ? Number(start) + index : index + 1}. `;
    }
    return `${prefix}${content}\n`;
  },
});

export function markdownFromHTML(html) {
  return turndown.turndown(html || '').trim();
}

// Pasting from Bear (or anywhere that copies plain text) brings the raw
// Markdown syntax along as literal characters — e.g. "==Rev 21:3,4==" — since
// there's no HTML on the clipboard to carry real formatting. Detect that case
// and run it through the same renderer Preview mode has always used, so it
// lands in the editor already formatted instead of as literal asterisks.
function looksLikeMarkdown(text) {
  return /(\*\*|__|==[^=]|~[^~]|^#{1,3}\s|^[-*]\s|^\d+\.\s|\[.+\]\(.+\))/m.test(text);
}

const EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Link.configure({ openOnClick: false, autolink: true }),
  Highlight,
  SingleTildeUnderline,
  Placeholder.configure({
    placeholder: 'Write here… wrap a scripture reference in ==like this== to highlight and link it to wol.jw.org.',
  }),
];

const RichNoteEditor = forwardRef(function RichNoteEditor({ markdown, onChange }, ref) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: renderNoteMarkdown(markdown) || '<p></p>',
    onUpdate: ({ editor }) => onChange(markdownFromHTML(editor.getHTML())),
    editorProps: {
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain');
        if (!html && text && looksLikeMarkdown(text)) {
          event.preventDefault();
          const dom = document.createElement('div');
          dom.innerHTML = renderNoteMarkdown(text);
          const slice = PMDOMParser.fromSchema(view.state.schema).parseSlice(dom, { preserveWhitespace: true });
          view.dispatch(view.state.tr.replaceSelection(slice));
          return true;
        }
        return false;
      },
    },
  }, []);

  // Keep the editor in sync when something outside it (switching from the
  // raw Markdown tab, loading a different note) replaces the content wholesale.
  useEffect(() => {
    if (!editor) return;
    const current = markdownFromHTML(editor.getHTML());
    if (current !== markdown.trim()) {
      editor.commands.setContent(renderNoteMarkdown(markdown) || '<p></p>');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, markdown]);

  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus(),
  }));

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes('link').href;
    // eslint-disable-next-line no-alert
    const url = window.prompt('Link URL', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const ToolbarBtn = ({ active, onClick, title, children }) => (
    <button
      type="button"
      className={`richtext-btn ${active ? 'active' : ''}`}
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    >
      {children}
    </button>
  );

  return (
    <div className="richtext-editor">
      <div className="richtext-toolbar">
        <ToolbarBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarBtn>
        <ToolbarBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarBtn>
        <ToolbarBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolbarBtn>
        <ToolbarBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolbarBtn>
        <ToolbarBtn title="Highlight / scripture" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={15} /></ToolbarBtn>
        <ToolbarBtn title="Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={15} /></ToolbarBtn>
        <span className="richtext-sep" />
        <ToolbarBtn title="Heading" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></ToolbarBtn>
        <ToolbarBtn title="Subheading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolbarBtn>
        <span className="richtext-sep" />
        <ToolbarBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolbarBtn>
        <ToolbarBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarBtn>
        <ToolbarBtn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolbarBtn>
        <ToolbarBtn title="Link" active={editor.isActive('link')} onClick={setLink}><Link2 size={15} /></ToolbarBtn>
      </div>
      <EditorContent editor={editor} className="richtext-content" />
    </div>
  );
});

export default RichNoteEditor;
