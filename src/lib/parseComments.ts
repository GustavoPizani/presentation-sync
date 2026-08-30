export interface PageComment {
  page: number;
  content: string;
}

// Parses elements marked with data-page="N" out of an uploaded HTML file
// into plain text (tags stripped, <br> turned into newlines) so it's safe
// to render directly on the controller without dangerouslySetInnerHTML.
export function parseComments(html: string): PageComment[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = doc.querySelectorAll("[data-page]");
  const results: PageComment[] = [];

  nodes.forEach((el) => {
    const page = parseInt(el.getAttribute("data-page") || "", 10);
    if (!Number.isFinite(page)) return;

    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script, style").forEach((tag) => tag.remove());
    clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    const content = (clone.textContent || "").trim();
    if (content) results.push({ page, content });
  });

  return results;
}

export function commentsToMap(comments: PageComment[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const c of comments) map[c.page] = c.content;
  return map;
}
