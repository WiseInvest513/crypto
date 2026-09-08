# Wise Crypto 通用观察方法基线

更新日期：2026-09-06

这份文档定义 Wise Crypto 可以程序化复用的公开研究方法。它们只把已验证的行情事实整理成观察条件，不自动生成 Wise 的当前多空判断、开仓指令、目标价、胜率或收益承诺。人工策略仍需单独填写、审核、发布并设置有效期。

## 三层边界

1. **客观事实层**：价格、已闭合 K 线、EMA、成交量、关键价格区域和多周期关系。
2. **通用观察层**：把客观事实组织成“当前在哪里、还要确认什么、什么情况会失效”。
3. **Wise 人工策略层**：方向、人工观察区、执行窗口与风险判断。只有人工审核且处于有效期内的内容才可发布。

公开网络资料只能进入前两层的方法定义或第三层的参考来源，不能直接变成当前 Wise 判断。

## V1 使用的方法

### EMA 位置与排列

指数移动平均线采用：

```text
alpha = 2 / (n + 1)
EMA(t) = close(t) × alpha + EMA(t-1) × (1-alpha)
```

- 短线视角：EMA10、EMA20、EMA50。
- 趋势视角：EMA20、EMA50、EMA200。
- 页面可以陈述价格位于各 EMA 的上方或下方、均线实际排列和距离百分比。
- EMA 是历史价格的滞后描述，不用于宣称后续价格必然延续。

