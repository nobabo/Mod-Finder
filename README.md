# Mod Finder

웹·Windows·Android에서 게임별 모드를 검색하고 원본 사이트로 이동하는 앱입니다. 웹은 Cloudflare Workers에서 화면과 검색 API를 함께 제공합니다. 한국 접속은 한국어, 그 외에는 영어로 표시하며 수동 언어 선택도 지원합니다.

## 지금 사용할 수 있는 기능

- Modrinth 실제 검색, 게임 버전·로더·종류 필터, 출처별 정렬과 더 보기
- 14개 게임·8개 장르의 통합 검색 범위, 출처별 연동 상태와 미연동 출처의 원본 검색 링크
- 게임·장르 필터, 출처별 ID 중복 제거와 확인된 동일 프로젝트 묶기
- 별도 한국어·영어 JSON 및 출처별 모드 번역 JSON, 번역 없는 콘텐츠의 원문 표시
- 설정 안의 언어 선택, 전체 화면에 반영되는 14개 테마
- 즐겨찾기와 최근 검색 저장
- Windows·Android의 SQLite 저장소, 브라우저 미리보기의 localStorage
- Thunderstore 실제 검색·최신순/인기순·더 보기, Steam Workshop·Nexus Mods 실제 검색, CurseForge 서버 어댑터
- 출처별 시간 제한·부분 실패·호출 제한, 외부 API 직접 조회

Nexus는 공개 GraphQL로 모드 이름을 검색하며 개인 API 키나 계정 로그인이 필요하지 않습니다. 모드 파일을 다운로드·설치하지 않습니다.

게임 추가·번역·동일 프로젝트 매핑 방법은 [콘텐츠 관리 안내](docs/CATALOG.md)를 참고하세요. 전체 검색은 등록된 게임·출처를 대상으로 하며, 실제 연동되지 않은 사이트의 링크를 검색 결과로 계산하지 않습니다.

## Cloudflare Workers 웹 실행

