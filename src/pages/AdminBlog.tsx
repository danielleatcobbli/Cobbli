import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Plus, ArrowLeft, Upload } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import RichTextEditor from "@/components/cobbli/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch, apiFetchJson } from "@/integrations/api/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  type BlogPost,
  type BlogStatus,
  formatPublishedDate,
  resolveCoverUrl,
  slugify,
} from "@/lib/blog";

type Mode = { kind: "list" } | { kind: "edit"; post: BlogPost | null };

const blank = (): Omit<BlogPost, "id" | "created_at" | "updated_at" | "author_id"> => ({
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  cover_image_url: null,
  seo_title: "",
  seo_description: "",
  status: "draft",
  published_at: new Date().toISOString(),
});

const isoToDateInput = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const AdminBlog = () => {
  usePageMeta({ title: "Blog admin — Cobbli", description: "Create and manage Cobbli blog posts." });
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load posts", description: error.message, variant: "destructive" });
      setPosts([]);
      return;
    }
    setPosts((data ?? []) as BlogPost[]);
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  const handleDelete = async (post: BlogPost) => {
    if (!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return;
    try {
      await apiFetch(`/ops/blog/posts/${post.id}`, { method: "DELETE" });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Delete failed",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Post deleted" });
    void loadPosts();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-5xl py-10">
          {mode.kind === "list" && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <button
                    type="button"
                    onClick={() => navigate("/admin")}
                    className="text-sm underline mb-2 inline-flex items-center gap-1"
                    style={{ color: "#3d1700" }}
                  >
                    <ArrowLeft size={14} /> Back to admin
                  </button>
                  <h1 className="font-display text-3xl" style={{ color: "#3d1700" }}>Blog posts</h1>
                </div>
                <Button onClick={() => setMode({ kind: "edit", post: null })} variant="hero">
                  <Plus size={16} className="mr-1" /> New post
                </Button>
              </div>

              {posts === null && <div className="py-16"><BrandSpinner label="Loading posts" /></div>}

              {posts && posts.length === 0 && (
                <div className="rounded-lg border border-dashed p-10 text-center">
                  <p className="text-muted-foreground mb-4">No posts yet.</p>
                  <Button onClick={() => setMode({ kind: "edit", post: null })} variant="hero">
                    <Plus size={16} className="mr-1" /> Create your first post
                  </Button>
                </div>
              )}

              {posts && posts.length > 0 && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-4 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-4 py-3">
                            <div className="font-medium" style={{ color: "#3d1700" }}>{p.title}</div>
                            <div className="text-xs text-muted-foreground">/{p.slug}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                p.status === "published"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-900"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatPublishedDate(p.published_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => setMode({ kind: "edit", post: p })}
                                className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted"
                                aria-label="Edit"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(p)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted text-destructive"
                                aria-label="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {mode.kind === "edit" && (
            <Editor
              initial={mode.post}
              authorId={user?.id ?? null}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={async () => {
                await loadPosts();
                setMode({ kind: "list" });
              }}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

type EditorProps = {
  initial: BlogPost | null;
  authorId: string | null;
  onCancel: () => void;
  onSaved: () => void;
};

const Editor = ({ initial, authorId, onCancel, onSaved }: EditorProps) => {
  const { toast } = useToast();
  const isEditing = !!initial;
  const [form, setForm] = useState(() => ({ ...blank(), ...(initial ?? {}) }));
  const [slugDirty, setSlugDirty] = useState(isEditing);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await resolveCoverUrl(form.cover_image_url);
      if (!cancelled) setCoverPreview(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [form.cover_image_url]);

  const onTitleChange = (v: string) => {
    setForm((f) => ({ ...f, title: v, slug: slugDirty ? f.slug : slugify(v) }));
  };

  const uploadCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 8MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "cover");
      const { url } = await apiFetchJson<{ url: string }>("/ops/blog/upload", {
        method: "POST",
        body,
      });
      setForm((f) => ({ ...f, cover_image_url: url }));
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadInlineImage = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          const body = new FormData();
          body.append("file", file);
          body.append("kind", "inline");
          const { url } = await apiFetchJson<{ url: string }>("/ops/blog/upload", {
            method: "POST",
            body,
          });
          resolve(url);
        } catch (error) {
          toast({
            title: "Image upload failed",
            description: error instanceof Error ? error.message : "Image upload failed",
            variant: "destructive",
          });
          resolve(null);
        }
      };
      input.click();
    });
  };

  const canSave = useMemo(() => {
    return form.title.trim().length > 0 && /^[a-z0-9-]+$/.test(form.slug) && !saving;
  }, [form.title, form.slug, saving]);

  const save = async (nextStatus: BlogStatus) => {
    if (!canSave) return;
    if (nextStatus === "published" && form.body.replace(/<[^>]+>/g, "").trim().length === 0) {
      toast({ title: "Body required", description: "Add some content before publishing.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        excerpt: form.excerpt?.trim() || null,
        body: form.body,
        cover_image_url: form.cover_image_url,
        seo_title: form.seo_title?.trim() || null,
        seo_description: form.seo_description?.trim() || null,
        status: nextStatus,
        published_at: form.published_at,
      };

      try {
        if (isEditing && initial) {
          await apiFetch(`/ops/blog/posts/${initial.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        } else {
          await apiFetch("/ops/blog/posts", {
            method: "POST",
            body: JSON.stringify({ ...payload, author_id: authorId }),
          });
        }
      } catch (error) {
        toast({
          title: "Save failed",
          description: error instanceof Error ? error.message : "Save failed",
          variant: "destructive",
        });
        return;
      }
      toast({ title: nextStatus === "published" ? "Post published" : "Draft saved" });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={onCancel} className="text-sm underline inline-flex items-center gap-1" style={{ color: "#3d1700" }}>
          <ArrowLeft size={14} /> Back to posts
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => save("draft")} disabled={!canSave}>
            Save draft
          </Button>
          <Button variant="hero" onClick={() => save("published")} disabled={!canSave}>
            {form.status === "published" ? "Update post" : "Publish"}
          </Button>
        </div>
      </div>

      <h1 className="font-display text-3xl" style={{ color: "#3d1700" }}>
        {isEditing ? "Edit post" : "New post"}
      </h1>

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={form.title} onChange={(e) => onTitleChange(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={form.slug}
            onChange={(e) => {
              setSlugDirty(true);
              setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
            }}
          />
          <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
        </div>

        <div className="space-y-2">
          <Label>Cover image</Label>
          <div className="flex items-start gap-4">
            <div className="h-32 w-48 rounded border overflow-hidden flex items-center justify-center" style={{ backgroundColor: "#fff5cc" }}>
              {coverPreview ? (
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">No cover</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={uploadCover} />
                <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <Upload size={14} /> {uploading ? "Uploading…" : coverPreview ? "Replace" : "Upload"}
                </span>
              </label>
              {form.cover_image_url && (
                <button
                  type="button"
                  className="text-xs text-destructive underline self-start"
                  onClick={() => setForm((f) => ({ ...f, cover_image_url: null }))}
                >
                  Remove cover
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt (optional)</Label>
          <Textarea
            id="excerpt"
            rows={3}
            value={form.excerpt ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            placeholder="Leave blank to auto-generate from the body."
          />
        </div>

        <div className="space-y-2">
          <Label>Body</Label>
          <RichTextEditor
            value={form.body}
            onChange={(html) => setForm((f) => ({ ...f, body: html }))}
            onRequestImageUpload={uploadInlineImage}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="published-at">Published date</Label>
          <Input
            id="published-at"
            type="date"
            value={isoToDateInput(form.published_at)}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const d = new Date(v + "T12:00:00");
              setForm((f) => ({ ...f, published_at: d.toISOString() }));
            }}
          />
        </div>

        <div className="rounded-md border p-4 space-y-4">
          <h2 className="font-display text-lg" style={{ color: "#3d1700" }}>SEO</h2>
          <div className="space-y-2">
            <Label htmlFor="seo-title">SEO title</Label>
            <Input
              id="seo-title"
              value={form.seo_title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
              placeholder="Defaults to the post title."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seo-description">Meta description</Label>
            <Textarea
              id="seo-description"
              rows={3}
              value={form.seo_description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
              placeholder="Defaults to the excerpt. Recommended under 160 characters."
              maxLength={300}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <p className="font-medium" style={{ color: "#3d1700" }}>Published</p>
            <p className="text-xs text-muted-foreground">
              Toggle off to revert to a draft. Use the buttons above to save changes.
            </p>
          </div>
          <Switch
            checked={form.status === "published"}
            onCheckedChange={(c) => setForm((f) => ({ ...f, status: c ? "published" : "draft" }))}
          />
        </div>
      </div>
    </section>
  );
};

export default AdminBlog;
