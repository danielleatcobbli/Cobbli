import { useEffect } from "react";

type PageMetaOptions = {
  title: string;
  description: string;
  /** Optional override of the canonical path (defaults to current pathname) */
  canonicalPath?: string;
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

/**
 * Sets per-page SEO tags: <title>, meta description, og:title/description,
 * Twitter title/description, and the canonical URL.
 */
export const usePageMeta = ({ title, description, canonicalPath }: PageMetaOptions) => {
  useEffect(() => {
    document.title = title;
    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    if (typeof window !== "undefined") {
      const path = canonicalPath ?? window.location.pathname;
      setCanonical(`${window.location.origin}${path}`);
    }
  }, [title, description, canonicalPath]);
};
