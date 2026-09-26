# Mod Finder 프로젝트 소개

`index.html`은 8장으로 구성한 웹 프레젠테이션입니다. 브라우저에서 직접 열거나, 프로젝트의 Vite 개발 서버를 실행한 상태에서 `/docs/presentation/index.html`로 접근합니다. 별도의 프레젠테이션 패키지나 빌드는 필요하지 않습니다. Manrope와 Noto Sans KR 웹폰트는 Google Fonts에서 불러옵니다.

## 파일을 직접 편집하는 방법

| 파일 | 수정할 내용 |
| --- | --- |
| index.html | 각 페이지의 제목·본문·목차 링크. 페이지마다 주석이 있습니다. |
| presentation.css | 색상·그라데이션·글꼴·배치·인트로 스타일 |
| presentation.js | 페이지 이동·인트로·편집 기능 |
| steve.js | 첫 화면의 스티브 윤곽·시점·걷기 모션 |
| assets/backgrounds/*.webp | 실제 배경 이미지 6개 |

문구는 index.html의 해당 section에서 직접 바꾸고 저장한 뒤 브라우저를 새로고침하세요. 배경은 각 section의 data-background 경로를 수정하면 됩니다. 파일을 공유하거나 옮길 때는 이 폴더 전체를 함께 옮기세요. 이미지 데이터는 HTML이나 JavaScript에 넣지 않습니다.

## 구성과 조작

1. 프로젝트 소개
2. 목차 — 각 항목을 누르면 해당 슬라이드로 이동
3. 검색 출처와 지원 범위
4. 게임 선택 → 검색·비교 → 원본 사이트 이동
5. 기술 스택과 채택 이유 — React, Vite, Tauri, Wrangler, Zod, tsx, Kotlin, Fastify
6. 실제 기술 구조
7. 웹·네이티브와 저장 방식
8. 프로젝트 열기

- 이동: 좌우 화살표, Space, Page Up/Down, 마우스 휠, 좌우 스와이프
- 처음·마지막: Home / End
- 텍스트 편집: E, 종료: Esc. 브라우저 편집은 임시이며, 파일에서 바꾼 문구가 우선되도록 이전 저장값을 자동 복원하지 않습니다.
- 편집본 HTML 다운로드: Ctrl+S / Cmd+S. 받은 `index.html`을 이 폴더에 두어 CSS·JS·이미지 경로를 유지하세요.
- 색상: `presentation.css`의 `:root` 변수, 내용: 각 `.slide` 내부의 `data-edit` 요소

1920×1080 화면 전체를 비례 축소합니다. 모바일 세로 화면에서는 여백이 생기며, 가로 화면에서 읽기 좋습니다. 같은 출처의 iframe은 폭에 맞게 높이를 조절합니다. 다른 출처에 삽입할 때는 호스트에서 16:9 높이를 지정해야 합니다.

## 기술 스택 확인 — 2026-09-26

현재 저장소의 코드와 선언된 주 버전을 확인했습니다. 외부 서비스의 운영 상태나 네이티브 배포 완료 여부를 새로 검증한 것은 아닙니다.

| 영역 | 실제 구성 | 확인 파일 |
| --- | --- | --- |
| UI | React 19, TypeScript 5.9, Vite 7, CSS, Lucide React | `package.json`, `src/App.tsx`, `src/styles.css` |
| 기존 앱 시각 효과 | WebGL 셰이더 기반 유리 굴절 렌더러 | `src/lib/glass-renderer.ts` |
| 운영 웹/API | Cloudflare Workers, 정적 자산, 공유 Fetch API | `wrangler.jsonc`, `worker/index.ts`, `server/api.ts` |
| 로컬 API | Node.js, Fastify 5, CORS, 요청 제한 | `server/app.ts`, `server/main.ts` |
| 데이터 검증 | Zod 4 | `package.json`, `server/adapters.ts` |
| 네이티브 | Tauri 2, Rust, SQL·opener 플러그인 | `src-tauri/Cargo.toml` |
| 개인 저장소 | 웹 localStorage / 네이티브 SQLite | `src/lib/storage.ts` |
| 테스트·배포 도구 | Vitest 4, TypeScript, Wrangler | `package.json` |

Workers는 Fastify 서버를 구동하지 않고 공유 API 로직을 사용합니다. 검색 서버용 DB는 현재 구성에 없습니다. Steam·CurseForge는 서버 API 키가 필요하며, 외부 링크를 검색 결과로 표현하지 않습니다. 확인되지 않은 호환성을 보장하는 문구도 넣지 않았습니다.

## 프레젠테이션 구현

HTML·CSS·JavaScript·이미지를 분리했습니다. GLSL 코드는 `steve.js`에 있습니다. 프로젝트의 마젠타 테마와 동일한 `linear-gradient(135deg, #f564a1, #ff9d6d)`를 사용하며, 첫 진입에는 기존 앱의 MF 로고·페인트 커튼 인트로를 재생합니다. 3.2초 후 첫 장이 나타나며 Esc로 건너뛸 수 있습니다. 첫 장 이외의 직접 링크와 동작 줄이기 설정에서는 인트로를 생략합니다.

게임 스크린샷은 밝기 25%·채도 55%로 낮추고 기존 슬라이드별 어두운 오버레이를 유지합니다. 배경 이미지는 모든 화면에서 정적으로 표시합니다.

첫 화면에서만 WebGL을 사용합니다. 스티브의 점박이 마젠타 윤곽을 약 52도 위에서 사선으로 내려다보며, 어깨·골반을 축으로 팔과 다리가 반대 방향으로 움직입니다. 걷기 주기는 약 3.8초이며 화면 안에서 제자리걸음합니다. 얼굴·채색·받침대는 없습니다.

두 번째부터 여덟 번째 화면은 기존 게임 스크린샷과 본문만 표시합니다. 배경 WebGL 렌더러와 게임별 HUD 코드는 제거했습니다. 첫 화면에서 벗어나면 캐릭터 렌더 루프도 멈추며, 돌아오면 이어집니다. 동작 줄이기 설정에서는 정지 자세를 표시합니다. 화면이 숨겨지면 루프를 멈추고 해상도 상한을 유지합니다.

프로젝트 로고의 경로는 `public/logos/mod-finder.svg`, 인트로는 `src/EntryIntro.tsx`와 `src/entry-intro.css`에서 가져왔습니다. 배경은 저장소의 게임별 `public/backgrounds/<game>/01.webp`를 사용합니다. 공식 이미지 출처와 원본 URL은 `shared/data/backgrounds.json`에 기록되어 있습니다. 게임 이미지의 권리는 각 권리자에게 있습니다. 스티브의 WebGL 윤곽은 프레젠테이션용 연출이며 실제 게임 플레이 화면이 아닙니다.

이 파일은 독립 문서로 제공됩니다. 앱의 `public/` 빌드 경로에는 포함하지 않았습니다. 기존 앱에 배포하려면 정적 파일 경로와 iframe 보안 정책 등 별도 통합 확인이 필요합니다.

## 검증

Playwright CLI로 8장 모두 1280×720에서 확인했습니다. 캡처와 검증 스크립트는 `output/playwright/presentation/`에 있으며 이 디렉터리는 Git에서 제외됩니다. 모바일 390×844, iframe, 키보드·버튼 이동, 편집 전환, 동작 줄이기, WebGL 컨텍스트 손실을 점검했습니다. 상세 기록은 같은 디렉터리의 `VISUAL_QA.md`에 있습니다.

이번 산출물은 프레젠테이션 HTML·CSS·JavaScript·이미지·문서입니다. TypeScript 앱 코드를 수정하지 않아 앱의 typecheck/test/build는 이 작업에서 실행하지 않았습니다.

그라데이션은 강조 제목·섹션 라벨·선·버튼 테두리·프로젝트 로고·인트로 페인트 및 스티브 네온 점에 적용합니다. WebGL 점은 위치에 따라 두 색을 보간합니다.

기술 선택 페이지의 설명은 현재 구현에서 확인되는 역할과 이점을 요약합니다. 별도 의사결정 기록에서 인용한 문구는 아닙니다. Kotlin은 `MainActivity.kt`와 Android Gradle 설정에서 확인한 Tauri Android 실행부이며, tsx는 `package.json`의 서버·검증 스크립트 실행 도구입니다.
