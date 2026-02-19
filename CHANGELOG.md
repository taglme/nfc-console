# Changelog

## Unreleased

- (empty)

## v1.0.2 - 2026-02-19

- Fix Linux release build dependencies on GitHub Actions (ubuntu-latest)

## v1.0.1 - 2026-02-19

- Fix GitHub Release workflow (install frontend deps before running tests)

## v1.0.0 - 2026-02-19

- Wails + Vue 3/Vite/TypeScript + Naive UI + Pinia app scaffold
- Pages parity: Console / Read / Write / Dump / Other
- All API & WS interactions via `nfc-jsclient`
- Embedded `X-App-Key` via `-ldflags` (`main.EmbeddedAppKey`) + Wails binding
- License access enforcement (clamp/block) + create-job rate-limit UX
- i18n (en/ru)
- Console snippets (tag/adapter) + load/save commands
- CI (build + tests) and Release workflow (build artifacts on tags)
