import React from 'react';

function parseInline(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function MarkdownRenderer({ content }) {
  if (!content) return null;
  const lines = String(content).split(/\r?\n/);
  const elements = [];
  let listItems = [];
  let listType = 'ul';

  const flushList = (keyPrefix) => {
    if (listItems.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`list-${keyPrefix}`}>
            {listItems.map((item, i) => (
              <li key={i}>{parseInline(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`list-${keyPrefix}`}>
            {listItems.map((item, i) => (
              <li key={i}>{parseInline(item)}</li>
            ))}
          </ul>
        );
      }
      listItems = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(idx);
      return;
    }

    if (line.startsWith('#### ')) {
      flushList(idx);
      elements.push(<h4 key={idx}>{parseInline(line.slice(5))}</h4>);
    } else if (line.startsWith('### ')) {
      flushList(idx);
      elements.push(<h3 key={idx}>{parseInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      flushList(idx);
      elements.push(<h2 key={idx}>{parseInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      flushList(idx);
      elements.push(<h2 key={idx}>{parseInline(line.slice(2))}</h2>);
    } else if (/^[-*•]\s+/.test(line)) {
      if (listType !== 'ul') flushList(idx);
      listType = 'ul';
      listItems.push(line.replace(/^[-*•]\s+/, ''));
    } else if (/^\d+\.\s+/.test(line)) {
      if (listType !== 'ol') flushList(idx);
      listType = 'ol';
      listItems.push(line.replace(/^\d+\.\s+/, ''));
    } else {
      flushList(idx);
      elements.push(<p key={idx}>{parseInline(line)}</p>);
    }
  });

  flushList('end');

  return <div className="markdown-content">{elements}</div>;
}
