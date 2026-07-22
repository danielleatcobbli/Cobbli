import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  fetchBlogPosts,
  formatBlogDate,
  sanityImageUrl,
  type SanityBlogPost,
} from "@/lib/sanity";

const BROWN = "#3d1700";
const CREAM_CARD = "#f6ead9";

/** Placeholder shown in place of a cover image. Renders the post title in a
 * decorative cursive treatment so the card still feels designed without
 * repeating the title/date/excerpt that already appear in the card body. */
const NoCoverBand = ({ title }: { title: string }) => (
  <div
    className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden p-6"
    style={{
      backgroundColor: CREAM_CARD,
      backgroundImage:
        "radial-gradient(circle at 20% 20%, rgba(61,23,0,0.07), transparent 45%), radial-gradient(circle at 80% 80%, rgba(61,23,0,0.07), transparent 45%)",
    }}
  >
    <span
      aria-hidden="true"
      className="font-cursive italic line-clamp-3 select-none text-center text-4xl font-semibold leading-snug md:text-5xl"
      style={{ color: BROWN, opacity: 0.85 }}
    >
      {title}
    </span>
  </div>
);

const Blog = () => {
  usePageMeta({
    title: "Behind the Workbench | Cobbli",
    description:
      "Shoe care tips, workshop stories, and updates from the people building Cobbli",
  });

  const [posts, setPosts] = useState<SanityBlogPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBlogPosts();
        if (!cancelled) setPosts(data);
      } catch (error) {
        console.error("Unable to load Sanity blog posts", error);
        if (!cancelled) setPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div
          className="border-b"
          style={{
            background:
              "linear-gradient(180deg, #fff8ec 0%, rgba(255,248,236,0) 100%)",
          }}
        >
          <div className="container max-w-6xl py-14 md:py-20 text-center">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: "rgba(61,23,0,0.55)" }}
            >
              The Cobbli Journal
            </p>
            <h1 className="font-display text-4xl md:text-6xl" style={{ color: BROWN }}>
              Behind the Workbench
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base md:text-lg text-foreground/70">
              Shoe care tips, workshop stories, and updates from the people building Cobbli.
            </p>
          </div>
        </div>

        <div className="container max-w-6xl py-12 md:py-16">
          {posts === null && (
            <div className="py-24"><BrandSpinner label="Loading posts" size="lg" /></div>
          )}

          {posts !== null && posts.length === 0 && (
            <div className="rounded-2xl border border-dashed p-16 text-center">
              <h2 className="font-display text-2xl mb-2" style={{ color: BROWN }}>No posts yet</h2>
              <p className="text-muted-foreground">Check back soon — we're cooking up our first stories.</p>
            </div>
          )}

          {posts && posts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {posts.map((post) => {
                const coverUrl = sanityImageUrl(post.mainImage, 900, 563);
                return (
                  <Link
                    key={post._id}
                    to={`/blog/${post.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    {coverUrl ? (
                      <div className="aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: "#fff5cc" }}>
                        <img
                          src={coverUrl}
                          alt={post.mainImage?.alt || ""}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <NoCoverBand title={post.title} />
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {formatBlogDate(post.publishedAt)}
                      </p>
                      <h2 className="font-display text-xl leading-tight" style={{ color: BROWN }}>
                        {post.title}
                      </h2>
                      <p className="text-sm text-foreground/80 flex-1">{post.excerpt}</p>
                      <span
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 group-hover:underline"
                        style={{ color: BROWN }}
                      >
                        Read more
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
