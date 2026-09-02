import {
  createElement,
  isValidElement,
  type AnchorHTMLAttributes,
  type ReactElement,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProductViewTracker,
  trackProductPageViewOnce,
  trackProductViewOnce,
} from "../../src/components/products/product-view-tracker";
import { ReferralLink } from "../../src/components/products/referral-link";
import { TutorialLink } from "../../src/components/products/tutorial-link";
import { productAnalytics } from "../../src/lib/analytics/product-analytics";

const detailProps = {
  slug: "example-product",
  sourcePage: "/products/example-product",
  contentVersion: "phase6.1",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("product analytics client components", () => {
  it("renders a direct referral anchor with the exact required relationship", () => {
    const href = "https://partner.example/join?ref=CONFIGURED";
    const html = renderToStaticMarkup(
      ReferralLink({
        ...detailProps,
        href,
        placement: "product_detail",
        className: "primary-action",
        children: "访问合作方",
      }) as ReactElement,
    );

    expect(html).toContain(`href="${href.replace("&", "&amp;")}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="sponsored nofollow noopener noreferrer"');
    expect(html).toContain("在新标签页打开");
    expect(html).not.toContain("/redirect");
    expect(html).not.toContain("/go?");
  });

  it("tracks a referral click without preventing direct navigation", () => {
    const track = vi
      .spyOn(productAnalytics, "trackReferralClick")
      .mockImplementation(() => undefined);
    const element = ReferralLink({
      ...detailProps,
      href: "https://partner.example/join",
      placement: "product_detail",
      children: "访问合作方",
    });
    const preventDefault = vi.fn();

    expect(isValidElement(element)).toBe(true);
    const anchor = element as ReactElement<
      AnchorHTMLAttributes<HTMLAnchorElement>
    >;
    anchor.props.onClick?.({ preventDefault } as never);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith({
      ...detailProps,
      placement: "product_detail",
    });
  });

  it("renders and tracks a safe external tutorial link", () => {
    const track = vi
      .spyOn(productAnalytics, "trackTutorialClick")
      .mockImplementation(() => undefined);
    const element = TutorialLink({
      ...detailProps,
      href: "https://learn.example/tutorial",
      children: "阅读教程",
    });

    expect(isValidElement(element)).toBe(true);
    const anchor = element as ReactElement<
      AnchorHTMLAttributes<HTMLAnchorElement>
    >;
    expect(anchor.props.href).toBe("https://learn.example/tutorial");
    expect(anchor.props.target).toBe("_blank");
    expect(anchor.props.rel).toBe("noopener noreferrer");

    const preventDefault = vi.fn();
    anchor.props.onClick?.({ preventDefault } as never);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith({
      ...detailProps,
      placement: "product_detail",
    });
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "http://partner.example/join",
    "/products/example-product",
    "https://user:password@partner.example/join",
    "not a URL",
  ])("does not render the unsafe external URL %s", (href) => {
    expect(
      ReferralLink({
        ...detailProps,
        href,
        placement: "product_detail",
        children: "访问合作方",
      }),
    ).toBeNull();
    expect(
      TutorialLink({
        ...detailProps,
        href,
        children: "阅读教程",
      }),
    ).toBeNull();
  });

  it("guards product_view so rerunning the effect cannot duplicate it", () => {
    const tracked = { current: null as string | null };
    const trackProductView = vi.fn();

    trackProductViewOnce(tracked, {
      ...detailProps,
      placement: "product_detail",
    }, { trackProductView });
    trackProductViewOnce(tracked, {
      ...detailProps,
      placement: "product_detail",
    }, { trackProductView });

    expect(trackProductView).toHaveBeenCalledOnce();
  });

  it("tracks a new product when a reused client component receives a new slug", () => {
    const tracked = { current: null as string | null };
    const trackProductView = vi.fn();

    trackProductViewOnce(
      tracked,
      { ...detailProps, placement: "product_detail" },
      { trackProductView },
    );
    trackProductViewOnce(
      tracked,
      {
        ...detailProps,
        slug: "coinbase",
        contentVersion: "2026-08-31-coinbase-v1",
        placement: "product_detail",
      },
      { trackProductView },
    );

    expect(trackProductView).toHaveBeenCalledTimes(2);
  });

  it("emits product-detail page_view only from a resolved product component", () => {
    const tracked = { current: null as string | null };
    const trackPageView = vi.fn();

    trackProductPageViewOnce(tracked, detailProps, { trackPageView });
    trackProductPageViewOnce(tracked, detailProps, { trackPageView });
    trackProductPageViewOnce(
      tracked,
      {
        slug: "coinbase",
        contentVersion: "2026-08-31-coinbase-v1",
      },
      { trackPageView },
    );

    expect(trackPageView).toHaveBeenCalledTimes(2);
    expect(trackPageView).toHaveBeenNthCalledWith(
      1,
      "/products/example-product",
    );
    expect(trackPageView).toHaveBeenNthCalledWith(2, "/products/coinbase");
  });

  it("renders no visible product-view tracking markup", () => {
    const html = renderToStaticMarkup(
      createElement(ProductViewTracker, detailProps),
    );

    expect(html).toBe("");
  });
});
