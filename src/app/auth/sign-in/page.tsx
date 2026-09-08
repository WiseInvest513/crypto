import type { Metadata } from "next";
import Link from "next/link";
import { startWiseSignIn } from "@/app/auth/actions";
import { normalizeAuthReturnTo } from "@/lib/auth/auth-return-to";
import { getWiseAuthConfigurationStatus } from "@/server/auth/wise-auth-config";

export const metadata: Metadata = {
  title: "使用 Wise ID 登录",
  robots: { index: false, follow: false },
};

export default async function WiseSignInPage({
  searchParams,
}: PageProps<"/auth/sign-in">) {
  const parameters = await searchParams;
  const returnTo = normalizeAuthReturnTo(parameters.returnTo);
  const configurationStatus = getWiseAuthConfigurationStatus();
  const enabled = configurationStatus === "ready";
  const misconfigured = configurationStatus === "misconfigured";

  return (
    <div className="auth-result page-container">
      <section className="auth-result__card" aria-labelledby="wise-sign-in-title">
        <span className="auth-result__mark" aria-hidden="true">
          W
        </span>
        <p className="auth-result__eyebrow">Wise ID</p>
        <h1 id="wise-sign-in-title">
          {enabled
            ? "登录 Wise Crypto"
            : misconfigured
              ? "登录配置暂不可用"
              : "登录功能尚未开放"}
        </h1>
        <p>
          {enabled
            ? "你将前往 Wise Invest 主站确认身份。授权完成后会自动返回，并识别普通用户或 VIP 用户。"
            : misconfigured
              ? "登录服务的环境配置不完整，行情与工具暂时无法进入。请稍后再试。"
              : "登录功能尚未配置，因此行情、计算工具和合约课程暂时无法进入。"}
        </p>
        <div className="auth-result__actions">
          {enabled ? (
            <form action={startWiseSignIn}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit">前往主站登录</button>
            </form>
          ) : null}
          <Link href="/">暂不登录，返回市场总览</Link>
        </div>
        <p className="auth-result__privacy">
          Wise Crypto 不读取主站密码，也不使用跨子域共享 Cookie。
        </p>
      </section>
    </div>
  );
}
