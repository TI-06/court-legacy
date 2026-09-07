# Scout inventory, grades, and pre-match radar implementation plan

**Goal:** Fix repeat scout-candidate item use, add a guaranteed genius candidate item, carry inventory across academic years, split inventory from the shop UI, and improve pre-match team comparison with A-G grades and a five-axis radar.

## Accepted behavior

- `extra-scout-candidate`: annual purchase/use limit 5 and possession cap 5; each use appends one new candidate.
- New `generational-scout-candidate`: annual purchase/use limit 1 and possession cap 1; each use appends one candidate whose tier is `generational` (天才).
- Unused inventory is usable in later academic years. Purchase/use counters remain per-year.
- Inventory is consumed oldest-first across carried years.
- More screen exposes `ショップ` and `所持品` as peer menu entries. Shop is purchase-only; inventory is use-only.
- Team comparison grades: A 80-100, B 70-79, C 60-69, D 50-59, E 40-49, F 20-39, G 0-19.
- Pre-match radar axes: 攻撃 / ブロック / サーブ / レシーブ / 連携. Overall strength stays numeric.

## Implementation sequence

1. Add failing tests for catalog limits/new item, carry-over rule, repeated candidate append, guaranteed generational tier, More menu split, A-G thresholds, and five-axis radar markup.
2. Update shop catalog/contracts/rules and server scouting generation/use resolution.
3. Add a Supabase migration that supports carried inventory, possession caps, aggregate status, and oldest-first consumption without resetting annual counters.
4. Split shop and inventory presentation from More navigation while reusing the authoritative shop API/mutation flow.
5. Add team-grade helper and five-axis SVG radar to pre-match comparison; keep numeric values internally.
6. Run full CI, fix regressions, review diff, merge only after all required checks are green, then verify main CI.
