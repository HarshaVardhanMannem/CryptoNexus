# Crypto Multi-Agent System — Engineering Suggestions Report

**Source:** Trace analysis of two task runs (taskIds `7fcc6edb-...` and `5c40c041-...`)
**Date of trace:** 2026-04-24
**Scope:** Coordinator, planner, agent loops, tool layer, synthesis, verification

---

## 1. Executive Summary

The system is architecturally sound (planner → parallel agents → synthesis → verification) but suffers from six categories of issues that degrade output quality and user experience:

1. **Latency** — simple queries take 130–150 seconds.
2. **Data integrity** — broken indicator math (MACD), hallucinated dates, fabricated context.
3. **Failure handling** — APIs fail silently and the system synthesizes "neutral" answers around missing data.
4. **Planner accuracy** — wrong agent assigned to subtasks, redundant subtasks created.
5. **Scope mismatch** — every query gets a full trading strategy whether requested or not.
6. **Confidence calibration** — scores stay around 0.6 regardless of data quality.

Severity is ranked **P0 (correctness bug, fix immediately)**, **P1 (reliability/UX)**, **P2 (efficiency/polish)** below.

---

## 2. P0 — Correctness Bugs

### 2.1 MACD calculation is broken

**Evidence** (run 1, `fetch_price_history` result):
```json
"macd": { "value": -8.68, "signal": 77940.76, "histogram": -77949.44 }
```

The MACD signal line should be a small number derived from the difference of two EMAs, not equal to the asset price. The histogram (`value - signal`) is then nonsensically `-77949.44`. The verifier flagged this in run 1 but the synthesis still cited "negative histogram" as evidence of bearish momentum.

**Likely cause:** The signal calculation is returning the EMA of price instead of the EMA of the MACD line, or the subtraction order is wrong.

**Fix:**
- Audit `fetch_price_history` indicator code.
- Standard MACD: `MACD = EMA12(price) - EMA26(price)`; `Signal = EMA9(MACD)`; `Histogram = MACD - Signal`.
- Add a unit test asserting `abs(macd.signal) < abs(currentPrice / 100)` for any liquid asset — catches this class of bug forever.
- Add a runtime sanity check in the agent loop: if `abs(signal) > currentPrice / 10`, log a warning and exclude MACD from the analysis.

### 2.2 Synthesis hallucinated the date

**Evidence** (run 1 synthesis output): `**Comprehensive BTC Value Analysis (June 2024)**` — the actual timestamp is `2026-04-24`.

**Fix:** Inject the current ISO date into the synthesis prompt explicitly (`Today's date is {ISO_DATE}. Do not invent a date.`) and forbid month/year in the title template.

### 2.3 Planner assigns wrong agent type

**Evidence** (run 2): Subtask `Fetch Fear and Greed Index` was assigned to `market_monitor`, but the F&G index is fetched via the `news_sentiment` agent's `fetch_fear_greed_index` tool. The market_monitor agent had no way to fulfill the task and instead just re-ran price queries while *speculating* about the F&G reading ("aligning with a likely 'Neutral' or slightly 'Fearful' reading").

**Fix:**
- Maintain a capability registry mapping `tool_name → agent_type` and validate at planning time that the assigned agent has the required tool.
- Reject/replan any subtask whose description contains keywords matching tools the assigned agent doesn't own.
- Add a static prompt section to the planner: "fear_and_greed_index → news_sentiment", "price/RSI/MACD → market_monitor", "whale/exchange flow → onchain_analysis".

---

## 3. P1 — Reliability & Failure Handling

### 3.1 API failures are not surfaced honestly

**Evidence:**
- Run 1: Blockchair returned HTTP 430, CoinGecko returned 429.
- Run 2: Three of three on-chain tools failed (`fetch_exchange_data`, `fetch_coin_metrics`, `fetch_large_transactions`).
- In both runs, the agent produced an `exchangeNetFlow: { direction: "neutral" }` result anyway, which the synthesis then cited as evidence of "no significant inflows or outflows."

This is the worst class of failure: **fabricated neutrality**. A missing reading is being treated as a "no signal" reading.

**Fix:**
- Distinguish in the agent's output schema: `status: "ok" | "missing" | "error"` per data field.
- Synthesis prompt must be updated: "If a field's status is `missing` or `error`, do NOT cite it as evidence and do NOT count it toward signal alignment for confidence scoring."
- Lower the confidence ceiling proportionally to missing fields (see §3.4).

### 3.2 Retry & rate-limit strategy

**Evidence:** CoinGecko 429s appeared back-to-back across parallel agents because all three agents query CoinGecko simultaneously.

