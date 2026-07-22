import {
  PortableText,
  type PortableTextComponents,
  type PortableTextMarkComponentProps,
  type PortableTextTypeComponentProps,
} from "@portabletext/react";
import {
  sanityImageUrl,
  videoEmbedUrl,
  type BlogBodyBlock,
  type SanityImage,
  type VideoEmbed,
} from "@/lib/sanity";

type LinkMark = {
  _type: "link";
  href?: string;
};

const PortableImage = ({
  value,
}: PortableTextTypeComponentProps<SanityImage>) => {
  const src = sanityImageUrl(value, 1200);
  if (!src) return null;

  return (
    <figure>
      <img
        src={src}
        alt={value.alt || ""}
        loading="lazy"
        className="w-full rounded-lg"
      />
      {value.caption && <figcaption>{value.caption}</figcaption>}
    </figure>
  );
};

const PortableVideo = ({
  value,
}: PortableTextTypeComponentProps<VideoEmbed>) => {
  const src = videoEmbedUrl(value.url);
  if (!src) return null;

  return (
    <figure>
      <iframe
        src={src}
        title={value.caption || "Embedded video"}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-lg"
      />
      {value.caption && <figcaption>{value.caption}</figcaption>}
    </figure>
  );
};

const PortableLink = ({
  value,
  children,
}: PortableTextMarkComponentProps<LinkMark>) => {
  const href = value?.href || "#";
  const external = /^https?:\/\//.test(href);

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
};

const components: PortableTextComponents = {
  types: {
    image: PortableImage,
    videoEmbed: PortableVideo,
  },
  marks: {
    link: PortableLink,
  },
};

type SanityPortableTextProps = {
  value: BlogBodyBlock[];
};

const SanityPortableText = ({ value }: SanityPortableTextProps) => (
  <PortableText value={value} components={components} />
);

export default SanityPortableText;
