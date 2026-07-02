import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { type BlogPost, buildExcerpt, formatPublishedDate, resolveCoverUrl } from "@/lib/blog";

type CardPost = BlogPost & { coverUrl: string | null };

const Blog = () => {
  usePageMeta({
    title: "Behind the Workbench | Cobbli",
    description:
      "Shoe care tips, workshop stories, and updates from the people building Cobbli",
  });

  const [posts, setPosts] = useState<CardPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (cancelled) return;
      if (error || !data) {
        setPosts([]);
        return;
      }
      const withCovers = await Promise.all(
        (data as BlogPost[]).map(async (p) => ({ ...p, coverUrl: await resolveCoverUrl(p.cover_image_url) })),
      );
      if (!cancelled) setPosts(withCovers);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-6xl py-12 md:py-16">
          <header className="mb-10 md:mb-12">
            <h1 className="font-display text-4xl md:text-5xl" style={{ color: "#3d1700" }}>
              Behind the Workbench
            </h1>
            <p className="mt-3 text-foreground/80 max-w-2xl">
              Shoe care tips, workshop stories, and updates from the people building Cobbli
            </p>
          </header>

          {posts === null && (
            <div className="py-24"><BrandSpinner label="Loading posts" size="lg" /></div>
          )}

          {posts !== null && posts.length === 0 && (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <h2 className="font-display text-2xl mb-2" style={{ color: "#3d1700" }}>No posts yet</h2>
              <p className="text-muted-foreground">Check back soon — we're cooking up our first stories.</p>
            </div>
          )}

          {posts && posts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group flex flex-col rounded-lg overflow-hidden border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: "#fff5cc" }}>
                    {post.coverUrl ? (
                      <img
                        src={post.coverUrl}
                        alt=""
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-display text-3xl" style={{ color: "#3d1700" }}>
                        Cobbli
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {formatPublishedDate(post.published_at)}
                    </p>
                    <h2 className="font-display text-xl leading-tight" style={{ color: "#3d1700" }}>
                      {post.title}
                    </h2>
                    <p className="text-sm text-foreground/80">{buildExcerpt(post)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
