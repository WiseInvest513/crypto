# Wise Crypto V0 data sources

This document records the Phase 2, Phase 4, and Phase 5 production data boundaries. Provider calls
run only on the server. A failed or unlicensed capability returns an explicit
`error`, `stale`, or `unavailable` datum; it is never replaced with a synthetic
production value.

| Capability | Production source | Scope and unit | Availability |
|---|---|---|---|
| BTC / ETH price | CoinMarketCap V3 Quotes Latest + Alternative.me Crypto API | Actual provider's covered spot markets, USD | With a server CMC key: CMC primary, Alternative.me fallback. Without a key: Alternative.me primary, official CMC keyless fallback. The displayed source always follows the returned datum |
| BTC / ETH interactive chart candles | Binance Spot Kline/Candlestick Data | Venue-scoped `BTCUSDT` / `ETHUSDT`, `15m / 1h / 4h / 1d`, USDT, UTC | Public endpoint; up to 1,000 candles are accepted, and only the latest may be explicitly marked forming. A forming snapshot uses a server-observation timestamp, not a fabricated source update timestamp |
| BTC / ETH daily candles | Binance Spot Kline/Candlestick Data | Venue-scoped `BTCUSDT` / `ETHUSDT`, `1d`, USDT, UTC | Public endpoint; only fully closed candles are accepted and forming candles are excluded |
| Total market cap / BTC dominance | CoinMarketCap Global Metrics Latest + Alternative.me Crypto API | Actual provider's covered market, USD / percent | Uses the same configured primary/fallback order as spot quotes; it is never labeled as wider than the active provider's coverage |
| Fear & Greed | CoinMarketCap Crypto Fear and Greed Latest + Alternative.me Bitcoin Fear & Greed | Provider-specific index, 0–100 | Latest-value failure fallback only. The actual index name/source is displayed next to the value; the two proprietary series are not joined into one history, and a stale primary value is not replaced by a different provider's index |
| ETH/BTC | Wise Crypto 派生指标 + verified input sources | `ETH/USD ÷ BTC/USD`; uses one Provider's validated pair, the older source timestamp, and deduplicated source links | Available only when both quotes are available and their source timestamps differ by no more than 10 minutes |
| Funding | Binance USDⓈ-M Premium Index | `BTCUSDT` or `ETHUSDT` perpetual venue rate | Public endpoint; no interval is inferred when the response does not supply one |
| Open interest | Binance USDⓈ-M Open Interest Statistics | `BTCUSDT` or `ETHUSDT` venue notional, explicitly labeled USDT with a `5m` sampling period | Public endpoint |
| 24h liquidations | CoinMarketCap Latest Total Liquidations | Rolling global total across CMC-tracked derivatives exchanges, USD | Requires server-only `COINMARKETCAP_API_KEY`; otherwise `unavailable` |
| BTC / ETH ETF flow | None configured | US spot ETF net flow | `unavailable` until a reliable, licensed source and verified content are configured |

## Phase 5 DCA history

- Historical DCA reuses the server-only Binance Spot candle provider; the
  browser never calls Binance directly and receives only `{date, close}` plus
  normalized lineage and state metadata.
- Each request loads BTCUSDT and ETHUSDT concurrently over an approximately
  two-year UTC range. The provider limit stays below 1,000 candles per asset.
- The projection accepts only live Binance data with the expected asset,
  symbol, `1d` interval, USDT quote, strict ascending UTC dates, positive finite
  closes, and a close time before retrieval. Synthetic, forming, duplicate,
  unsorted, or mismatched candles become an explicit error with no prices.
- Fresh and stale datasets retain source, scope, data time, retrieval time,
  cache state, and any stale error. Error and unavailable datasets always carry
  an empty price array; the calculator is disabled instead of inventing a
  result.

## Phase 4 technical calculations

- MA20 and MA50 are simple moving averages of the corresponding Binance spot
  `BTCUSDT` or `ETHUSDT` daily close. They are not EMAs and are not calculated
  from the CoinMarketCap USD headline price.
- A moving average stays unavailable until its complete 20- or 50-candle window
  exists; partial windows are never padded with zero.
- The objective trend state is `price > MA20 > MA50`,
  `price < MA20 < MA50`, mixed, or insufficient history. It does not create a
  Wise Scenario, support/resistance level, or trading recommendation.
- Technical output preserves the Binance candle source, UTC as-of time,
  retrieval time, stale state, and cache metadata through a derived-source link.
- The public chart exposes 15m / 1h / 4h / 1d controls, a visible text summary,
  forming-candle state, volume and a semantic table. Its MA20 / MA50 are
  display-only calculations for the selected interval and never feed the
  closed-daily technical service.
