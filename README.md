# Pomofocus

A small desktop Pomodoro app built with Tauri 2, Rust, TypeScript, Vite, HTML, and CSS.

## Disclaimer

This project is completely vibe-coded.

It was built as a fast, practical, good-enough solution for one specific use case. If you are looking for pristine architecture, layered abstractions, or long-term platform strategy, this repo is not trying to impress you.

The goal was simple: make something that fits my workflow quickly and feels right to use. The app has since been cleaned up heavily on the frontend, but the original spirit is still the same.

## What It Does

- Pomodoro, short break, and long break modes
- Custom durations for all timer modes
- Focus mode to hide the remaining time
- Optional micro-breaks with two variants
- Local persistence for timer state, settings, and activity stats
- Simple activity report with focus hours and streaks
- Windows tray support
- Single-instance behavior so reopening the app restores the running window

## Stack

- Tauri 2
- Rust
- TypeScript
- Vite
- Vitest
- HTML
- CSS
- Vanilla DOM

## Structure

```text
src/
  index.html
  styles.css
  main.ts
  app/
  domain/
  infrastructure/
  ui/
  utils/

src-tauri/
  src/lib.rs
  tauri.conf.json
```

## Run Locally

Requirements:

- Node.js
- Rust
- Tauri CLI
- Microsoft WebView2 Runtime on Windows

Install dependencies:

```powershell
npm install
```

Install the Tauri CLI if needed:

```powershell
cargo install tauri-cli --version "^2.0"
```

Start the frontend in development mode:

```powershell
npm run dev
```

Or run the full desktop app:

```powershell
cd src-tauri
cargo tauri dev
```

## Build

Create a frontend production build:

```powershell
npm run build
```

Create the desktop production build:

```powershell
cd src-tauri
cargo tauri build
```

Build artifacts will be available in:

```text
src-tauri/target/release/
```

## Validation

Rust check:

```powershell
cd src-tauri
cargo check
```

TypeScript check:

```powershell
npm run typecheck
```

Test suite:

```powershell
npm test
```

## Local Storage

The app currently stores data locally using these keys:

- `pomofocus-state-v1`
- `pomofocus-analytics-v1`
- `pomofocus-settings-v1`

## Windows Behavior

- Closing the window with `X` sends the app to the tray instead of quitting immediately
- The tray menu lets you reopen or fully exit the app
- Only one instance can run at a time

## License

No license file is currently included in this repository.
