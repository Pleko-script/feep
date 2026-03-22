# Pomofocus

A small desktop Pomodoro app built with Tauri 2, Rust, HTML, CSS, and vanilla JavaScript.

## Disclaimer

This project is completely vibe-coded.

It was built as a fast, practical, good-enough solution for one specific use case. If you are looking for pristine architecture, layered abstractions, or long-term platform strategy, this repo is not trying to impress you.

The goal was simple: make something that fits my workflow quickly and feels right to use. Please do not take the architecture too seriously.

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
- HTML
- CSS
- Vanilla JavaScript

## Structure

```text
src/
  index.html
  styles.css
  main.js

src-tauri/
  src/lib.rs
  tauri.conf.json
```

## Run Locally

Requirements:

- Rust
- Tauri CLI
- Microsoft WebView2 Runtime on Windows

Install the Tauri CLI:

```powershell
cargo install tauri-cli --version "^2.0"
```

Start the app in development mode:

```powershell
cd src-tauri
cargo tauri dev
```

## Build

Create a production build:

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

JavaScript syntax check:

```powershell
node --check src/main.js
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