- The client refreshes through the allowlisted same-origin
  `/api/market/candles` route. Provider calls, validation, cache and failure
  handling remain on the server; UI code never calls Binance directly.

## Cache and failure semantics

- Provider payloads are schema-checked before they can enter the domain layer.
- Quote requests use provider-specific cache keys; concurrent cache misses for
  the same provider, capability, and asset are coalesced.
- BTC and ETH headline reads remain independent so one failed asset does not
  hide the other. ETH/BTC uses a separate same-Provider pair read; a timestamp
  skew above 10 minutes is rejected rather than presented as a coherent ratio.
- Homepage quotes, market pulse, and derivatives/fund-flow indicators load in
  independent Suspense segments. Asset-detail price, chart, and derivatives
  context do the same, so a slow venue endpoint does not blank the whole page.
- The public market adapter is an explicit two-provider fallback. A fallback
  value keeps its actual source and carries metadata describing why the primary
  source was not used; the UI labels this rather than silently switching. For
  comparable spot/global data, a fresh secondary may replace stale primary
  data. Fear & Greed keeps the stale primary series because the providers use
  different proprietary methodologies.
- Only validated successful values enter the in-memory cache.
- Cache results expose `hit`, `miss`, or `bypass`, plus revalidation and
  stale-if-error windows.
- Available data retains `updatedAt` for compatibility and adds an optional
  `updatedAtKind`. Missing/`source` means the upstream source published that
  timestamp. `observed` means the source did not publish an update timestamp
  for the live value and the server recorded when it observed the response.
  The UI labels the latter as `服务器观测于`, never `数据截至`. `retrievedAt`
  remains the separate time when the validated response entered the cache.
- A retryable upstream failure can serve a still-valid last-known-good value as
  `stale`; the attached error remains visible and never overwrites that value.
- Failed refreshes use a short, process-local retry backoff capped at 30
  seconds. This prevents every homepage request from repeating the same timeout;
  the backoff result remains an explicit `error` or `stale` state and is never
  promoted into the successful last-known-good cache. A stale backoff is capped
  by the last-known-good entry's absolute expiry and can never extend its life.
- Successful cache entries and retry-backoff entries are each bounded to 256
  process-local keys; the oldest retained key is evicted when the limit is hit.
- HTTP 429 and 5xx responses use bounded retries. Timeouts are aborted.
  Provider requests are HTTPS-only, reject credentialed URLs and redirects,
  and stream response bodies through a 2 MB hard limit before JSON parsing.
  Interrupted response bodies are retryable upstream errors; malformed complete
  JSON remains a non-retryable payload error.
- Source age is evaluated separately from cache age, so an old upstream
  timestamp is still marked `stale` after a successful request.
- Every cache policy revalidates no later than its maximum accepted source age,
  so a cache cadence cannot by itself hold a datum beyond its freshness SLA.
- V0's conservative cadence is 5 minutes for CMC and Alternative.me quotes,
  15/10 minutes for CMC/Alternative.me global metrics,
  5 minutes for liquidation calls, and 60 minutes for either Fear & Greed
  source. Binance venue metrics revalidate every 2 minutes; interactive chart
  candles revalidate every 5 seconds, allow a validated last-known-good value
  for five minutes after a refresh error, and are marked stale when the latest
  observed value is older than 20 seconds. Daily candles
  revalidate every 15 minutes and can use a validated last-known-good series for
  up to seven days after a refresh error. Daily candle source timestamps older
  than 36 hours are marked stale. A higher CMC plan can
  justify revisiting these values in a later quality phase. Funding snapshots
  older than 5 minutes and OI samples older than 10 minutes are marked stale.
- Cache storage is process-local in V0. It is not a cross-region distributed
  cache; that operational upgrade remains a future production decision.

## Security

- CMC credentials are read only by `src/server/data/config/provider-env.ts`,
  which is protected by `server-only`.
- `NEXT_PUBLIC_COINMARKETCAP_API_KEY` is rejected as a configuration error.
- The key is sent in the `X-CMC_PRO_API_KEY` request header only and is stored in
  a non-enumerable JavaScript private field.
- The production registry imports no Mock provider. Synthetic fixtures remain
  under `src/server/data/testing/` and are rejected in production.
- Binance Spot interactive and daily candles use the public market-data host
  and require no API credential. Their provider is still protected by
  `server-only` so UI modules consume normalized domain data rather than
  calling the venue directly.
- An empty Binance candle response remains an `error/no_data` datum with the
  real Binance source, scope, retrieval time, and cache metadata. It is not
  converted into an anonymous zero or metadata-free placeholder.
- Alternative.me uses public endpoints and no secret. Its Fear & Greed source
  link is rendered beside the value to satisfy the provider's attribution
  requirement.
