import { useEffect } from "react";

type PageMetaOptions = {
  title: string;
  description: string;
  /** Optional override of the canonical path (defaults to current pathname) */
  canonicalPath?: string;
  image?: string | null;
  type?: "website" | "article";
  publishedTime?: string;
  jsonLd?: Record<string, unknown> | null;
};

const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const setCanonical = (href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

const removeMeta = (name: string, attr: "name" | "property" = "name") => {
  document.head.querySelector(`meta[${attr}="${name}"]`)?.remove();
};

const setJsonLd = (value: string | null) => {
  const id = "page-json-ld";
  let el = document.head.querySelector<HTMLScriptElement>(`script#${id}`);

  if (!value) {
    el?.remove();
    return;
  }

  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = value;
};

/**
 * Sets per-page SEO tags: <title>, meta description, og:title/description,
 * Twitter title/description, and the canonical URL.
 */
export const usePageMeta = ({
  title,
  description,
  canonicalPath,
  image,
  type = "website",
  publishedTime,
  jsonLd,
}: PageMetaOptions) => {
  const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    document.title = title;
    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", type, "property");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:card", "summary_large_image");

    // `image` undefined (not passed at all — every page except BlogPost.tsx
    // today) means "no per-page override, leave whatever's already set"
    // (the site-wide default in index.html's og:image/twitter:image tags).
    // Only an explicit `image: null` clears it. Fixed 2026-08-13 (Danielle's
    // call, found while fixing the Lovable-branded link preview) — this used
    // to treat "not passed" the same as "clear it," so every page without
    // its own image was silently stripping the default og:image/
    // twitter:image tags on load.
    if (image) {
      setMeta("og:image", image, "property");
      setMeta("twitter:image", image);
    } else if (image === null) {
      removeMeta("og:image", "property");
      removeMeta("twitter:image");
    }

    if (publishedTime && type === "article") {
      setMeta("article:published_time", publishedTime, "property");
    } else {
      removeMeta("article:published_time", "property");
    }

    if (typeof window !== "undefined") {
      const path = canonicalPath ?? window.location.pathname;
      const canonical = `${window.location.origin}${path}`;
      setCanonical(canonical);
      setMeta("og:url", canonical, "property");
    }

    setJsonLd(jsonLdString);
  }, [
    title,
    description,
    canonicalPath,
    image,
    type,
    publishedTime,
    jsonLdString,
  ]);
};
