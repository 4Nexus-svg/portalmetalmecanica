import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "strong", "em", "b", "i", "u", "s",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "div", "span",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a:   ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  "*": ["class"],
};

function plainTextToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function sanitizeContent(raw: string): string {
  // Se não contém nenhuma tag HTML, trata como texto puro
  const html = /<[a-z][\s\S]*>/i.test(raw) ? raw : plainTextToHtml(raw);
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
          ...(attribs.href?.startsWith("http") ? { target: "_blank" } : {}),
        },
      }),
    },
  });
}
