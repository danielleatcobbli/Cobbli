# Cobbli Blog

A public blog with an admin authoring tool, reusing the existing admin role system.

## 1. Database

New table `public.blog_posts` with:
- `title`, `slug` (unique), `excerpt`, `body` (HTML from rich text editor)
- `cover_image_url`
- `seo_title`, `seo_description` (per-post SEO overrides)
- `status` (`draft` | `published`)
- `published_at` (editable date), `author_id`
- Standard `id` / `created_at` / `updated_at`

RLS:
- Anyone (anon + authenticated) can read posts where `status = 'published'`.
- Admins (via existing `has_role(auth.uid(), 'admin')`) can read all and insert/update/delete.

Storage:
- New public bucket `blog-images` for cover image uploads. Admin-only write, public read.

## 2. Public pages

**`/blog`** — index
- Fetches published posts ordered by `published_at desc`.
- Card grid (1 / 2 / 3 cols responsive) with cover image, title (Frank Ruhl Libre), formatted date ("Monday, April 6"), and 150-char excerpt (falls back to stripped body if `excerpt` blank).
- Empty state if no posts.
- Branded skeleton while loading.

**`/blog/:slug`** — post detail
- Fetches by slug; 404 view if not found or unpublished.
- Cover image, title, date, then rendered HTML body inside a `prose`-style container using Cobbli typography tokens.
- Per-post `<title>` and `<meta name="description">` via the existing `usePageMeta` hook, using `seo_title` / `seo_description` with sensible fallbacks (title, excerpt).

## 3. Admin

**`/admin/blog`** — list + editor, gated by `ProtectedRoute` + admin role check (same pattern as existing `/admin`).
- Table of all posts with status pill, title, date, and Edit / Delete actions.
- "New post" button opens the editor.

**Editor** (inline or `/admin/blog/:id`):
- Title (auto-fills slug; slug remains editable, validated to `[a-z0-9-]+`, uniqueness checked on save)
- Cover image upload to `blog-images` bucket (preview after upload)
- Excerpt (textarea, optional — auto-derived if empty)
- Body — rich text editor (TipTap with StarterKit + Link + Image)
- Published date (date picker, defaults to today)
- SEO title + SEO description fields
- Status toggle: Save as draft / Publish
- Validation: title, slug, body required before publish.

## 4. Footer + routing

- Add "Blog" link to the existing footer component (text link, no header nav change).
- Register `/blog`, `/blog/:slug`, `/admin/blog` in `App.tsx`. Admin route wrapped in `ProtectedRoute` and the page itself checks the `admin` role; non-admins see an access-denied message.

## Technical notes

- Dependencies to add: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`.
- Slug generator: lowercase, strip diacritics, replace non-alphanum with `-`, collapse repeats, trim.
- Excerpt helper: strip HTML tags from body, take first 150 chars, append `…`.
- All headings use Frank Ruhl Libre per existing typography rules; body uses Albert Sans (project default).
- Branded skeleton on `/blog` and `/blog/:slug` per project loading-state rule.

After you approve, I'll run the migration first, then build the pages, editor, and footer link.