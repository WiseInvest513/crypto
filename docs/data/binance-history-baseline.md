# Binance 官方归档与长期历史基线离线构建器

## 用途与边界

这个构建器只在开发者显式运行命令时工作。它不会被页面、Route Handler 或公共研究服务调用，也不会在网页请求期间下载历史文件。

当前允许范围：

- 现货交易对：`BTCUSDT`、`ETHUSDT`
- 周期：`1h`、`4h`、`1d`
- 文件：Binance 官方月度 K 线 ZIP 与同名 `.CHECKSUM`
- 时间：必须明确提供完整的起止 UTC 月份；不提供“自动下载全部历史”的默认值

官方格式依据：

- [Binance Public Data](https://github.com/binance/binance-public-data/blob/master/README.md)
- [Binance Data Collection](https://data.binance.vision/)

Binance 官方说明，现货归档从 2025-01-01 起使用微秒时间戳。构建器同时识别旧的毫秒数据与新的微秒数据，归一化产物统一保存为毫秒。

早期毫秒归档中存在极少数 K 线把 `close time` 记录为周期内的提前时间，或下一周期
起点，而不是标准的 `open + interval - 1ms`。只要 `open time` 桶仍严格连续，构建器
只对旧毫秒格式且 `open <= close <= open + interval` 的记录规范化为标准闭合边界；
微秒记录继续要求精确边界，落到周期外的毫秒记录也继续 fail closed。每月私有 cache、
单流 manifest 及最终六流审计 manifest 都记录
`legacyMillisecondCloseTimeNormalizationCount`，因此修正数量不会被隐藏。

早期停机恢复阶段还存在少量旧毫秒小时线没有落在 UTC 周期边界的官方记录。例如
BTC/ETH `1h` 的 2018-02 归档中，有连续 43 行开盘时间整体偏离整点。构建器只允许在
离线归档的 `1h / 4h` 旧毫秒输入中排除这类行；不会移动时间、对齐到邻近整点、插值或补造
K 线。微秒记录及 `1d` 记录只要不对齐就继续 fail closed。每月 cache、单流 manifest 与
最终 manifest 分别记录 `sourceRowCount`、`acceptedCandleCount`、
`excludedUnalignedCandleCount` 和下面单独说明的零成交占位排除数；运行时产物只保留汇总，
不包含被排除的逐行内容。

旧毫秒小时归档还可能包含停机期间写入的零成交占位行：`open time` 位于标准 UTC bucket，
但原始 `close time` 早于 `open time`。构建器只有在 `close time` 仍位于紧邻的前一 bucket、
OHLC 四值完全相等，并且基础量、报价量、主动买入量与成交笔数全部为零时，才排除该行。
它不会把占位行改写成 K 线；过滤后相邻标准 bucket 之间的空白继续进入 gap / segment 审计。
微秒、`1d`、越过前一 bucket、非零成交或 OHLC 不相等的相似记录一律失败。该类排除独立记为
`excludedLegacyZeroVolumePlaceholderCount`，不能混入非对齐排除数；每个 source 及总覆盖均满足
`sourceRowCount = acceptedCandleCount + excludedUnalignedCandleCount + excludedLegacyZeroVolumePlaceholderCount`。

## 环境要求

- Node.js `>=20.9`
- 系统可执行文件 `unzip`（macOS 与常见 Linux 环境通常自带）
- 可访问 `https://data.binance.vision`

没有引入 ZIP 大型运行时依赖。构建器通过参数数组调用 `unzip`，不会经过 shell。

## 单流下载与验证

先只检查将要访问的官方 URL，不下载或写文件：

```bash
pnpm history:download -- --symbol BTCUSDT --interval 1h --from 2024-01 --to 2024-03 --dry-run
```

构建明确指定的月份：

```bash
pnpm history:download -- --symbol BTCUSDT --interval 1h --from 2024-01 --to 2024-03
```

查看参数：

```bash
pnpm history:download -- --help
```

可用的额外参数：

- `--private-root PATH`：改变私有 raw/cache 根目录。
- `--verified-root PATH`：改变版本化中间产物目录；该目录必须位于 `--private-root` 内。
- `--refresh`：强制重新下载 ZIP；未提供时可复用本地非空 ZIP。构建器每次都会重新取得官方 `.CHECKSUM`，再用当次的官方值验证本地或新下载的 ZIP。
- `--allow-gaps`：仅用于 `1h / 4h`，允许严格对齐的缺失 bucket 进入审计分段；不会补 K 线。`1d` 永远拒绝该选项。

## 文件布局

默认私有目录已经由 `.gitignore` 排除：

```text
.wise-crypto-private/binance-history/
  raw/spot/monthly/klines/BTCUSDT/1h/
    BTCUSDT-1h-2024-01.zip
    BTCUSDT-1h-2024-01.zip.CHECKSUM
  cache/v2/BTCUSDT/1h/
    BTCUSDT-1h-2024-01.<sha256>.json
```

版本化、已验证的中间产物同样保留在私有目录：

```text
.wise-crypto-private/binance-history/verified/v2/BTCUSDT/1h/
  baseline-<datasetVersion>.json
  manifest-<datasetVersion>.json
  manifest.json
```

`baseline` 中每根 K 线使用以下紧凑数组顺序：

```text
[openTimeMs, open, high, low, close, volume, closeTimeMs]
```

`manifest.json` 是当前版本指针；带 `datasetVersion` 的 baseline 和 manifest 便于审计与回滚。写入先落在同目录临时文件，再以 rename 原子替换。

这里的 baseline 仍含完整 K 线，因此被明确标记为 `verified-kline-intermediate`、`runtimeReady: false`，只能作为后续离线事件编译器的输入。它不会写入默认可提交的 `data/` 或 `src/` 目录，也不能被线上页面直接读取。

## 校验规则

只有全部检查通过才会发布 manifest：

1. ZIP 的 SHA-256 必须与官方 `.CHECKSUM` 完全一致。
2. ZIP 必须只包含预期名称的根级 CSV。
3. 每行必须严格包含 Binance K 线定义的 12 列。
4. 时间戳必须是受支持的毫秒或微秒整数，并归一化到安全的毫秒整数。
5. OHLC 必须为正数，成交量类字段不得为负，最高价与最低价必须包住开盘和收盘。
6. 每根 K 线必须对齐 UTC 周期边界、规范化后覆盖完整周期，且已经闭合，不得位于未来。
   旧毫秒归档中位于自身 bucket 内（含下一周期起点）的非标准 close time 可规范化并逐文件
   计数；微秒记录不使用该兼容规则，任何 open time 缺口也不会因此被掩盖。
   只有旧毫秒 `1h / 4h` 非 UTC boundary 行可被明确排除并计数；微秒和日线不使用该兼容规则。
7. 过滤后的数据必须严格升序、无重复，开盘时间差必须是周期整数倍。首月可自然地从月中开始，末月也可在月中结束。`1d` 的月内或跨月缺口始终终止构建；`1h / 4h` 只有在六流编译器或显式 `--allow-gaps` 下才接受对齐缺口，并逐项记录前一根闭合时间、下一根开盘时间和缺失根数。缺口根数只按保留下来的标准 UTC buckets 计算。
8. CSV 中的 K 线开盘月份必须与请求的归档月份一致。

任何一步失败都会终止构建；缺失或错误数据不会用零值、插值或合成 K 线补齐。

## 六流长期统计编译

正式构建必须显式提供同一段完整 UTC 月份范围。命令以最多两个并发流依次取得并校验
`BTCUSDT / ETHUSDT × 1h / 4h / 1d`，不会接受资产或周期筛选，避免发布缺流产物：

```bash
pnpm history:build -- --from <first-archive-month> --to <last-complete-month>
```

本轮完整归档构建使用明确范围（不是脚本默认值）：

```bash
pnpm history:build -- --from 2017-08 --to 2026-07
```

### 本次本地产物（本轮总 QA 已通过，未部署）

2026-09-06 已完成一次本地六流离线构建；本轮总 QA 已通过 `pnpm lint`、
`pnpm typecheck`、`pnpm test` 与 `pnpm build`，本次变更仍未部署：

- 请求月份：`2017-08` 至 `2026-07`，每条流均核验 108 个月度归档。
- 生成时间：`2026-09-06T11:31:58.783Z`。
- 数据集版本：`fd12e7…01fb`（完整值保留在 runtime artifact 与 manifest）。
- “排除”两列依次为非 UTC 边界旧毫秒行、严格零成交旧毫秒占位行；两类记录都不进入
  EMA、事件或未来观察窗。

| 流 | 源行 / 接受 | 排除（未对齐 / 占位） | 连续段 / 缺口 / 缺根 | 完整事件 |
|---|---:|---:|---:|---:|
| BTC 1h | 78,373 / 78,329 | 43 / 1 | 29 / 28 / 171 | 26,788 |
| BTC 4h | 19,608 / 19,608 | 0 / 0 | 10 / 9 / 17 | 6,085 |
| BTC 1d | 3,271 / 3,271 | 0 / 0 | 1 / 0 / 0 | 969 |
| ETH 1h | 78,373 / 78,329 | 43 / 1 | 29 / 28 / 171 | 26,649 |
| ETH 4h | 19,608 / 19,608 | 0 / 0 | 10 / 9 / 17 | 6,295 |
| ETH 1d | 3,271 / 3,271 | 0 / 0 | 1 / 0 / 0 | 1,012 |

运行时产物经检查不含全量 K 线、逐点制度、代表案例、逐事件记录或归档源文件清单；
完整 URL、checksum、逐月行数和精确缺口只保留在审计 manifest。

`from` 不能仅按交易对上线月份猜测，实际发布范围以最终产物及 manifest 为准。官方 ZIP
即使通过 `.CHECKSUM`，仍可能含真实的 open-time 缺口，例如 2017-09 的早期小时线以及
2018-02、2019-03 的 BTC `4h`。六流编译器不会插值，也不会让 EMA、状态事件、未来观察窗
或独立方向样本跨越缺口，而是把 `1h / 4h` 按每个真实连续段分别计算，再聚合各段的原始事件
结果。分位数与方向占比从合并后的原始结果重算，绝不平均已经聚合的统计。被排除的旧毫秒
非 UTC 边界行与严格零成交占位行分别计数，只用于来源行数审计，不进入事件或 EMA。`1d`
缺口会直接终止构建，因为跨缺口延续 EMA200 会破坏牛熊制度口径。

可使用 `--concurrency 1|2|3` 调整归档流并发数，使用 `--refresh` 强制重新下载 ZIP。
每次构建仍会刷新所有 `.CHECKSUM`。`--private-root` 只用于明确改变私有缓存位置；
运行时产物与审计 manifest 始终发布到下面的固定仓库路径，避免构建脚本静默改变应用输入。

离线编译会为每个资产只计算一次日线 EMA50 / EMA200 制度序列，再供该资产的
`1h / 4h / 1d` 事件共同使用。机械标签严格为：

- `bull`：已闭合日线收盘高于 EMA200，且 EMA50 高于 EMA200。
- `bear`：已闭合日线收盘低于 EMA200，且 EMA50 低于 EMA200。
- `transition`：其他关系。

低周期事件只匹配事件闭合时已经闭合的最近日线，不能读取同日未来的日线结果。若 BTC 或
ETH 任一资产没有真实 bull、bear 日线覆盖，或任一 `asset × interval` 没有在两类制度中
各形成至少一个完整历史事件，整次构建会在写入前失败。单个精确 EMA 指纹可以只出现在某一
制度中；这里不伪造每个指纹的跨制度样本。

成功构建只发布两个文件：

```text
src/server/data/generated/historical-baselines.json
data/history-baselines/v2/manifest.json
```

前者是网页运行时可读取的紧凑统计，只包含 EMA 状态指纹、制度分组、样本数、分位统计、
数据集版本和算法版本；不包含 K 线数组、制度点序列、代表事件或全量事件记录，只保留每流的
segment / gap / missing-candle 汇总数。后者用于完整审计，保留六个流的每月 ZIP URL、
`.CHECKSUM` URL、SHA-256、原始行数、接受行数、非对齐排除数、零成交占位排除数、覆盖边界、
每一个精确缺口、输入数据集版本及最终运行时产物的字节级 SHA-256。两个文件都使用同目录
临时文件加 rename 原子替换；
所有校验和跨制度门槛在替换任何现有文件前完成。

当前仓库已经生成上表对应的静态 runtime artifact；服务启动时仍会重新校验 schema、版本、
范围与聚合结构。缺少或损坏产物时长期参照独立返回不可用，不回退测试数字，也不影响实时
图表与近期参照。线上历史情景服务不得读取全量 K 线中间产物，也不得在用户请求中临时访问
Binance 归档。

仍需在部署运维阶段独立补充：

- 发布与回滚流程
- 产物保留周期
- 定时离线增量构建
- 数据版本与算法版本的联合追踪
