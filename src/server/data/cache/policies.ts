export type CachePolicy = {
  revalidateSeconds: number;
  staleIfErrorSeconds: number;
  maxSourceAgeSeconds: number;
};

export const cachePolicies = {
  quote: {
    revalidateSeconds: 10 * 60,
    staleIfErrorSeconds: 15 * 60,
    maxSourceAgeSeconds: 5 * 60,
  },
  alternativeQuote: {
    revalidateSeconds: 5 * 60,
    staleIfErrorSeconds: 30 * 60,
    maxSourceAgeSeconds: 10 * 60,
  },
  global: {
    revalidateSeconds: 30 * 60,
    staleIfErrorSeconds: 60 * 60,
    maxSourceAgeSeconds: 15 * 60,
  },
  alternativeGlobal: {
    revalidateSeconds: 10 * 60,
    staleIfErrorSeconds: 60 * 60,
    maxSourceAgeSeconds: 20 * 60,
  },
  candles: {
    revalidateSeconds: 15 * 60,
    staleIfErrorSeconds: 7 * 24 * 60 * 60,
    maxSourceAgeSeconds: 36 * 60 * 60,
  },
  liveCandles: {
    revalidateSeconds: 5,
    staleIfErrorSeconds: 5 * 60,
    maxSourceAgeSeconds: 20,
  },
  sentiment: {
    revalidateSeconds: 60 * 60,
    staleIfErrorSeconds: 24 * 60 * 60,
    maxSourceAgeSeconds: 2 * 60 * 60,
  },
  alternativeSentiment: {
    revalidateSeconds: 60 * 60,
    staleIfErrorSeconds: 48 * 60 * 60,
    maxSourceAgeSeconds: 36 * 60 * 60,
  },
  funding: {
    revalidateSeconds: 2 * 60,
    staleIfErrorSeconds: 30 * 60,
    maxSourceAgeSeconds: 5 * 60,
  },
  openInterest: {
    revalidateSeconds: 2 * 60,
    staleIfErrorSeconds: 30 * 60,
    maxSourceAgeSeconds: 10 * 60,
  },
  liquidations: {
    revalidateSeconds: 10 * 60,
    staleIfErrorSeconds: 30 * 60,
    maxSourceAgeSeconds: 5 * 60,
  },
} as const satisfies Record<string, CachePolicy>;
