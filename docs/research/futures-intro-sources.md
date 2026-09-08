# 合约入门：事实核验基线

> 更新时间：2026-09-06
> 用途：供课程作者和代码审查核对关键概念，不作为页面上的来源列表展示。

## 教学边界

- 课程只解释合约机制、风险控制和图表观察方法，不给出实时开仓方向、收益承诺或个性化投资建议。
- 示例图必须标记为“教学示意”，不得把静态价格或走势伪装成实时行情。
- 强平价、资金费率、手续费和保证金规则随交易所、合约、仓位模式与档位变化；课程只讲机制，不能把简化公式包装成交易所最终结果。
- 均线、布林带和 Fibonacci 都是观察工具，不是可以单独保证结果的买卖信号。

## 已核验资料

### 杠杆与合约风险

- [CFTC：Understand the Risks of Virtual Currency Trading](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/understand_risks_of_virtual_currency.html)
  - 杠杆会同时放大盈利与亏损；虚拟货币衍生品属于高风险产品。

### 永续合约资金费率与强平

- [Binance Futures：Funding Rates](https://www.binance.com/en/support/faq/detail/360033525031)
  - 资金费率由利率与溢价等部分构成；结算间隔和上下限可能调整，费用也可能影响仓位保证金。
- [Binance Futures：Liquidation Protocols](https://www.binance.com/en-AU/support/faq/detail/360033525271)
  - 强平判断和未实现盈亏使用标记价格；规则会受到保证金模式、维持保证金等因素影响。

### 指标与关键区域

- [TradingView：Moving Averages](https://www.tradingview.com/support/solutions/43000502589-moving-averages/)
  - 均线基于历史价格，属于滞后、反应式工具，不是预测器。
- [TradingView：Bollinger Bands](https://www.tradingview.com/support/solutions/43000501840-bollinger-bands-bb/)
  - 常见设置为 20 周期均线与上下 2 个标准差；触碰或突破轨道本身并不构成确定的买卖信号。
- [TradingView：Fibonacci Retracement](https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/)
  - 从两个极值绘制比例区间，用于识别潜在支撑和压力区域；应当与结构和确认条件一起观察。

## 内容审查清单

- [ ] 解释现货、交割、永续、做多、做空的差异。
- [ ] 明确杠杆不是收益倍增器，而是风险与资金效率工具。
- [ ] 明确逐仓、全仓、标记价格、保证金和强平规则的边界。
- [ ] 均线、布林带、Fibonacci、支撑压力均包含“确认”和“失效”概念。
- [ ] 每道题只有一个在课程语境中明确正确的答案，并提供解释。
- [ ] 不出现真实账户、实时价格、邀请码、交易按钮或未经核验的历史收益数字。
