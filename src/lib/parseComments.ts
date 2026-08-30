export interface PageComment {
  page: number;
  content: string;
}

// Matches common per-page id conventions: s1, slide1, slide-1, page1,
// page-1, p1 — used as a fallback when the file has no data-page attributes
// (e.g. a facilitator guide built around <section id="s1">…</section>).
const ID_PAGE_PATTERN = /^(?:slide|page|s|p)-?(\d+)$/i;

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "header", "footer", "li", "ul", "ol",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "tr",
]);

function extractPageNumber(el: Element): number | null {
  const dataPage = el.getAttribute("data-page");
  if (dataPage !== null) {
    const n = parseInt(dataPage, 10);
    if (Number.isFinite(n)) return n;
  }
  const m = el.id.match(ID_PAGE_PATTERN);
  return m ? parseInt(m[1], 10) : null;
}

// Walks the element and turns it into readable plain text: block-level tags
// (headings, paragraphs, list items, ...) each get their own line, list
// items get a bullet, and everything else (including any script/style
// content) is dropped — no dangerouslySetInnerHTML needed downstream.
function blockTextContent(el: Element): string {
  let text = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Collapse runs of whitespace (including the newlines/indentation
      // between tags in the source markup) the way a browser would.
      text += (node.textContent ?? "").replace(/\s+/g, " ");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const child = node as Element;
    const tag = child.tagName.toLowerCase();
    if (tag === "script" || tag === "style") return;
    if (tag === "br") {
      text += "\n";
      return;
    }

    const inner = blockTextContent(child);
    if (BLOCK_TAGS.has(tag)) {
      const trimmed = inner.trim();
      if (trimmed) {
        const prefix = tag === "li" ? "• " : "";
        text += (text && !text.endsWith("\n") ? "\n" : "") + prefix + trimmed + "\n";
      }
    } else {
      text += inner;
    }
  });
  return text;
}

export function parseComments(html: string): PageComment[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((tag) => tag.remove());

  let candidates = Array.from(doc.querySelectorAll("[data-page]"));
  if (candidates.length === 0) {
    candidates = Array.from(doc.querySelectorAll("[id]")).filter((el) => ID_PAGE_PATTERN.test(el.id));
  }

  const results: PageComment[] = [];
  for (const el of candidates) {
    const page = extractPageNumber(el);
    if (page === null) continue;

    const content = blockTextContent(el)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");
    if (content) results.push({ page, content });
  }

  return results;
}

export function commentsToMap(comments: PageComment[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const c of comments) map[c.page] = c.content;
  return map;
}
