# Draft Pick Model — Product Decision

**Status:** Approved for planning (resolves Phase 1 open question)  
**Date:** 2026-05-30

## Summary

The draft uses a **round-based sequential turn** model. Each household may select **at most one week per round**, for up to **N rounds**, where **N** is the admin setting `week_selections_per_household` (default: **1**).

## Setting

| Setting | Default | Description |
|---------|---------|-------------|
| `week_selections_per_household` | `1` | Maximum number of weeks a household may claim during the draft phase of one scheduling period |

## How a draft runs

1. Coordinator starts the draft after the scheduling period opening date/time has passed (notes phase may overlap before draft; see requirements doc).
2. **Round 1:** Households act in configured **priority order**, one at a time. Each active household either **picks** an available week or **skips** (voluntary skip).
3. **Rounds 2..N:** Repeat full priority pass if `week_selections_per_household` > 1.
4. After all rounds complete, the coordinator **assigns remaining weeks** manually, then publishes.

## Turn rules (unchanged from Phase 1 review)

- Only **one household** may act at a time (strict sequential).
- Each turn has a **pick window** (duration) with a **warning** before timeout.
- On timeout: **auto-skip**, notify next household; record auto-skip on the turn.
- After **two consecutive auto-skips** (any households, global counter on the draft): **hold** — draft pauses, coordinators notified; no next turn until a coordinator resumes.
- On voluntary **skip**: turn ends; does **not** consume a week slot; household may still pick in later rounds if N > 1.
- Any **household member** may pick/skip on their household’s turn (audit logs `user_id`).

## Change pick before turn advances

While it is still that household’s active turn, members may **change** their week selection or switch from pick to skip (and vice versa) until the turn is submitted and advanced.

After the turn advances, only a **coordinator** may change that household’s assignment (with audit).

## Why not “N picks in one turn”?

A single turn with multiple week selections reduces fairness transparency, complicates timeout behavior, and makes “whose turn is it?” unclear. Round-based passes preserve one decision at a time, scale cleanly when N > 1, and match the original “one opportunity” mental model when N = 1.

## MVP scope

- **MVP ships with default N = 1**; setting exists in admin UI and data model so the group can raise N later without redesign.
