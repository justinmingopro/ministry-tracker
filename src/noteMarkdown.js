import { marked } from 'marked';

// Shared by the Notes Markdown preview, search result snippets, and the
// WYSIWYG editor's HTML bridge (RichNoteEditor.js) — turns ==highlighted==
// spans into <mark>, then renders the rest as normal Markdown. The real
// scripture_refs (used for actual clickable wol.jw.org links once saved) are
// parsed server-side in api/bear-import.js — this is just visual formatting.
export function renderNoteMarkdown(content) {
  if (!content?.trim()) return '';
  const processed = content
    .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
    // Real strikethrough (double tilde) first, so it's fully consumed
    // before the single-tilde rule below can misfire on half of a pair.
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    // Bear's own convention: a single ~like this~ means underline, not
    // strikethrough — marked's GFM tilde handling would otherwise treat
    // it as strikethrough, which doesn't match what these notes meant
    // in Bear.
    .replace(/~([^~\n]+)~/g, '<u>$1</u>');
  return marked.parse(processed);
}
