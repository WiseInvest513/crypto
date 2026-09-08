import type { Metadata } from "next";
import { FuturesIntroExperience } from "@/components/tools/futures-intro/futures-intro-experience";
import { createPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "合约入门",
  description:
    "通过五章二十六关理解合约基础、杠杆风险、K 线、技术指标与交易计划，支持快速路径和完整路径。",
  path: "/tools/futures-intro",
  socialTitle: "合约入门 — Wise Crypto 学习工具",
  useSiteImage: true,
});

export default function FuturesIntroPage() {
  return <FuturesIntroExperience />;
}
