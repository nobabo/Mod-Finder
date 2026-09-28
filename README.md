# Mod Finder

**한국어** · [English](docs/README.en.md) · [웹에서 사용하기](https://mod-finder.yjh802637.workers.dev)

웹·Windows·Android에서 게임 모드를 검색하고 원본 사이트로 이동하는 앱입니다. 모드 파일을 다운로드하거나 설치하지 않습니다.

## 주요 기능

- 14개 게임·8개 장르, Modrinth·CurseForge·Thunderstore·Nexus Mods·Steam Workshop 연동
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

Windows에서는 루트의 실행 파일을 더블클릭해도 됩니다.

| 실행 파일 | 하는 일 |
| --- | --- |
| `Start-Web.bat` | 로컬 웹·API 서버를 실행하고 브라우저 열기 |
| `Build-Windows.bat` | Windows x64용 NSIS `setup.exe` 생성 |
| `Build-Android.bat` | 기존 릴리즈 키로 서명한 Android ARM64 APK 생성 |

설치파일은 `output/releases/v버전/`에 모입니다. 두 생성기는 운영 HTTPS API 주소를 사용합니다. Android 서명 설정은 [배포 안내](docs/RELEASE.md#root-build-launchers)를 참고하세요.

Workers 환경에서 로컬 실행하려면 `npm run worker:dev`를 사용하세요. 화면과 API를 [localhost:8787](http://localhost:8787)에서 함께 제공합니다.

## 설정과 빌드

필요한 경우 `.env.example`을 `.env`로 복사합니다. 로컬 API와 Workers 개발에서 같은 파일을 사용하며, 기존 설정은 덮어쓰지 마세요.

- Modrinth·Thunderstore·Nexus 검색은 키 없이 동작합니다. Steam·CurseForge는 서버 API 키가 필요합니다.
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

## 폴더 구조

```text
src/       웹 화면·API·공통 데이터·Worker·네이티브 앱
tooling/   scripts/ · tests/ · config/ · launchers/
docs/      개발·배포 문서와 발표·제출 자료
output/    웹·네이티브 빌드와 검증 결과 (Git 제외)
```

웹 빌드 결과는 `output/web/`에 생성됩니다. 루트에는 자주 쓰는 실행 파일 3개를 두고, 실행 로직과 기존 개발용 바로가기는 `tooling/`에서 관리합니다. 자세한 경로와 작업 기준은 [구조 안내](docs/STRUCTURE.md)를 참고하세요.

## 문서

### 커밋·워커 배포·GitHub 푸시 한 번에 실행

```sh
npm run release -- "말풍선 툴팁과 리퀴드 글래스 적용"
```

`main`에서 실행하며, **현재 작업 폴더의 변경·추가·삭제 파일 전체**를 커밋합니다. `.gitignore`에 포함된 파일은 제외됩니다. 기존 GitHub 인증과 Wrangler 로그인을 사용합니다.

원격 브랜치 확인 → 타입 검사·테스트·앱 빌드·워커 검증 → 커밋 → 워커 배포 → 운영 API와 두 주소의 최신 JS/CSS 확인 → GitHub 푸시 순서입니다. `mod-finder` 워커를 갱신하며, 이를 연결한 `modfinder.pages.dev`에도 반영됩니다.

검사만 실행하려면 `npm run release:check`를 사용하세요. 원격 정보를 가져오고 로컬 빌드·검증을 실행하지만 커밋·배포·푸시는 하지 않습니다.

중간 단계가 실패하면 즉시 중단합니다. 원격 `main`이 앞서 있거나 검증 중 파일이 바뀌면 진행하지 않습니다. 자동 병합·강제 푸시·롤백은 하지 않습니다. 배포 후 운영 검증이나 푸시가 실패하면 새 버전은 이미 운영 중일 수 있습니다. 원인을 해결한 뒤 같은 명령으로 다시 실행하면 기존 커밋으로 재시도합니다. 강제 종료로 잠금 파일이 남았다면 실행 중인 릴리스가 없는지 확인한 뒤 `git rev-parse --git-path mod-finder-release.lock`으로 표시되는 파일만 제거하세요.

[Workers 설정](docs/WORKERS.md) · [네이티브 배포](docs/RELEASE.md) · [출처별 연동](docs/INTEGRATIONS.md) · [API](docs/API.md) · [게임·번역 관리](docs/CATALOG.md) · [검증](docs/VERIFICATION.md)

게임 이미지·로고와 모드 정보의 권리는 각 권리자에게 있습니다. 각 플랫폼·게임사의 공식 앱이 아닙니다.