**Fix:**
- Centralize CoinGecko access through a single shared client with a token-bucket rate limiter (CoinGecko free tier: ~10–30 req/min; respect this).
- Cache GET responses for 30–60s keyed by URL — the second run's two market_monitor subtasks made identical calls and could have been served from cache.
- Implement exponential backoff with jitter on 429/5xx (3 retries, 0.5s/1.5s/4s).
- For Blockchair 430 (which is a paywall/auth signal, not transient), fall back to an alternative source (mempool.space, Blockstream API) instead of retrying.

### 3.3 Replace failing data sources

**Evidence:** Blockchair returned 430 on every single call across both runs. It is non-functional for this system right now.

**Fix:** Either (a) acquire a Blockchair API key, (b) swap to mempool.space / Blockstream Esplora for BTC large transactions, or (c) remove `fetch_large_transactions` until a working source is wired in. Continuing to call a known-broken endpoint is wasted latency.

### 3.4 Confidence scoring is uncalibrated

**Evidence:** Run 1 confidence = 0.62 (one missing data source). Run 2 confidence = 0.62 (three missing data sources, including all on-chain). The verifier in run 2 explicitly recommended lowering it to ~0.55.

**Fix:**
- Make confidence a deterministic function of data completeness, not an LLM free-text guess.
- Suggested formula:
  ```
  base = 0.5
  + 0.15 * (signals_aligned / total_signals)
  + 0.10 * (data_completeness_pct)
  + 0.10 * (sentiment_confidence)
  - 0.05 * (count of missing data sources)
  ```
- Cap confidence at 0.50 if any of the three data domains (market/sentiment/on-chain) has zero successful fetches.

---

## 4. P1 — Planning & Scope

### 4.1 Query intent classification is missing

**Evidence:** "What is the current value of BTC" triggered 4 subtasks, 11 tool calls, 134 seconds, and produced a full trading strategy with entry/exit/stop-loss the user did not ask for.

**Fix:**
- Add a lightweight classifier (or a single LLM call before planning) to bucket queries:
  - **`price_lookup`** → 1 tool call, single `fetch_coin_price`, ~3s response
  - **`sentiment_check`** → news + F&G only, skip on-chain and strategy
  - **`technical_analysis`** → market_monitor only
  - **`full_analysis`** → current 4-agent flow
  - **`strategy_request`** → current flow + strategy_generator
- The `strategy_generator` should run **only** for the last two buckets. Right now it runs unconditionally.

### 4.2 Planner produces redundant subtasks

**Evidence** (run 2): Subtasks `Fetch Fear and Greed Index` and `Analyze BTC Price Trends` were both assigned to `market_monitor`. They each made identical `fetch_coin_price` and `fetch_price_history` calls and produced near-identical JSON outputs. This wasted 4 tool calls and roughly 60 seconds.

**Fix:**
- Add a deduplication pass after planning: if two subtasks have the same `agentType` and >70% description overlap (or would call the same tools), merge them.
- Or constrain the planner prompt to "produce at most one subtask per agentType unless the agentType genuinely requires multiple distinct queries."

### 4.3 Strategy generator is doing redundant fetching

**Evidence** (run 2): The strategy_generator made 5 additional tool calls (`fetch_fear_greed_index`, `fetch_crypto_news`, `fetch_coin_metrics`, `fetch_large_transactions`, `fetch_exchange_data`) on top of what the upstream agents already collected. This duplicated work the news_sentiment and onchain_analysis agents had already done seconds earlier.

**Fix:**
- The strategy_generator's prompt currently says "If you need additional data to make a better strategy, use your tools." Tighten this: "Only call tools to fill GAPS marked as missing or errored in the upstream data. Do not refetch successfully retrieved data."
- Pass upstream data freshness timestamps to the strategy_generator so it can decide whether refetch is needed.

---

## 5. P1 — Latency

### 5.1 Individual LLM calls are very slow

**Evidence:**
- `news_sentiment_loop` synthesis call: **60.9 seconds** (run 1), **65.0 seconds** (run 2)
- `onchain_analysis_loop` synthesis call: **63.3 seconds** (run 1), **64.7 seconds** (run 2)
- These are gpt-4.1 calls on Azure with ~2.5K prompt tokens and ~250 completion tokens — should be 5–10 seconds, not 60+.

**Investigation needed:**
- Check Azure deployment region, TPM/RPM limits, and whether the deployment is being throttled.
- Check whether these calls are hitting a queue (Azure OpenAI sometimes silently queues during quota pressure).
- Consider switching the synthesis-loop calls to gpt-4o-mini or gpt-4.1-mini for the agent loops; reserve gpt-4.1 for the final coordinator synthesis.

