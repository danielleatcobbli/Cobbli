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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {state.status === "loading" && (
          <div className="container py-24"><BrandSpinner label="Loading post" size="lg" /></div>
        )}

        {state.status === "missing" && (
          <div className="container max-w-2xl py-20 text-center space-y-4">
            <h1 className="font-display text-3xl" style={{ color: "#3d1700" }}>Post not found</h1>
            <p className="text-muted-foreground">This post may have been removed or isn't published yet</p>
            <Link to="/blog" className="inline-block underline" style={{ color: "#3d1700" }}>
              Back to all posts
            </Link>
          </div>
        )}

        {state.status === "ready" && (
          <article>
            <div
              className="border-b"
              style={{
                background: "linear-gradient(180deg, #fff8ec 0%, rgba(255,248,236,0) 100%)",
              }}
            >
              <div className="container max-w-3xl py-10 md:py-16">
                <Link
                  to="/blog"
                  className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                  style={{ color: "#3d1700" }}
                >
                  ← All posts
                </Link>
                <p
                  className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: "rgba(61,23,0,0.55)" }}
                >
                  The Cobbli Journal
                </p>
                <h1
                  className="font-display text-3xl md:text-5xl leading-tight mb-5"
                  style={{ color: "#3d1700" }}
                >
                  {state.post.title}
                </h1>
                <div className="flex items-center gap-3 text-sm text-foreground/70">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full font-display text-sm"
                    style={{ backgroundColor: "rgba(61,23,0,0.1)", color: "#3d1700" }}
                    aria-hidden="true"
                  >
                    {(state.post.authorName || "Cobbli").charAt(0)}
                  </span>
                  <span className="font-medium" style={{ color: "#3d1700" }}>
                    {state.post.authorName || "Cobbli"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={state.post.publishedAt}>
                    {formatBlogDate(state.post.publishedAt)}
                  </time>
                </div>
              </div>
            </div>

            <div className="container max-w-3xl py-10 md:py-14">
              {coverUrl && (
                <div className="mb-10 overflow-hidden rounded-2xl shadow-sm" style={{ backgroundColor: "#fff5cc" }}>
                  <img
                    src={coverUrl}
                    alt={state.post.mainImage?.alt || ""}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
              <div className="prose prose-lg max-w-none [&_h2]:font-display [&_h3]:font-display [&_h2]:text-[#3d1700] [&_h3]:text-[#3d1700] [&_a]:text-[#3d1700] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-foreground/70" style={{ borderColor: "rgba(61,23,0,0.2)" }}>
                <SanityPortableText value={state.post.body || []} />
              </div>

              <div className="mt-14 border-t pt-8 text-center">
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                  style={{ color: "#3d1700" }}
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
