# Weekly Training Design

## Scope

Implement the M1 weekly training domain loop defined in the approved Court Legacy MVP plan. One weekly plan contains one team training menu and exactly two individual assignments for distinct players in the user school.

## Domain flow

1. Validate all referenced menu, instruction, school, and player IDs before applying changes.
2. Resolve team training for every available player in the selected school.
3. Resolve two individual instructions after team training.
4. Apply integer ability growth, fatigue, condition, trust, academic restrictions, and deterministic injury checks.
5. Return a new immutable game state and an explainable result containing per-player growth and modifier logs.

## Growth factors

Growth uses the selected menu's base growth and is modified by grade growth, growth type, personality stability, training-room level, coach development, current fatigue, condition, and academic status. Every applied ability remains an integer from 0 to 100.

## Safety rules

- Injured players do not receive ordinary training growth.
- Players with academic ability below the restriction threshold receive reduced participation.
- Recovery instructions may reduce fatigue and improve condition but never reduce abilities.
- Injury risk is clamped and resolved through the injected seeded random source.
- Invalid plans do not partially update state.

## Testing

Unit tests cover target abilities, caps, fatigue and recovery, all growth modifiers, academic restrictions, injury outcomes, plan validation, immutability, and reproducibility from the same random seed.
