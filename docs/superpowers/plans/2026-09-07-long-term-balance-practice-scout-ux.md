# Long-term balance, practice match variety, facility UX, and scout exclusions

## Scope
1. Diversify incoming practice-match opponents while avoiding immediate repeats.
2. Prevent player abilities from converging to 100 after a small number of seasons by adding high-rating growth resistance tied to potential and growth peak.
3. Keep CPU schools progressing competitively under the Lv.50 facility system without explosive growth.
4. Make facility upgrades non-blocking and keep the upgrade sheet open for rapid sequential upgrades.
5. Add reversible per-cycle scout exclusions in the client UI.

## Tasks
- Add RED tests for practice-offer variety/repeat avoidance.
- Add RED tests for high-ability growth resistance and potential differentiation.
- Add RED tests for CPU facility progression beyond Lv.5 with bounded yearly growth.
- Add RED UI tests for non-blocking facility operation and sequential upgrade interaction.
- Add RED UI tests for scout exclude/restore behavior.
- Implement the smallest domain/UI changes to make each test GREEN.
- Run focused tests, then full verification and build.
- Open PR, wait for CI GREEN, review diff, merge, then verify main CI.
