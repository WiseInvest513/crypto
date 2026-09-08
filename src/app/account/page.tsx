import type { Metadata } from "next";
import Link from "next/link";
import { WiseAvatar } from "@/components/account/wise-avatar";
import { WISE_INVEST_ACCOUNT_URL } from "@/config/site";
import { createProtectedPageMetadata } from "@/lib/seo/page-metadata";
import { requireWisePageAccount } from "@/server/auth/wise-route-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createProtectedPageMetadata({
  title: "账户与会员",
  description:
    "查看 Wise ID 返回的昵称、邮箱、用户 ID 与 Wise Crypto 会员身份。",
  path: "/account",
  socialTitle: "账户与会员｜Wise Crypto",
});

export default async function AccountPage() {
  const account = await requireWisePageAccount("/account");
  const accountName = account.displayName ?? "Wise 用户";
  const emailStatus = account.email
    ? account.emailVerified === true
      ? "已由 Wise ID 验证"
      : "验证状态由主站管理"
    : "主站未返回邮箱";

  return (
    <div className="account-center page-container">
      <nav className="account-center__back" aria-label="当前位置">
        <Link href="/">市场总览</Link>
        <span aria-hidden="true">/</span>
        <span>账户与会员</span>
      </nav>

      <section className="account-center__hero" aria-labelledby="account-title">
        <div className="account-center__identity">
          <WiseAvatar
            displayName={account.displayName}
            email={account.email}
            imageUrl={account.imageUrl}
            size="large"
          />
          <div>
            <p>WISE ID · 已连接</p>
            <h1 id="account-title">{accountName}</h1>
            <span>{account.label}</span>
          </div>
        </div>
        <div className="account-center__hero-copy">
          <p className="account-center__eyebrow">账户与会员</p>
          <h2>一套身份，进入 Wise Crypto</h2>
          <p>
            登录身份和会员状态由 Wise ID 统一管理。Crypto 只读取本次会话需要的资料，不另建用户数据库。
          </p>
        </div>
      </section>

      <div className="account-center__layout">
        <section className="account-center__details" aria-labelledby="account-details-title">
          <header>
            <div>
              <p className="account-center__eyebrow">只读资料</p>
              <h2 id="account-details-title">当前账户</h2>
            </div>
            <span>实时取自当前 Wise ID 会话</span>
          </header>

          <dl>
            <div>
              <dt>Wise ID</dt>
              <dd>
                <strong>{account.wiseId}</strong>
                <span>同一 Wise ID 可用于 Wise 生态内的产品</span>
              </dd>
            </div>
            <div>
              <dt>登录邮箱</dt>
              <dd>
                <strong>{account.email ?? "暂未提供"}</strong>
                <span>{emailStatus}</span>
              </dd>
            </div>
            <div>
              <dt>会员等级</dt>
              <dd>
                <strong>{account.label}</strong>
                <span>权限以 Wise ID 返回的最新有效状态为准</span>
              </dd>
            </div>
            <div>
              <dt>会话状态</dt>
              <dd>
                <strong>当前设备已安全登录</strong>
                <span>Wise Crypto 不保存你的主站密码</span>
              </dd>
            </div>
          </dl>

          <div className="account-center__protection">
            <ShieldIcon />
            <div>
              <strong>由 Wise ID 保护登录</strong>
              <p>
                昵称、头像、邮箱、用户 ID 与会员等级仅用于本次会话展示；如需修改资料，请前往主站账户中心。
              </p>
            </div>
          </div>
        </section>

        <aside className="account-center__actions" aria-labelledby="account-actions-title">
          <div>
            <p className="account-center__eyebrow">账户管理</p>
            <h2 id="account-actions-title">资料由主站统一维护</h2>
            <p>修改头像、昵称、邮箱或会员方案时，前往 Wise ID 完成即可。</p>
          </div>
          <a href={WISE_INVEST_ACCOUNT_URL}>
            前往 Wise ID 管理账户
            <span aria-hidden="true">↗</span>
          </a>
          <Link href="/auth/sign-out?returnTo=/account">
            退出当前账户
          </Link>
          <small>
            退出只结束 Wise Crypto 会话，不会退出 Wise Invest 主站。
          </small>
        </aside>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 19 6v5.2c0 4.5-2.8 7.9-7 9.8-4.2-1.9-7-5.3-7-9.8V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
