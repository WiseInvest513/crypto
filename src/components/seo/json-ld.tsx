type JsonLdValue = Readonly<Record<string, unknown>>;
type BreadcrumbItem = Readonly<{ name: string; path: `/${string}` | "/" }>;

export function JsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  origin,
  items,
}: {
  origin: string;
  items: readonly BreadcrumbItem[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: new URL(item.path, origin).toString(),
        })),
      }}
    />
  );
}
