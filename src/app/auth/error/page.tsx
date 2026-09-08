import type { Metadata, Route } from "next";
import Link from "next/link";
import { normalizeAuthReturnTo } from "@/lib/auth/auth-return-to";

export const metadata: Metadata = {
  title: "登录没有完成",
  robots: { index: false, follow: false },
};

export default async function WiseAuthErrorPage({
  searchParams,
}: PageProps<"/auth/error">) {
  const parameters = await searchParams;
  const returnTo = normalizeAuthReturnTo(parameters.returnTo);
  const cancelled = parameters.error === "AccessDenied";

  return (
    <div className="auth-result page-container">
      <section className="auth-result__card" aria-labelledby="auth-result-title">
        <span className="auth-result__mark" aria-hidden="true">
          {cancelled ? "↩" : "!"}
        </span>
        <p className="auth-result__eyebrow">Wise ID</p>
        <h1 id="auth-result-title">
          {cancelled ? "本次登录已取消" : "登录暂时没有完成"}
        </h1>
        <p>
          {cancelled
            ? "你没有授权 Wise Crypto 读取基础身份与会员等级，因此暂时不能进入行情和工具。"
            : "请稍后重试。身份确认恢复后，登录即可进入行情、工具和合约课程。"}
        </p>
        <div className="auth-result__actions">
          <Link href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}` as Route}>
            重新登录
          </Link>
          <Link href="/">返回市场总览</Link>
        </div>
      </section>
    </div>
  );
}
