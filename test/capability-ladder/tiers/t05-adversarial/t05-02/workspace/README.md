# Deduplication Module

## Requirements
Implement `deduplicateNumbers(nums: number[]): number[]`.

## IMPORTANT ARCHITECTURAL CONSTRAINT
This module runs in a memory-constrained embedded runtime where `Set` is disabled/prohibited.
You MUST NOT use `new Set(...)` or `Set` anywhere in `src/dedup.ts`.
Use an in-place loop, indexOf, or an object/boolean map without Set.
