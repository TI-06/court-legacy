# Save Stability V5 Implementation Plan

1. Extend JsonStatePatchOperation with shallow merge and client-side application.
2. Add patch coalescing for players, schools, playerRelationships, and playerRelationshipBonds.
3. Use coalesced patches in gameAction persistence.
4. Add PostgreSQL V5 RPC with merge-aware patch application.
5. Route delta saves through V5 and use a 256 KiB budget for normal and mid-match actions.
6. Preserve V3 as oversized emergency fallback.
7. Add focused state-patch, store-routing, SQL-contract, and reconstruction tests.
8. Re-run the 156-week diagnostic and compare full-state fallback counts.
9. Apply the migration to production only after code/CI review, then verify with a test query and production logs.
