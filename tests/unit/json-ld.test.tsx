import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BreadcrumbJsonLd,
  JsonLd,
} from "../../src/components/seo/json-ld";

describe("JSON-LD", () => {
  it("escapes markup-breaking characters before embedding structured data", () => {
    const html = renderToStaticMarkup(
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "</script><script>alert(1)</script>",
        }}
      />,
    );

    expect(html).not.toContain("</script><script>");
    expect(html).toContain("\\u003c/script>");
  });

  it("emits absolute breadcrumb items in the same visible order", () => {
    const html = renderToStaticMarkup(
      <BreadcrumbJsonLd
        origin="https://crypto.wise-invest.org"
        items={[
          { name: "加密工具", path: "/tools" },
          { name: "仓位计算", path: "/tools/position-size" },
        ]}
      />,
    );
    const json = html.match(/<script[^>]*>(.*)<\/script>/)?.[1];

    expect(json).toBeDefined();
    expect(JSON.parse(json ?? "{}")).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          position: 1,
          name: "加密工具",
          item: "https://crypto.wise-invest.org/tools",
        },
        {
          position: 2,
          name: "仓位计算",
          item: "https://crypto.wise-invest.org/tools/position-size",
        },
      ],
    });
  });
});
