# Mod Finder

**한국어** · [English](README.en.md) · [웹에서 사용하기](https://mod-finder.yjh802637.workers.dev)

웹·Windows·Android에서 게임 모드를 검색하고 원본 사이트로 이동하는 앱입니다. 모드 파일을 다운로드하거나 설치하지 않습니다.

## 주요 기능

- 14개 게임·8개 장르, Modrinth·CurseForge·ATLauncher·Thunderstore·Nexus Mods·Steam Workshop 연동
- 게임·장르·버전·로더 필터, 모드팩 우선 표시, 정렬, 추가 결과 조회 — 지원 범위는 출처별로 다릅니다.
- 검색어 없이 검색하면 선택한 범위의 모드를 기본 다운로드순으로 둘러볼 수 있습니다. 정렬·필터 변경과 추가 결과 조회도 지원합니다.
- 등록된 한글 검색어의 영어 치환, 7개 UI 언어, 14개 테마
- 즐겨찾기·최근 검색 저장: 웹은 localStorage, 네이티브 앱은 SQLite

React + TypeScript · Tauri · Cloudflare Workers. 별도 서버 DB나 Docker는 필요하지 않습니다.

## 빠른 시작

Node.js 22.12 이상과 인터넷 연결이 필요합니다.

```sh
npm ci
npm run dev
```

화면: [localhost:1420](http://localhost:1420) · API: `http://127.0.0.1:4318`

Workers 환경에서 로컬 실행하려면 `npm run worker:dev`를 사용하세요. 화면과 API를 [localhost:8787](http://localhost:8787)에서 함께 제공합니다.

## 설정과 빌드

필요한 경우 `.env.example`을 `.env`로 복사합니다. 로컬 API와 Workers 개발에서 같은 파일을 사용하며, 기존 설정은 덮어쓰지 마세요.

- Modrinth·ATLauncher·Thunderstore·Nexus 검색은 키 없이 동작합니다. Steam·CurseForge는 서버 API 키가 필요합니다.
- API 키에 `VITE_` 접두사를 붙이지 마세요. 미연동 출처의 링크는 실제 검색 결과로 계산하지 않습니다.
- 네이티브 배포본은 `VITE_API_BASE_URL`에 운영 HTTPS API를 지정해야 합니다. 검색 서버는 앱에 포함되지 않습니다.

| 작업 | 명령 |
| --- | --- |
| Windows 개발 | `npm run dev:api` + 별도 터미널에서 `npm run desktop:dev` |
| Android 개발 | `npm run android:init`, `npm run android:dev` |
| 네이티브 빌드 | `npm run desktop:build` / `npm run android:build` |
| 웹 배포 | Cloudflare 로그인·계정 설정 후 `npm run worker:deploy` |
| 검증 | `npm run typecheck` · `npm test` · `npm run build` |
| Workers 검증 | `npm run worker:verify` |

Windows 개발에는 Rust·C++ Build Tools·WebView2, Android에는 Android Studio·JDK 17+·SDK 36·NDK가 필요합니다.

## 문서

[Workers 설정](docs/WORKERS.md) · [네이티브 배포](docs/RELEASE.md) · [출처별 연동](docs/INTEGRATIONS.md) · [API](docs/API.md) · [게임·번역 관리](docs/CATALOG.md) · [검증](docs/VERIFICATION.md)

게임 이미지·로고와 모드 정보의 권리는 각 권리자에게 있습니다. 각 플랫폼·게임사의 공식 앱이 아닙니다.
