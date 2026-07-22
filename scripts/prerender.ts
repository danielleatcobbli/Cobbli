import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const PROJECT_ID = process.env.SANITY_PROJECT_ID || "n9kxgpbl";
const DATASET = process.env.SANITY_DATASET || "production";
const API_VERSION = "2026-07-16";
const SITE_URL = (process.env.SITE_URL || "https://cobbli.com").replace(/\/$/, "");
const DIST_DIR = resolve("dist");

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: false,
  token: process.env.SANITY_READ_TOKEN,
});

const imageBuilder = createImageUrlBuilder(sanity);

type PortableTextSpan = {
  _key?: string;
  _type: "span";
  text?: string;
  marks?: string[];
};

type PortableTextMarkDefinition = {
  _key: string;
  _type: string;
  href?: string;
};

type PortableTextBlock = {
  _key?: string;
  _type: string;
  style?: string;
  children?: PortableTextSpan[];
  markDefs?: PortableTextMarkDefinition[];
  asset?: unknown;
  alt?: string;
  caption?: string;
  url?: string;
};

type SanityPost = {
  _id: string;
  title: string;
  slug: string;
  publishedAt: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  coverImage?: unknown;
  coverAlt?: string;
  body?: PortableTextBlock[];
  authorName?: string;
};

const POSTS_QUERY = `*[
  _type == "post" &&
  defined(slug.current) &&
  (!defined(publishedAt) || publishedAt <= now())
] | order(coalesce(publishedAt, _createdAt) desc) {
  _id,
  title,
  "slug": slug.current,
  "publishedAt": coalesce(publishedAt, _createdAt),
  "excerpt": coalesce(excerpt, description),
  "seoTitle": coalesce(seoTitle, seo.title, metaTitle),
  "seoDescription": coalesce(seoDescription, seo.description, metaDescription),
  "coverImage": coalesce(mainImage, coverImage),
  "coverAlt": coalesce(mainImage.alt, coverImage.alt),
  body,
  "authorName": coalesce(author->name, authorName)
}`;

function imageUrl(source: unknown, width: number) {
  if (!source) return undefined;

  try {
    return imageBuilder.image(source).width(width).auto("format").url();
  } catch {
    return undefined;
  }
}

