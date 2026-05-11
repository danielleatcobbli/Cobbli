import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import logo from "@/assets/logo-cobbli.svg";
import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";

const heroImage = "/assets/hero-cobbler.webp";

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Please enter a valid email address." })
  .max(254, { message: "Please enter a valid email address." })
  .email({ message: "Please enter a valid email address." });

const socials = [
  {
    src: instagram,
    label: "Instagram",
    href: "https://www.instagram.com/cobblidotcom",
  },
  {
    src: tiktok,
    label: "TikTok",
    href: "https://www.tiktok.com/@cobblidotcom",
  },
];

const ComingSoon = () => {
  usePageMeta({
    title: "Cobbli — Coming soon",
    description:
      "Cobbli is coming soon to Manhattan. Expert shoe and leather repair, picked up and delivered to your door. Join the waitlist to be the first to know.",
    canonicalPath: "/",
  });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const trimmed = email.trim();
  const isValid = emailSchema.safeParse(trimmed).success;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(trimmed);
    if (!parsed.success) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase
      .from("waitlist")
      .insert({ email: parsed.data.toLowerCase(), source: "coming_soon_page" });
    setSubmitting(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("You're already on the list!");
        return;
      }
      setError("Something went wrong. Please try again.");
      return;
    }

    setSuccess(true);
    setEmail("");
  };

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Background image */}
      <img
        src={heroImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      {/* Brand overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(61, 23, 0, 0.7)" }}
        aria-hidden="true"
      />

      {/* Content layer */}
      <div className="relative z-10 flex min-h-screen flex-col px-6 py-8 sm:px-10 sm:py-10 md:px-16 md:py-12">
        {/* Logo top-left */}
        <div className="flex justify-center md:justify-start">
          <img src={logo} alt="Cobbli" className="h-28 md:h-32 w-auto" />
        </div>

        {/* Bottom-left content cluster */}
        <div className="mt-auto flex flex-col items-center text-center md:items-start md:text-left">
          <h1
            className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Expert shoe & leather repair, delivered to your door.
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg md:text-xl text-white/90">
            Cobbli is coming soon to Manhattan. Be the first to know when we launch.
          </p>

          {success ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-8 text-base md:text-lg font-medium text-white"
            >
              You're on the list! We'll be in touch soon.
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-8 w-full max-w-xl flex flex-col sm:flex-row gap-3"
              noValidate
            >
              <label htmlFor="waitlist-email" className="sr-only">
                Email address
              </label>
              <input
                id="waitlist-email"
                type="email"
                required
                autoComplete="email"
                placeholder="Enter your email address."
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "waitlist-email-error" : undefined}
                className="flex-1 h-12 rounded-md px-4 text-base text-[#3d1700] bg-white/90 backdrop-blur placeholder:text-[#3d1700]/60 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#fdb600]"
              />
              <button
                type="submit"
                disabled={!isValid || submitting}
                className="h-12 rounded-md px-6 font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
              >
                {submitting ? "Submitting…" : "Notify me"}
              </button>
            </form>
          )}

          {error && (
            <p
              id="waitlist-email-error"
              role="alert"
              className="mt-3 text-sm text-white"
            >
              {error}
            </p>
          )}

          {/* Social links */}
          <div className="mt-10 flex items-center gap-4">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <img
                  src={s.src}
                  alt=""
                  className="h-7 w-7"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default ComingSoon;
