import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FuturesIntroExperience } from "../../src/components/tools/futures-intro/futures-intro-experience";

const experienceSource = readFileSync(
  join(
    process.cwd(),
    "src/components/tools/futures-intro/futures-intro-experience.tsx",
  ),
  "utf8",
);

describe("futures intro navigation", () => {
  it("renders a visible 44px tools return target and current course context", () => {
    const markup = renderToStaticMarkup(createElement(FuturesIntroExperience));

    expect(markup).toContain('class="tool-return-link"');
    expect(markup).toContain('href="/tools"');
    expect(markup).toContain("返回工具");
    expect(markup).toContain('aria-label="当前位置"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("合约入门");
  });

  it("provides a clear tools exit on both the course overview and lesson view", () => {
    expect(
      experienceSource.match(
        /<BackToToolsLink currentLabel="合约入门" \/>/g,
      ),
    ).toHaveLength(2);
    expect(experienceSource).toContain('from "../back-to-tools-link"');
    expect(experienceSource).not.toContain("返回全部工具");
    expect(experienceSource).not.toContain("styles.breadcrumb");
  });

  it("keeps returning to the course directory distinct from leaving for tools", () => {
    expect(experienceSource).toContain('aria-label="返回课程目录"');
    expect(experienceSource).toContain("<span>返回目录</span>");
    expect(experienceSource).toContain("className={styles.lessonNavigation}");
  });
});
