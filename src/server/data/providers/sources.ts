import type { DataSource } from "../contracts/market-data";

export const coinMarketCapSource: DataSource = {
  id: "coinmarketcap",
  label: "CoinMarketCap",
  url: "https://coinmarketcap.com/api/documentation/pro-api-reference",
};

export const alternativeMeMarketSource: DataSource = {
  id: "alternative-me-market",
  label: "Alternative.me Crypto API",
  url: "https://alternative.me/crypto/api/",
};

export const alternativeMeFearAndGreedSource: DataSource = {
  id: "alternative-me-fear-and-greed",
  label: "Alternative.me 恐惧与贪婪指数",
  url: "https://alternative.me/crypto/fear-and-greed-index/",
};

export const binanceUsdMSource: DataSource = {
  id: "binance-usdm",
  label: "Binance USDⓈ-M 合约市场数据",
  url: "https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data",
};

export const binanceSpotSource: DataSource = {
  id: "binance-spot",
  label: "Binance 现货市场数据",
  url: "https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market",
};
