# agmux

> **한국어 패치 버전 (비공식 포크)** — [neelsatyavolu/agmux](https://github.com/neelsatyavolu/agmux) v4.3.0에 아래 변경을 더한 버전입니다. 원본과 같은 MIT 라이선스를 따릅니다.
>
> - **한국어 UI**: 사이드바, 홈, 초기 설정, 채팅·터미널, 설정, 태스크, Teams, 사용량, 새로운 기능 창. Mac 언어를 따르고, 설정 → 일반 → 언어에서 바꿀 수 있습니다.
> - **터미널 한글 입력**: 터미널 세션에서 모음·받침이 빠지던 문제를 고쳤습니다. 터미널에서 ⌘⌫를 누르면 줄 처음까지 지웁니다.
> - **크래시 수정**: 긴 한글 프롬프트나 큰 diff 때문에 앱이 꺼지던 문제(원격 제어를 켠 채 실행할 때 포함)를 고쳤습니다.
> - **로컬 모델 다운로드**: llama.cpp 배포 방식이 바뀌어 실패하던 다운로드를 고쳤습니다.
>
> 설치는 `ko-patch` 브랜치를 아래 "Build from source"대로 빌드하면 됩니다. 앱 안에서 업데이트하면 원본 공식 버전이 설치되어 이 패치가 사라집니다.

A macOS app for running AI coding agents side by side: Claude Code, Codex, Cursor, Droid, Kimi, Pi, OpenCode, Grok, Cline, Gemini, Hermes and local MLX models, in terminals or structured chat.

Download: [agmux.dev](https://agmux.dev) · Homebrew: `brew install --cask neel-xanom/agmux/agmux`

## Build from source

Requirements: macOS, Node 24, npm, and a stable Rust toolchain.

```bash
npm ci
(cd sidecar && npm ci && npm run build)
npx tauri dev                    # run the app
npx tauri build --no-bundle      # release build
```

Checks:

```bash
npx tsc --noEmit
npm test
(cd sidecar && npm test)
(cd src-tauri && cargo test -p xanom)
```

Optional AI helpers (terminal autocomplete fallback, Ask via OpenRouter) read `GROQ_API_KEY` / `OPENROUTER_API_KEY` from the environment. Without them, those helpers use a local model or stay off.

## Repository layout

| Path | What |
|------|------|
| `src/` | React UI |
| `src-tauri/` | Rust backend (Tauri 2) |
| `sidecar/` | Node bridges for SDK-based agents and the project-memory MCP server |
| `remote-relay/`, `remote-mobile/` | Phone remote control (relay Worker, PWA, iOS shell) |
| `teams-service/` | Teams analytics service (Cloudflare Worker + D1) |
| `analytics-service/` | Anonymous product analytics service |

Contributor and agent conventions live in [`AGENTS.md`](AGENTS.md).

## License

[MIT](LICENSE)
