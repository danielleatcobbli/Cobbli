import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import { toPlainText, type PortableTextBlock } from "@portabletext/react";

const PROJECT_ID = "n9kxgpbl";
const DATASET = "production";
const API_VERSION = "2026-07-16";

export const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: true,
  perspective: "published",
});

const imageBuilder = createImageUrlBuilder(sanity);

export type SanityImage = {
  _key?: string;
  _type: "image";
  asset?: {
    _type: "reference";
    _ref: string;
  };
  alt?: string;
  caption?: string;
};

export type VideoEmbed = {
  _key?: string;
  _type: "videoEmbed";
  url: string;
  caption?: string;
};

export type BlogBodyBlock = PortableTextBlock | SanityImage | VideoEmbed;

export type SanityBlogPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  authorName: string;
  mainImage?: SanityImage;
  body?: BlogBodyBlock[];
  seoTitle?: string;
  seoDescription?: string;
};

const POST_PROJECTION = `{
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  authorName,
  mainImage,
  body,
  "seoTitle": seo.title,
  "seoDescription": seo.description
}`;

export const BLOG_INDEX_QUERY = `*[
  _type == "post" &&
  defined(slug.current) &&
  defined(publishedAt) &&
  publishedAt <= now()
] | order(publishedAt desc) ${POST_PROJECTION}`;

export const BLOG_POST_QUERY = `*[
  _type == "post" &&
  slug.current == $slug &&
  defined(publishedAt) &&
  publishedAt <= now()
][0] ${POST_PROJECTION}`;

export function fetchBlogPosts() {
  return sanity.fetch<SanityBlogPost[]>(BLOG_INDEX_QUERY);
}

export function fetchBlogPost(slug: string) {
  return sanity.fetch<SanityBlogPost | null>(BLOG_POST_QUERY, { slug });
}

export function sanityImageUrl(
  source: SanityImage | undefined,
  width: number,
  height?: number,
) {
  if (!source?.asset) return null;

  let builder = imageBuilder.image(source).width(width).auto("format");
  if (height) builder = builder.height(height).fit("crop");
  return builder.url();
}

export function blogPostDescription(post: SanityBlogPost, maxLength = 160) {
  const source =
    post.seoDescription?.trim() ||
    post.excerpt?.trim() ||
    (post.body ? toPlainText(post.body.filter((block) => block._type === "block") as PortableTextBlock[]) : "");

  if (source.length <= maxLength) return source;
  return `${source.slice(0, maxLength - 1).trimEnd()}…`;
}

export function formatBlogDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function videoEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (hostname === "youtube.com") {
      const id = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (hostname === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
}