参考：[TradingView EMA 定义与公式](https://www.tradingview.com/support/solutions/43000592270-exponential-moving-average/)、[TradingView 移动平均线说明](https://www.tradingview.com/support/solutions/43000502589-moving-averages/)。

### 支撑、压力与价格区域

- 使用已经确认的摆动高低点、标准 Pivot、窗口 Fibonacci 和成交密集节点形成候选。
- 相近候选聚合为区域，不能把区域中心包装成保证生效的精确价格。
- 支撑与压力可互相转换；只有已闭合 K 线越过区域边界，才可描述为一次确认事件。
- 当前启发式权重只用于排序，不是概率、置信度或历史胜率。

参考：[CME 支撑与压力](https://www.cmegroup.com/education/courses/technical-analysis/support-and-resistance.hideSubnav.educationIframe.html.html?hideAddThisExt=y&hideFooter=y&hideHeader=y&hideRightRail=y)、[TradingView Pivot High / Low](https://www.tradingview.com/support/solutions/43000589195-pivot-points-high-low/)、[TradingView Standard Pivot](https://www.tradingview.com/support/solutions/43000521824-pivot-points-standard/)。

### 突破与回踩观察

以压力区域 `[lower, upper]` 为例：

```text
收盘突破：前一根已闭合收盘 <= upper，当前已闭合收盘 > upper
发生回踩：后续 K 线的高低范围与该区域相交
回踩守住：回踩后再次收盘于 upper 上方
突破失效：已闭合收盘重新落到 lower 下方
```

支撑跌破使用对称规则。界面只可写“已观察到收盘突破”“等待回踩确认”“条件已失效”等客观状态，不得写成“现在开多 / 开空”。

### 已闭合量能

```text
averageVolume20 = SMA(前 20 根已闭合 K 线成交量)
volumeRatio = 最新已闭合成交量 / averageVolume20
```

页面展示“为近 20 根均量的几倍”，不把放量等同于方向或成功率。基础资产成交量、计价资产成交量和形成中 K 线成交量必须区分。

参考：[TradingView 平均成交量方法](https://www.tradingview.com/support/solutions/43000745917-how-do-we-calculate-average-volume/)。

### 多周期一致性

15 分钟、1 小时、4 小时和日线独立使用各自已闭合 K 线计算，页面只统计多少周期位于 EMA20 上方或下方。`3/4` 只代表三项客观条件满足，不能改写成 `75%` 上涨或下跌概率。

实时高周期数据与历史确认值可能不同，因此正式判断只使用闭合数据，形成中价格只服务于图表显示。[TradingView Repainting 指南](https://www.tradingview.com/pine-script-docs/concepts/repainting/)

### 动态历史情景参照

首版仅对 BTC、ETH 的 `1h / 4h / 1d` 运行。输入为同一资产、同一 Binance Spot
USDT 交易对最近最多 1,000 根连续、已校验且已闭合的 K 线；它只能形成“近期历史参照”，
不能冒充全市场、全部历史或跨牛熊回测。

每根满足 EMA50 预热要求的闭合 K 线生成一个阶段指纹：

```text
pricePosition = close 相对 EMA10 / EMA20 / EMA50 的 above | below | equal
emaOrder = bullish (EMA10 > EMA20 > EMA50)
         | bearish (EMA10 < EMA20 < EMA50)
         | mixed
```

- 当前阶段使用最新闭合 K 线的指纹；形成中价格不改变该阶段。
- 历史匹配要求阶段指纹完全相同。连续停留在同一指纹只记录第一次进入，避免把一个行情片段
  拆成大量重复样本。
- 事件特征必须按当时闭合数据计算。当前 EMA、当前关键位或以后才确认的摆动点不能回填到过去。
- 没有完整后续 24 根闭合 K 线的事件不进入完整结果聚合。

对每个事件，以事件闭合收盘 `eventClose` 为基准观察第 6、12、24 根：

```text
forwardReturn(h) = close(t+h) / eventClose - 1
maxUpside(h) = max(high(t+1 ... t+h)) / eventClose - 1
maxDownside(h) = min(low(t+1 ... t+h)) / eventClose - 1
```

中位数、25%–75% 分位区间与代表案例使用全部具有完整未来窗口的事件。方向比例另按每个
观察周期筛选非重叠事件：按时间顺序保留最早事件，下一事件必须至少相隔 `h` 根，使两次
未来观察窗口不重叠。页面同时披露全部事件数与方向比例采用的不重叠样本数；该样本少于
20 个时标记“样本不足”，不展示方向比例、胜率或概率。代表案例必须遵循稳定、可说明的
选取规则，不得只挑选支持当前叙事的片段。

页面据此组织“当前阶段、近期历史参照、关键位置、下一次确认 / 失效”。历史结果是条件相似性
说明，不是预测；不能改写成开多、开空、目标价、止损、仓位或收益承诺。后续如建设完整历史
基线，应使用 Binance 官方归档、校验 checksum 并记录数据覆盖、算法版本与生成时间；归档层
未接入前不得扩大首版结论的时间范围。

## 后续证据层（尚未接入）

- RSI14：可描述与 30 / 50 / 70 的位置及经确认的背离；超买超卖不等于自动反转。[TradingView RSI](https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/)
- MACD：可描述零轴、Signal 相对位置与柱体变化；它仍是历史价格派生的动量指标。[TradingView MACD](https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/)
- ATR14：可用于波动归一化的区域宽度，但只衡量波动，不给出方向。[TradingView ATR](https://www.tradingview.com/support/solutions/43000501823-average-true-range-atr/)

这些方法需要独立实现、测试与界面层级确认，当前 V1 不用占位值冒充已接入。

## 发布与风险规则

- 只使用已闭合 K 线生成确认事实，保留周期与确认时间。
- 不展示未经验证的胜率、置信度、回测成绩或收益承诺。
- 人工策略必须包含确认条件、失效条件、风险说明、作者、审核人和半开有效期 `[validFrom, validUntil)`。
- 到达 `validUntil` 时立即从当前策略界面移除；撤回状态优先于其他状态。
- 普通用户不得收到隐藏策略的方向、价格、作者、时间或来源字段。
- 不存在无风险的数字资产交易；策略展示不能弱化重大损失风险。[CFTC 数字资产风险说明](https://www.cftc.gov/sites/default/files/LearnandProtect/DigitalAssetRisks.pdf)、[Investor.gov Crypto 风险提示](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/crypto-asset-securities)