function plainText(blocks: PortableTextBlock[] = []) {
  return blocks
    .filter((block) => block._type === "block")
    .map((block) => block.children?.map((child) => child.text || "").join("") || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}…`;
}

function descriptionFor(post: SanityPost) {
  return truncate(
    post.seoDescription?.trim() ||
      post.excerpt?.trim() ||
      plainText(post.body) ||
      `Read ${post.title} on the Cobbli blog.`,
    160,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function renderSpan(
  span: PortableTextSpan,
  markDefinitions: PortableTextMarkDefinition[],
): ReactNode {
  let content: ReactNode = span.text || "";

  for (const mark of span.marks || []) {
    const definition = markDefinitions.find((item) => item._key === mark);

    if (definition?._type === "link" && definition.href) {
      const external = /^https?:\/\//.test(definition.href);
      content = createElement(
        "a",
        {
          href: definition.href,
          rel: external ? "noopener noreferrer" : undefined,
          target: external ? "_blank" : undefined,
        },
        content,
      );
    } else if (mark === "strong") {
      content = createElement("strong", null, content);
    } else if (mark === "em") {
      content = createElement("em", null, content);
    } else if (mark === "underline") {
      content = createElement("u", null, content);
    } else if (mark === "code") {
      content = createElement("code", null, content);
    }
  }

  return createElement("span", { key: span._key }, content);
}

function renderPortableText(blocks: PortableTextBlock[] = []) {
  return blocks.map((block, index) => {
    const key = block._key || `block-${index}`;

    if (block._type === "videoEmbed" && block.url) {
      const embedUrl = toVideoEmbedUrl(block.url);
      if (!embedUrl) return null;

      return createElement(
        "figure",
        { key },
        createElement("iframe", {
          src: embedUrl,
          title: block.caption || "Embedded video",
          loading: "lazy",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          allowFullScreen: true,
          className: "aspect-video w-full rounded-lg",
        }),
        block.caption ? createElement("figcaption", null, block.caption) : null,
      );
    }

    if (block._type === "image") {
      const src = imageUrl(block, 1200);
      if (!src) return null;

      return createElement(
        "figure",
        { key },
        createElement("img", {
          src,
          alt: block.alt || "",
          loading: "lazy",
          width: 1200,
        }),
        block.caption ? createElement("figcaption", null, block.caption) : null,
      );
    }

    if (block._type !== "block") return null;

    const children = (block.children || []).map((span) =>
      renderSpan(span, block.markDefs || []),
    );
    const tag =
      block.style === "h2"
        ? "h2"
        : block.style === "h3"
          ? "h3"
          : block.style === "h4"
            ? "h4"
            : block.style === "blockquote"
              ? "blockquote"
              : "p";

    return createElement(tag, { key }, children);
  });
}

function toVideoEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
    }

    if (hostname === "youtube.com") {
      const id = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
    }

    if (hostname === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function BlogIndex({ posts }: { posts: SanityPost[] }) {
  return createElement(
    "main",
    null,
    createElement(
      "div",
      {
        style: {
          background:
            "linear-gradient(180deg, #fff8ec 0%, rgba(255,248,236,0) 100%)",
        },
      },
      createElement(
        "header",
        { className: "container max-w-6xl py-14 md:py-20 text-center" },
        createElement(
          "p",
          {
            className: "mb-3 text-xs font-semibold uppercase tracking-[0.2em]",
            style: { color: "rgba(61,23,0,0.55)" },
          },
          "The Cobbli Journal",
        ),
        createElement(
          "h1",
          {
            className: "font-display text-4xl md:text-6xl",
            style: { color: "#3d1700" },
          },
          "Behind the Workbench",
        ),
        createElement(
          "p",
          { className: "mx-auto mt-4 max-w-xl text-base md:text-lg text-foreground/70" },
          "Shoe care tips, workshop stories, and updates from the people building Cobbli.",
        ),
      ),
    ),
    createElement(
      "div",
      { className: "container max-w-6xl py-12 md:py-16" },
      posts.length === 0
        ? createElement(
          "section",
          { className: "rounded-lg border border-dashed p-12 text-center" },
          createElement(
            "h2",
            {
              className: "font-display text-2xl mb-2",
              style: { color: "#3d1700" },
            },
            "No posts yet",
          ),
          createElement(
            "p",
            { className: "text-muted-foreground" },
            "Check back soon — we're preparing our first stories.",
          ),
        )
      : createElement(
          "section",
          {
            className:
              "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8",
            "aria-label": "Blog posts",
          },
          posts.map((post) => {
            const cover = imageUrl(post.coverImage, 900);
            return createElement(
              "article",
              {
                key: post._id,
                className: "group flex flex-col rounded-lg overflow-hidden border bg-card",
              },
              createElement(
                "a",
                { href: `/blog/${post.slug}` },
                cover
                  ? createElement("img", {
                      src: cover,
                      alt: post.coverAlt || "",
                      className: "aspect-[16/10] w-full object-cover",
                      loading: "lazy",
                      width: 900,
                      height: 563,
                    })
                  : createElement(
                      "div",
                      {
                        className: "flex aspect-[16/10] w-full items-center justify-center p-6",
                        style: { backgroundColor: "#f6ead9" },
                      },
                      createElement(
                        "span",
                        {
                          "aria-hidden": "true",
                          className:
                            "font-cursive italic line-clamp-3 text-center text-4xl font-semibold leading-snug",
                          style: { color: "#3d1700", opacity: 0.85 },
                        },
                        post.title,
                      ),
                    ),
                createElement(
                  "div",
                  { className: "flex flex-col gap-2 p-5" },
                  createElement(
                    "time",
                    {
                      className:
                        "text-xs uppercase tracking-wide text-muted-foreground",
                      dateTime: post.publishedAt,
                    },
                    formatDate(post.publishedAt),
                  ),
                  createElement(
                    "h2",
                    {
                      className: "font-display text-xl leading-tight",
                      style: { color: "#3d1700" },
                    },
                    post.title,
                  ),
                  createElement(
                    "p",
                    { className: "text-sm text-foreground/80" },
                    truncate(post.excerpt?.trim() || plainText(post.body), 180),
                  ),
                ),
              ),
            );
          }),
        ),
    ),
  );
}

function BlogArticle({ post }: { post: SanityPost }) {
  const cover = imageUrl(post.coverImage, 1400);

  return createElement(
    "main",
    null,
    createElement(
      "article",
      null,
      createElement(
        "div",
        {
          style: {
            background:
              "linear-gradient(180deg, #fff8ec 0%, rgba(255,248,236,0) 100%)",
          },
        },
        createElement(
          "div",
          { className: "container max-w-3xl py-10 md:py-16" },
          createElement(
            "a",
            {
              href: "/blog",
              className: "mb-6 inline-block text-sm font-medium",
              style: { color: "#3d1700" },
            },
            "← All posts",
          ),
          createElement(
            "p",
            {
              className: "mb-4 text-xs font-semibold uppercase tracking-[0.2em]",
              style: { color: "rgba(61,23,0,0.55)" },
            },
            "The Cobbli Journal",
          ),
          createElement(
            "h1",
            {
              className: "font-display text-3xl md:text-5xl leading-tight mb-5",
              style: { color: "#3d1700" },
            },
            post.title,
          ),
          createElement(
            "div",
            { className: "flex items-center gap-3 text-sm text-foreground/70" },
            createElement(
              "span",
              {
                className: "font-medium",
                style: { color: "#3d1700" },
              },
              post.authorName || "Cobbli",
            ),
            createElement("span", { "aria-hidden": "true" }, "·"),
            createElement(
              "time",
              { dateTime: post.publishedAt },
              formatDate(post.publishedAt),
            ),
          ),
        ),
      ),
      createElement(
        "div",
        { className: "container max-w-3xl py-10 md:py-14" },
        cover
          ? createElement("img", {
              src: cover,
              alt: post.coverAlt || "",
              className: "mb-10 rounded-2xl w-full h-auto object-cover",
              width: 1400,
            })
          : null,
        createElement(
          "div",
          {
            className:
              "prose prose-lg max-w-none [&_h2]:font-display [&_h3]:font-display",
          },
          renderPortableText(post.body),
        ),
      ),
    ),
  );
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceMetaTag(
  html: string,
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  const tag = `<meta ${attribute}="${key}" content="${escapeAttribute(content)}" />`;
  const pattern = new RegExp(
    `<meta\\s+${attribute}=["']${key}["'][^>]*>`,
    "i",
  );
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `    ${tag}\n  </head>`);
}

