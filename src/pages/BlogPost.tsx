import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import SanityPortableText from "@/components/cobbli/SanityPortableText";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  blogPostDescription,
  fetchBlogPost,
  formatBlogDate,
  sanityImageUrl,
  type SanityBlogPost,
} from "@/lib/sanity";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; post: SanityBlogPost };

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setState({ status: "missing" });
      return;
    }
    (async () => {
      try {
        const post = await fetchBlogPost(slug);
        if (cancelled) return;
        setState(post ? { status: "ready", post } : { status: "missing" });
      } catch (error) {
        console.error("Unable to load Sanity blog post", error);
        if (!cancelled) setState({ status: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const post = state.status === "ready" ? state.post : null;
  const coverUrl = post ? sanityImageUrl(post.mainImage, 1400) : null;
  const pageTitle = post
    ? post.seoTitle?.trim() || `${post.title} | Cobbli`
    : "Behind the Workbench | Cobbli";
  const pageDescription = post
    ? blogPostDescription(post)
    : "Stories, repair tips, and updates from the Cobbli team.";
  const canonicalPath = post ? `/blog/${post.slug}` : "/blog";
  const canonicalUrl = `https://cobbli.com${canonicalPath}`;

  usePageMeta({
    title: pageTitle,
    description: pageDescription,
    canonicalPath,
    image: coverUrl,
    type: post ? "article" : "website",
    publishedTime: post?.publishedAt,
    jsonLd: post
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: pageDescription,
          image: coverUrl ? [coverUrl] : undefined,
          datePublished: post.publishedAt,
          dateModified: post.publishedAt,
          author: {
            "@type": "Organization",
            name: post.authorName || "Cobbli",
          },
          publisher: {
            "@type": "Organization",
            name: "Cobbli",
            url: "https://cobbli.com",
          },
          mainEntityOfPage: canonicalUrl,
        }
      : null,
  });

  // Restyled 2026-08-26 (Danielle's call) — cream page bg, amber Fraunces/
  // Instrument Sans text, matching Blog.tsx and the rest of the cream pages.
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        {state.status === "loading" && (
          <div className="container py-24"><BrandSpinner label="Loading post" size="lg" /></div>
        )}

        {state.status === "missing" && (
          <div className="container max-w-2xl py-20 text-center space-y-4">
            <h1 className="text-3xl uppercase" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}>Post not found</h1>
            <p style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif", opacity: 0.9 }}>This post may have been removed or isn't published yet</p>
            <Link to="/blog" className="inline-block underline" style={{ color: "#fdb600" }}>
              Back to all posts
            </Link>
          </div>
        )}

        {state.status === "ready" && (
          <article>
            <div className="container max-w-3xl py-10 md:py-16">
              <Link
                to="/blog"
                className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }}
              >
                ← All posts
              </Link>
              <p
                className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: "#fdb600", opacity: 0.8, fontFamily: "'Instrument Sans', sans-serif" }}
              >
                The Cobbli Journal
              </p>
              <h1
                className="text-3xl md:text-5xl leading-tight mb-5 uppercase"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
              >
                {state.post.title}
              </h1>
              <div className="flex items-center gap-3 text-sm" style={{ color: "#fdb600", opacity: 0.85, fontFamily: "'Instrument Sans', sans-serif" }}>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                  style={{ backgroundColor: "#fdb600", color: "#fff5cc", fontFamily: "'Fraunces', serif", fontWeight: 700 }}
                  aria-hidden="true"
                >
                  {(state.post.authorName || "Cobbli").charAt(0)}
                </span>
                <span className="font-medium" style={{ opacity: 1 }}>
                  {state.post.authorName || "Cobbli"}
                </span>
                <span aria-hidden="true">·</span>
                <time dateTime={state.post.publishedAt}>
                  {formatBlogDate(state.post.publishedAt)}
                </time>
              </div>
            </div>

            <div className="container max-w-3xl py-10 md:py-14">
              {coverUrl && (
                <div className="mb-10 overflow-hidden rounded-2xl shadow-sm" style={{ backgroundColor: "#3d1700" }}>
                  <img
                    src={coverUrl}
                    alt={state.post.mainImage?.alt || ""}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
              <div
                className="prose prose-lg max-w-none [&_h2]:text-[#fdb600] [&_h3]:text-[#fdb600] [&_a]:text-[#fdb600] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic"
                style={{ borderColor: "#fdb600", color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }}
              >
                <SanityPortableText value={state.post.body || []} />
              </div>

              <div className="mt-14 pt-8 text-center" style={{ borderTop: "1px solid #fdb600" }}>
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                  style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  ← Back to all stories
                </Link>
              </div>
            </div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