### 5.2 Total latency budget by query type

Set explicit SLOs:

| Query type | Target latency | Current |
|---|---|---|
| `price_lookup` | < 5s | 134s |
| `sentiment_check` | < 20s | 150s |
| `full_analysis` | < 45s | 134–150s |

Bucket 1 alone (price lookup) would resolve the vast majority of "current value" queries with a 25× speedup.

### 5.3 Parallelize where currently sequential

The verification step runs after synthesis serially. For non-blocking verification, fire it in parallel with response streaming and only block on it if it returns `isValid: false` with high-severity issues. Saves ~7–40s.

---

## 6. P2 — Synthesis Quality

### 6.1 Synthesis cites broken data confidently

The run 1 synthesis treated the broken MACD histogram (`-77949.44`) as bearish evidence. The synthesis prompt should include a sanity-check pass: "Before citing any indicator, verify it is within plausible bounds. Reject and flag implausible values."

### 6.2 Synthesis output gets truncated

**Evidence:** Both run 1 and run 2 final synthesis outputs end mid-sentence ("...especially" / "exchang"). This suggests `max_tokens` is set too low for the synthesis call (or the prompt asked for 500–800 words and the model is hitting the cap).

**Fix:** Either raise `max_tokens` for the coordinator synthesis call, or shorten the requested output (300–500 words is sufficient and reduces cost).

### 6.3 Output format doesn't match query

For a price query, the user wants a number first, context second. Current format is "Comprehensive Synthesis" with five numbered sections — overkill. Tie response template to the intent classifier from §4.1.

---

## 7. P2 — Observability

### 7.1 Add structured failure metrics

The trace logs are excellent for debugging individual runs, but there's no aggregate view. Add:

- Tool success rate by `toolName` and `source` (would have flagged Blockchair at 0% immediately).
- LLM call latency p50/p95/p99 by `purpose`.
- Subtask duration by `agentType`.
- Confidence-score distribution vs. data-completeness percentage (to validate calibration).

### 7.2 Log agent reasoning, not just tool calls

The agent loop logs prompt/response but the response is sometimes empty (e.g., when the model is making tool calls only). Add a separate `agent_reasoning` event when the model produces a final JSON block, capturing what data drove the conclusion.

---

## 8. Suggested Backlog (Prioritized)

### Sprint 1 — Correctness (P0)

1. Fix MACD calculation + add unit test
2. Add capability registry + planner validation
3. Inject current date into synthesis prompts
4. Distinguish missing/errored data in agent output schemas
5. Forbid synthesis from citing missing/errored fields

### Sprint 2 — Reliability (P1)

6. Centralize CoinGecko client with rate limiter + 60s cache
7. Replace or remove Blockchair integration
8. Deterministic confidence formula tied to data completeness
9. Exponential backoff on 429/5xx

### Sprint 3 — UX & Latency (P1)

10. Query intent classifier + four response templates
11. Subtask deduplication after planning
12. Strategy_generator: gap-filling only, no refetching
13. Investigate gpt-4.1 latency on Azure; consider mini variants for agent loops
14. Parallel verification

### Sprint 4 — Polish (P2)

15. Sanity-check filters on indicator values before synthesis
16. Adjust max_tokens / response length for synthesis
17. Aggregate observability dashboard (tool success rates, latency percentiles)
18. Agent reasoning event logging

---

## 9. Quick Wins (< 1 day each)

- Hard-code a date in the synthesis system prompt so titles stop saying "June 2024."
- Skip `strategy_generator` when query is a pure factual lookup ("what is the price of X").
- Add `if (toolResult.status === "error") skip in synthesis` guard.
- Cap confidence at 0.5 when any data domain is fully missing.
- Add 30-second response cache keyed by `(symbol, intent)` — the same query twice in a minute should not re-run the pipeline.

---

## 10. Test Cases to Add

| Test | Expected behavior |
|---|---|
| "What is the price of BTC" | Single tool call, < 5s response, no strategy section |
| "Should I buy ETH" | Full pipeline, strategy included, confidence reflects data completeness |
| Inject Blockchair 430 in mock | On-chain section reports `data unavailable`, confidence drops, synthesis does not invent neutrality |
| Inject MACD signal = 50000 in mock | Indicator excluded from synthesis, warning logged |
| Two simultaneous queries for BTC | Second served from cache, < 1s response |
| Query for unsupported symbol | Graceful error, no fabricated data |

---

*End of report.*