function buildDocument(
  shell: string,
  content: ReactNode,
  metadata: {
    title: string;
    description: string;
    canonical: string;
    image?: string;
    type: "website" | "article";
    jsonLd?: Record<string, unknown>;
  },
) {
  let html = shell.replace(
    '<div id="root"></div>',
    `<div id="root">${renderToStaticMarkup(content)}</div>`,
  );

  html = html.replace(
    /\s*<!-- Preload the homepage hero image as a priority asset -->\s*<link[^>]+hero-cobbler\.webp[^>]*>/i,
    "",
  );
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeAttribute(metadata.title)}</title>`);
  html = replaceMetaTag(html, "name", "description", metadata.description);
  html = replaceMetaTag(html, "property", "og:title", metadata.title);
  html = replaceMetaTag(html, "property", "og:description", metadata.description);
  html = replaceMetaTag(html, "property", "og:type", metadata.type);
  html = replaceMetaTag(html, "property", "og:url", metadata.canonical);
  html = replaceMetaTag(html, "name", "twitter:card", "summary_large_image");
  html = replaceMetaTag(html, "name", "twitter:title", metadata.title);
  html = replaceMetaTag(html, "name", "twitter:description", metadata.description);

  if (metadata.image) {
    html = replaceMetaTag(html, "property", "og:image", metadata.image);
    html = replaceMetaTag(html, "name", "twitter:image", metadata.image);
  }

  const canonical = `<link rel="canonical" href="${escapeAttribute(metadata.canonical)}" />`;
  html = html.replace("</head>", `    ${canonical}\n  </head>`);

  if (metadata.jsonLd) {
    const jsonLd = JSON.stringify(metadata.jsonLd).replaceAll("<", "\\u003c");
    html = html.replace(
      "</head>",
      `    <script type="application/ld+json">${jsonLd}</script>\n  </head>`,
    );
  }

  return html;
}

function writeRoute(route: string, html: string) {
  const outputDirectory = resolve(DIST_DIR, route.replace(/^\/+/, ""));
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, "index.html"), html, "utf8");
}

async function prerender() {
  const shellPath = resolve(DIST_DIR, "index.html");
  if (!existsSync(shellPath)) {
    throw new Error("dist/index.html was not found. Run vite build before prerendering.");
  }

  const shell = readFileSync(shellPath, "utf8");
  const posts = await sanity.fetch<SanityPost[]>(POSTS_QUERY);

  const indexTitle = "Behind the Workbench | Cobbli";
  const indexDescription =
    "Shoe care tips, workshop stories, and updates from the people building Cobbli.";
  writeRoute(
    "/blog",
    buildDocument(shell, createElement(BlogIndex, { posts }), {
      title: indexTitle,
      description: indexDescription,
      canonical: `${SITE_URL}/blog`,
      type: "website",
    }),
  );

  for (const post of posts) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(post.slug)) {
      throw new Error(`Unsafe or invalid Sanity slug: ${post.slug}`);
    }

    const canonical = `${SITE_URL}/blog/${post.slug}`;
    const description = descriptionFor(post);
    const cover = imageUrl(post.coverImage, 1400);
    const title = post.seoTitle?.trim() || `${post.title} | Cobbli`;

    writeRoute(
      `/blog/${post.slug}`,
      buildDocument(shell, createElement(BlogArticle, { post }), {
        title,
        description,
        canonical,
        image: cover,
        type: "article",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description,
          image: cover ? [cover] : undefined,
          datePublished: post.publishedAt,
          dateModified: post.publishedAt,
          author: {
            "@type": "Organization",
            name: post.authorName || "Cobbli",
          },
          publisher: {
            "@type": "Organization",
            name: "Cobbli",
            url: SITE_URL,
          },
          mainEntityOfPage: canonical,
        },
      }),
    );
  }

  console.log(`Prerendered /blog and ${posts.length} Sanity blog post(s).`);
}

prerender().catch((error: unknown) => {
  console.error("Blog prerender failed:", error);
  process.exitCode = 1;
});