Cloudflare 계정 없이도 로컬에서 전체 웹서비스를 검증할 수 있습니다.

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run worker:dev
```

http://localhost:8787 에서 화면과 API를 함께 제공합니다. API 키는 선택 사항이며 미설정 출처는 원본 링크로 표시됩니다. 기존 .dev.vars가 있다면 덮어쓰지 마세요. 실제 배포는 Cloudflare 계정 로그인이 필요합니다. [Workers 배포 안내](docs/WORKERS.md)를 참고하세요.

- `npm run worker:verify`: Workers 빌드·배포 사전 검사·실행 환경 검증
- `npm run worker:deploy`: Workers용 화면을 빌드하고 실제 배포
- Workers 전용 빌드는 기존 .env의 로컬 API 주소를 무시하고 같은 사이트의 API를 사용합니다.
- 언어 변경 시 페이지를 다시 열지만 즐겨찾기와 비교 목록은 그대로 유지합니다.

## 로컬 앱 실행

Windows에서는 루트 폴더의 실행기를 더블클릭하면 됩니다.

- `Start-Web.cmd`: 검색 API와 React/TSX 개발 화면을 준비하고 브라우저를 엽니다.
- `Start-Tauri.cmd`: 검색 API와 개발 화면을 준비하고 Tauri Windows 앱을 실행합니다. 소스 변경이 반영되며 첫 실행은 Rust 컴파일로 시간이 걸릴 수 있습니다.

이미 실행 중인 모드파인더 서버는 재사용합니다. 실행기 창을 유지하고 종료할 때 `Ctrl+C`를 누르세요. 실행기가 직접 시작한 프로세스만 종료하며 기존 서버는 그대로 둡니다. 실행기는 Docker를 사용하지 않습니다. 최초 의존성 설치가 필요하면 아래의 `npm ci`를 먼저 실행하세요. Tauri 실행에는 아래 Windows 개발 도구도 필요합니다.

Node.js 22.12 이상이 필요합니다. 검증 환경은 Node.js 24입니다.

```powershell
npm ci
npm run dev
```

- 화면: http://localhost:1420
- API: http://127.0.0.1:4318
- 기본 상태에서는 API 키나 데이터베이스 없이 Modrinth 검색이 동작합니다.
- 실제 외부 API에 연결되므로 네트워크가 필요합니다. 샘플 결과를 실제 검색으로 표시하지 않습니다.

서버만 시작하려면 `npm start`를 사용합니다. 웹 화면은 개발·검증용 공통 UI입니다.

## 설정

`.env.example`을 `.env`로 복사하고 필요한 값만 지정합니다. **CURSEFORGE_API_KEY와 STEAM_API_KEY에 VITE_ 접두사를 붙이지 마세요.** VITE_ 변수는 앱에 공개됩니다.

| 변수 | 설명 |
| --- | --- |
| `VITE_API_BASE_URL` | 앱 빌드 시 사용할 API 주소. 배포본은 실제 HTTPS 주소 필요 |
| `CURSEFORGE_API_KEY` | 승인된 개발자 검색용 키 |
| `STEAM_API_KEY` | 공개 Workshop 검색용 서버 키 |
| `DISABLED_SOURCES` | 운영 중 중지할 출처. 변경 후 서버 재시작; 앱 재배포 불필요 |
| `UPSTREAM_USER_AGENT` | 운영 시 실제 프로젝트/연락처 URL을 포함한 식별자 권장 |

키가 없거나 출처가 중지되면 원본 사이트 링크가 표시됩니다. Nexus 사용자 키는 서버에서 받지 않습니다.

## 서버와 저장

별도 서버 데이터베이스나 캐시 서비스가 필요하지 않습니다. 검색 API는 요청을 받아 외부 API를 조회합니다. Thunderstore·Nexus는 키 없이 직접 검색합니다.

웹의 즐겨찾기·비교 목록·검색 기록은 localStorage에 저장하며 브라우저 데이터를 삭제하면 함께 삭제됩니다. 네이티브 앱은 기존 기기 SQLite를 사용합니다. 검색 결과 캐시는 사용하지 않습니다.

## Windows 앱

Visual Studio C++ Build Tools, WebView2, Rust가 필요합니다.

```powershell
# 터미널 1
npm run dev:api
# 터미널 2
npm run desktop:dev
```

로컬 테스트용 설치본:

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:4318'
npm run desktop:build
```

설치본은 `src-tauri/target/release/bundle/nsis/`에 생성됩니다. **검색 API 서버는 앱에 내장되어 있지 않습니다.** 로컬 테스트에서는 `npm start`를 함께 실행하고, 공개 배포 전에는 운영 HTTPS API 주소로 다시 빌드해야 합니다.

## Android 앱

Android Studio, JDK 17 이상(검증에서는 Android Studio JBR), Android SDK 36, NDK, Rust Android target이 필요합니다. `ANDROID_HOME`, `JAVA_HOME`, `NDK_HOME`을 현재 환경에 맞게 지정합니다.

```powershell
npm run android:init
npm run android:dev
# arm64 테스트 APK
npx tauri android build --debug --target aarch64 --apk
# 운영 API 주소를 설정한 후 배포용 빌드
npm run android:build
```

PC의 로컬 서버를 Android에서 시험할 때 USB 또는 에뮬레이터 연결 후 `adb reverse tcp:4318 tcp:4318`을 사용합니다. 기본 Android 디버그 APK의 API 주소 `127.0.0.1`은 이 포트 연결을 전제로 합니다. 실제 배포에는 HTTPS API가 필요합니다. `VITE_API_BASE_URL`은 빌드 시 지정하고, 해당 Origin을 서버 CORS에 허용하세요.

## 검증

```powershell
npm run typecheck
npm test
npm run build
# API 서버를 실행한 상태에서 공개 Modrinth 검색 검증
npm run smoke
```

[API 명세](docs/API.md) · [출처별 연동 조건](docs/INTEGRATIONS.md) · [배포 절차](docs/RELEASE.md) · [검증 방법](docs/VERIFICATION.md)
