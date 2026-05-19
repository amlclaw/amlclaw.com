# TrustIn API Migration to Antares Compat — Design

## Problem

The current `lib/trustin-api.ts` calls the legacy v2 endpoint at `https://api.trustin.info/api/v2/investigate` with a free-tier API key capped at 100 requests/day. Real screening hits 429 (rate-limited) after a few runs.

TrustIn published a new public compat API (`Infinity Antares Compat`, 2026-05-19) at `https://platform.trustin.bond/api/...` that:
- requires **no authentication**
- has a global rate limit of **2000 req/s** (no daily quota)
- exposes a 4-step investigation flow

Reference: `DET-2026-05-19_v1_INFINITY_ANTARES_COMPAT_API.md` (TrustIn docs repo).

## Goal

Migrate `kyaProDetect` to the new API while keeping the rest of the codebase untouched: `extract-risk-paths.ts`, `parse-evidence-flow.ts`, FlowGraph, the screening route handler — none should need changes.

## Strategy: Adapter

`kyaProDetect` becomes a 4-call orchestrator that re-packages the response into the legacy shape `result.details = { code, msg, data: { tags: Tag[], paths: Path[] } }` so downstream code keeps working as-is.

### New call sequence

1. `POST /investigatev2/submit_query_task_v2` → `request_id`
2. Poll `POST /investigatev2/get_query_status` until `token_usdt_stat === "finished"` (or `failed`)
3. `POST /investigatev2/get_opponents` with `direction: 0` (both), paginated until exhausted
4. `POST /investigatev2/get_opponent_paths_with_amount_and_timestamp_range` for the collected `seq`s, batched at 100 per call, with `min_amount: 0.000001` to avoid the "default 1" trap
5. `POST /query/get_tag_items_v2` for the target address itself (the path workflow doesn't return target self-tags)

### Adapter output

```ts
result.details = {
  code: 0,
  msg: "success",
  data: {
    tags: targetTagsV2,        // from step 5
    paths: [                    // re-packaged from step 4
      {
        direction: 1 | -1,      // 1=outflow, -1=inflow (same numeric scheme)
        path: [
          { address, tags, amount },  // ordered so target is at [0] when out, [N] when in
          ...
        ],
      },
      ...
    ],
  },
};
```

### Node ordering rule

The new API returns each path with `query (deep 0) → opponent (deep N)` regardless of direction. The legacy extractor expects:
- `direction = 1` (outflow): target at `path[0]`, opponent at `path[N]` — **no change**
- `direction = -1` (inflow): target at `path[N]`, source at `path[0]` — **reverse the array**

The adapter reverses `path[]` for `direction = -1` so `computeTrueDeep` in `extract-risk-paths.ts` continues to compute correct hop distances.

### Settings changes

- Default `blockchain.trustinBaseUrl` flips to `https://platform.trustin.bond/api`
- `blockchain.trustinApiKey` stays in the schema for backward compat but is **no longer required**. The new API ignores it. UI text in `/settings` is updated to mark it optional / legacy.
- New optional field `blockchain.trustinToken` (default `"USDT"`) — settable to `"USDC"` if the operator wants USDC paths.

## Non-Goals

- No rewrite of `extract-risk-paths.ts` or any downstream consumer.
- No support for the `forward_min` temporal_mode (always `backward_max`).
- No transactional query endpoints (§2.8 - §2.11) — only the investigation workflow.

## Risks

- **Path direction ambiguity** — if real `direction=-1` responses ever arrive with the source at index 0 rather than the target, the reversal logic produces wrong hop distances. Mitigation: log a warning when `path[0].address !== target_address` for `direction=1` (target should always be at index 0 there) so the assumption is auditable in dev runs.
- **Polling timeout** — investigations are 5-30s typically; legacy code used 60s max (30 retries × 2s). Keep the same cap.
- **`get_query_status` failure semantics** — `{token_usdt_stat: "", token_usdc_stat: ""}` means request not found; `"failed"` means actual failure. Treat both as fatal.
- **Empty opponent list** — legitimate result for "clean" addresses. Return an empty `paths: []` so the extractor produces zero findings (current behavior for a clean address).

## Files Touched

| File | Change |
| ---- | ------ |
| `lib/trustin-api.ts` | Replace request flow with 4-call adapter; remove API key from URL; keep export surface (`kyaProDetect`, `KYAResult`, `DetectOptions`) unchanged |
| `lib/settings.ts` | Flip `trustinBaseUrl` default; add `trustinToken` field with `"USDT"` default |
| `app/settings/page.tsx` (settings UI) | Mark API key as legacy/optional; surface the token selector if low cost |
| `tests/unit/trustin-api.test.ts` | Update to cover the new flow (mock `fetch`) |

## Tests

The existing test file uses dependency-injection-friendly patterns. New cases:
1. `kyaProDetect` calls `submit_query_task_v2` with the right shape and uses the returned `request_id` for polling.
2. Polling exits as soon as `token_usdt_stat === "finished"`.
3. `get_opponents` is called with `direction: 0` and pagination is exhausted.
4. `get_opponent_paths_with_amount_and_timestamp_range` is called with `min_amount: 0.000001`.
5. Adapter output: `result.details.data.paths` has the right `direction`, node order reversed for inflow, amounts preserved.
6. Target self-tags fetched via `get_tag_items_v2` and placed at `result.details.data.tags`.
7. `request_id` not found → returns error.
