import { supabase } from "@/integrations/supabase/client";

export type BlogStatus = "draft" | "published";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: BlogStatus;
  published_at: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export const slugify = (input: string): string =>
  input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const stripHtml = (html: string): string =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

export const buildExcerpt = (post: Pick<BlogPost, "excerpt" | "body">, max = 150): string => {
  const source = (post.excerpt && post.excerpt.trim()) || stripHtml(post.body || "");
  if (source.length <= max) return source;
  return source.slice(0, max).replace(/\s+\S*$/, "") + "…";
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const formatPublishedDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

export const BLOG_BUCKET = "blog-images";

/**
 * cover_image_url stores the storage path within the blog-images bucket.
 * Resolve to a signed URL (1 week) for display. If the value already looks like
 * a full URL (legacy), return it as-is.
 */
export const resolveCoverUrl = async (path: string | null | undefined): Promise<string | null> => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from(BLOG_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data?.signedUrl ?? null;
};
