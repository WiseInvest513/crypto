import Link from "next/link";

export function BackToLearnLink({ currentLabel }: { currentLabel?: string }) {
  return (
    <div className="learn-return-context">
      <Link className="learn-return-link" href="/learn">
        <ArrowLeftIcon />
        <span>返回学习</span>
      </Link>

      {currentLabel ? (
        <nav className="learn-breadcrumb" aria-label="当前位置">
          <ol>
            <li>
              <span>学习</span>
            </li>
            <li aria-current="page">
              <span className="learn-breadcrumb__separator" aria-hidden="true">
                /
              </span>
              <span>{currentLabel}</span>
            </li>
          </ol>
        </nav>
      ) : null}
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none">
      <path d="m11.75 5.25-4.5 4.75 4.5 4.75M7.5 10h7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}
