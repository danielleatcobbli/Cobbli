import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { type BlogPost as BlogPostType, buildExcerpt, formatPublishedDate, resolveCoverUrl } from "@/lib/blog";

type State = { status: "loading" } | { status: "missing" } | { status: "ready"; post: BlogPostType; coverUrl: string | null };

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
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setState({ status: "missing" });
        return;
      }
      const post = data as BlogPostType;
      const coverUrl = await resolveCoverUrl(post.cover_image_url);
      if (!cancelled) setState({ status: "ready", post, coverUrl });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const post = state.status === "ready" ? state.post : null;
  usePageMeta({
    title: post ? `${post.seo_title?.trim() || post.title} | Behind the Workbench` : "Behind the Workbench | Cobbli",
    description: post
      ? post.seo_description?.trim() || buildExcerpt(post, 160)
      : "Stories, repair tips, and updates from the Cobbli team.",
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
          <article className="container max-w-3xl py-12 md:py-16">
            <Link to="/blog" className="text-sm underline mb-6 inline-block" style={{ color: "#3d1700" }}>
              ← All posts
            </Link>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
              {formatPublishedDate(state.post.published_at)}
            </p>
            <h1 className="font-display text-3xl md:text-5xl leading-tight mb-6" style={{ color: "#3d1700" }}>
              {state.post.title}
            </h1>
            {state.coverUrl && (
              <div className="mb-8 overflow-hidden rounded-lg" style={{ backgroundColor: "#fff5cc" }}>
                <img src={state.coverUrl} alt="" className="w-full h-auto object-cover" />
              </div>
            )}
            <div
              className="prose prose-lg max-w-none [&_h2]:font-display [&_h3]:font-display [&_h2]:text-[#3d1700] [&_h3]:text-[#3d1700] [&_a]:text-[#3d1700] [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: state.post.body }}
            />
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
