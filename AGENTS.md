# AGENTS.md

## Purpose

This repository contains a small Tauri desktop app for Pomodoro time tracking.

- Frontend: static HTML, CSS, and vanilla JavaScript in `src/`
- Desktop shell and native packaging: Tauri 2 in `src-tauri/`
- App name in config: `Pomofocus`

Agents working in this repo should preserve the existing lightweight structure and avoid introducing unnecessary frameworks or tooling.

## Repo Layout

- `src/index.html`: main UI markup
- `src/main.js`: timer logic, localStorage persistence, analytics, modal behavior
- `src/styles.css`: styling
- `src-tauri/src/main.rs`: native entry point
- `src-tauri/src/lib.rs`: Tauri builder setup
- `src-tauri/tauri.conf.json`: app window and bundle configuration
- `README.md`: template-level project description

## Working Principles

- Keep the frontend dependency-free unless the user explicitly requests otherwise.
- Prefer small edits inside the existing files over structural rewrites.
- Preserve the current plain JavaScript style and naming unless there is a clear reason to refactor.
- Keep text and UI behavior consistent with the existing German-localized app.
- Prefer ASCII in source text when touching files that already use ASCII fallbacks like `ae`, `ue`, `ss`.
- Do not add analytics services, cloud dependencies, or networked features unless explicitly requested.

## Core Priorities

- Performance first.
- Reliability first.
- Keep behavior predictable under load and during failures such as session restarts, reconnects, and partial streams.
- If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

- Long-term maintainability is a core priority.
- Before adding new functionality, check whether shared logic should be extracted into a separate module.
- Treat duplicated logic across multiple files as a code smell and avoid it.
- Do not hesitate to change existing code when that produces a cleaner long-term design.
- Do not take shortcuts by adding narrowly scoped local logic just to solve one problem.

## Frontend Notes

- State is managed in `src/main.js` through plain objects such as `state`, `reportState`, and `uiState`.
- Persistence currently relies on `localStorage` keys:
  - `pomofocus-state-v1`
  - `pomofocus-analytics-v1`
  - `pomofocus-settings-v1`
- Reports, streaks, and timer transitions are computed on the client side.
- Keyboard shortcuts already exist for space and `R`; preserve or extend them carefully.

## Tauri Notes

- The Tauri app is currently minimal and mainly wraps the static frontend.
- `src-tauri/tauri.conf.json` sets `frontendDist` to `../src`, so changes to frontend files directly affect the packaged app.
- Existing Rust code is intentionally small; keep backend additions focused and justified.

## Safe Change Strategy

- For UI changes, inspect both `src/index.html` and `src/main.js` before editing.
- For behavior changes, verify whether persistence, modal state, and report rendering are affected.
- For native changes, check both `src-tauri/src/lib.rs` and `src-tauri/tauri.conf.json`.
- Avoid large-scale renames unless the task specifically asks for cleanup.

## Validation

Use the smallest relevant validation for the change.

- Frontend-only text or style changes: review affected files for selector and ID consistency.
- JavaScript behavior changes: test flows around timer start/pause/reset, mode switching, settings save, and report modal rendering.
- Tauri or packaging changes: run Rust-side checks from `src-tauri/`.

Suggested commands:

```powershell
cargo check
```

If the local environment supports the Tauri CLI, these may also be useful:

```powershell
cargo tauri dev
```

## Agent Output Expectations

- Describe user-visible behavior changes clearly.
- Mention validation performed and any commands that could not be run.
- Call out persistence or migration risks when changing localStorage keys or state shape.
- If a change touches both frontend and Tauri config, explain the coupling briefly.
