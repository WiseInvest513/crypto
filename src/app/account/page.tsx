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
  const isLocalDevelopment =
    account.authenticationSource === "local-development";
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
            <p>
              {isLocalDevelopment
                ? "LOCAL DEV · 登录旁路"
                : "WISE ID · 已连接"}
            </p>
            <h1 id="account-title">{accountName}</h1>
            <span>
              {account.membershipAccessFresh ? account.label : "VIP 权益待验证"}
            </span>
          </div>
        </div>
        <div className="account-center__hero-copy">
          <p className="account-center__eyebrow">
            {isLocalDevelopment ? "本地调试身份" : "账户与会员"}
          </p>
          <h2>
            {isLocalDevelopment
              ? "直接调试，不经过主站登录"
              : "一套身份，进入 Wise Crypto"}
          </h2>
          <p>
            {isLocalDevelopment
              ? "这个固定普通用户只在本机 2222 端口的开发服务器生效，不创建 Cookie，也不会模拟 VIP；生产环境仍执行正常登录。"
              : "登录身份和会员状态由 Wise ID 统一管理。Crypto 只读取本次会话需要的资料，不另建用户数据库。"}
          </p>
        </div>
      </section>

      <div className="account-center__layout">
        <section className="account-center__details" aria-labelledby="account-details-title">
          <header>
            <div>
              <p className="account-center__eyebrow">只读资料</p>
              <h2 id="account-details-title">
                {isLocalDevelopment ? "本地开发身份" : "当前账户"}
              </h2>
            </div>
            <span>
              {isLocalDevelopment
                ? "固定调试资料 · 不创建主站会话"
                : "取自本次 Wise ID 登录"}
            </span>
          </header>

          <dl>
            <div>
              <dt>{isLocalDevelopment ? "调试 ID" : "Wise ID"}</dt>
              <dd>
                <strong>{account.wiseId}</strong>
                <span>
                  {isLocalDevelopment
                    ? "仅用于识别当前本地调试身份"
                    : "同一 Wise ID 可用于 Wise 生态内的产品"}
                </span>
              </dd>
            </div>
            <div>
              <dt>登录邮箱</dt>
              <dd>
                <strong>{account.email ?? "暂未提供"}</strong>
                <span>
                  {isLocalDevelopment ? "本地身份不读取用户邮箱" : emailStatus}
                </span>
              </dd>
            </div>
            <div>
              <dt>会员等级</dt>
              <dd>
                <strong>
                  {account.membershipAccessFresh ? account.label : "VIP 权益待重新验证"}
                </strong>
                <span>
                  {isLocalDevelopment
                    ? "开发旁路固定为普通用户，不授予 VIP 权限"
                    : account.membershipAccessFresh
                      ? "本次会话以登录时 Wise ID 返回的状态为准"
                      : "基础登录仍有效；重新验证后才能恢复 VIP 私有内容"}
                </span>
              </dd>
            </div>
            <div>
              <dt>会话状态</dt>
              <dd>
                <strong>
                  {isLocalDevelopment
                    ? "本地开发直通已启用"
                    : "当前设备已安全登录"}
                </strong>
                <span>
                  {isLocalDevelopment
                    ? "关闭开发服务器即结束，不写入登录状态"
                    : "Wise Crypto 不保存你的主站密码"}
                </span>
              </dd>
            </div>
          </dl>

          <div className="account-center__protection">
            <ShieldIcon />
            <div>
              <strong>
                {isLocalDevelopment
                  ? "生产环境不会启用此身份"
                  : "由 Wise ID 保护登录"}
              </strong>
              <p>
                {isLocalDevelopment
                  ? "仅当运行 next dev 且请求来自 localhost 或 127.0.0.1:2222 时开放；Vercel、线上域名和生产预览全部关闭。"
                  : "昵称、头像、邮箱、用户 ID 与会员等级仅用于本次会话展示；如需修改资料，请前往主站账户中心。"}
              </p>
            </div>
          </div>
        </section>

        <aside className="account-center__actions" aria-labelledby="account-actions-title">
          <div>
            <p className="account-center__eyebrow">
              {isLocalDevelopment ? "调试边界" : "账户管理"}
            </p>
            <h2 id="account-actions-title">
              {isLocalDevelopment ? "无需登录即可继续开发" : "资料由主站统一维护"}
            </h2>
            <p>
              {isLocalDevelopment
                ? "行情、工具和合约课程现在可以直接打开；如需验证真实登录，请使用生产预览。"
                : "修改头像、昵称、邮箱或会员方案时，前往 Wise ID 完成即可。"}
            </p>
          </div>
          {isLocalDevelopment ? (
            <>
              <Link href="/tools">
                进入工具
                <span aria-hidden="true">→</span>
              </Link>
              <small>本地调试身份没有退出按钮，因为它不创建登录会话。</small>
            </>
          ) : (
            <>
              {!account.membershipAccessFresh ? (
                <Link className="account-center__reauth" href="/auth/sign-in?returnTo=/account&reauth=1">
                  重新验证 VIP 权益
                  <span aria-hidden="true">↗</span>
                </Link>
              ) : null}
              <a href={WISE_INVEST_ACCOUNT_URL}>
                前往 Wise ID 管理账户
                <span aria-hidden="true">↗</span>
              </a>
              <Link className="account-center__sign-out" href="/auth/sign-out?returnTo=/account">
                退出当前账户
              </Link>
              <small>
                退出只结束 Wise Crypto 会话，不会退出 Wise Invest 主站。
              </small>
            </>
          )}
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
