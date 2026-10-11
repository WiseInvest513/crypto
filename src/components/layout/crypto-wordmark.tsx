export function CryptoWordmark() {
  return (
    <span className="crypto-wordmark" aria-hidden="true">
      <svg
        className="crypto-wordmark__lettering"
        viewBox="0 0 139 24"
        fill="none"
        focusable="false"
      >
        <g
          stroke="currentColor"
          strokeWidth="2.45"
          strokeLinecap="square"
          strokeLinejoin="miter"
        >
          <path d="M17 4.6a9 9 0 1 0 0 14.8" />
          <path d="M25 20V4h8.1c4.5 0 7 2 7 5.2 0 3.3-2.5 5.3-7 5.3H25m8.6 0L41.3 20" />
          <path d="m47 4 8 9 8-9M55 13v7" />
          <path d="M70 20V4h8.2c4.8 0 7.3 2.1 7.3 5.7s-2.5 5.8-7.3 5.8H70" />
          <path d="M92 4h18M101 4v16" />
          <path d="M128.5 4.4a8.6 8.6 0 1 0 0 15.2" />
        </g>
        <path
          d="M133.3 6.7a8.6 8.6 0 0 1 0 10.6"
          stroke="var(--crypto-wordmark-accent)"
          strokeWidth="2.45"
          strokeLinecap="square"
        />
        <path
          d="m52.2 9.8 2.8 3.2 2.8-3.2"
          stroke="var(--crypto-wordmark-gold)"
          strokeWidth="2.45"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    </span>
  );
}
