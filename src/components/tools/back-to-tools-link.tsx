import Link from "next/link";

export function BackToToolsLink({
  currentLabel,
}: {
  currentLabel?: string;
}) {
  return (
    <div className="tool-return-context">
      <Link className="tool-return-link" href="/tools">
        <ArrowLeftIcon />
        <span>返回工具</span>
      </Link>

      {currentLabel ? (
        <nav className="tool-breadcrumb" aria-label="当前位置">
          <ol>
            <li>
              <span>工具</span>
            </li>
            <li aria-current="page">
              <span className="tool-breadcrumb__separator" aria-hidden="true">
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
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
    >
      <path
        d="m11.75 5.25-4.5 4.75 4.5 4.75M7.5 10h7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
