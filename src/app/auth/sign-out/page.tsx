import type { Metadata } from "next";
import Link from "next/link";
import { endWiseSession } from "@/app/auth/actions";
import { normalizeAuthReturnTo } from "@/lib/auth/auth-return-to";
import { isWiseAuthConfigured } from "@/server/auth/wise-auth-config";

export const metadata: Metadata = {
  title: "退出 Wise Crypto",
  robots: { index: false, follow: false },
};

export default async function WiseSignOutPage({
  searchParams,
}: PageProps<"/auth/sign-out">) {
  const parameters = await searchParams;
  const returnTo = normalizeAuthReturnTo(parameters.returnTo);
  const enabled = isWiseAuthConfigured();

  return (
    <div className="auth-result page-container">
      <section className="auth-result__card" aria-labelledby="wise-sign-out-title">
        <span className="auth-result__mark" aria-hidden="true">
          W
        </span>
        <p className="auth-result__eyebrow">Wise ID</p>
        <h1 id="wise-sign-out-title">退出 Wise Crypto？</h1>
        <p>
          这只会结束 Crypto 子站会话，不会退出 Wise Invest 主站，也不会影响公开功能。
        </p>
        <div className="auth-result__actions">
          {enabled ? (
            <form action={endWiseSession}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit">确认退出</button>
            </form>
          ) : null}
          <Link href={returnTo}>取消</Link>
        </div>
      </section>
    </div>
  );
}
