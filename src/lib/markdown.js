// src/lib/markdown.js
//
// Same conversion UserWall.jsx already does inline for its modal view —
// pulled out so callers that are about to *save* content (not just display
// it) can convert markdown to HTML first. Otherwise saved AI replies show
// literal '##'/'**' on the Wall's card/grid view, which renders item.content
// raw and only runs this conversion inside the modal.

export const renderMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/^---+$/gm,      '<hr/>')
    .replace(/^- (.+)$/gm,    '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g,       '</p><p>')
    .replace(/^(?!<[hul]|<hr)(.+)$/gm, (m) => m.trim() ? m : '')
    .replace(/^<\/p><p>$/, '')
    .trim();
};