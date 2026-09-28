# 프로젝트 구조

모든 npm 명령은 저장소 루트에서 실행합니다. 루트에는 패키지·TypeScript 설정, 환경변수 파일, README와 프로젝트 작업 지침을 둡니다. `.github/`는 GitHub Actions가 사용하는 위치입니다.

```text
src/
  web/           React 화면·스타일·브라우저 로직
    public/      배경 이미지·로고·정적 응답 헤더
    index.html   웹 진입 문서
  server/        Node API와 출처 어댑터
  shared/        공통 타입·검색 로직·카탈로그·번역
  worker/        Cloudflare Worker와 생성된 런타임 타입
  pages/         Pages 주소를 Worker에 연결하는 진입 코드
  native/        Tauri·Rust 프로젝트와 Android Kotlin 호스트
tooling/
  scripts/       개발 실행·데이터 갱신·검증·릴리스
  tests/         자동 테스트
  config/        Vite·Vitest·Wrangler·실행 설정
  launchers/     Windows 더블클릭 실행 파일
docs/
  presentation/  발표 자료
  제출용/         기존 로컬 제출 자료 (Git 제외)
output/          생성 결과 (Git 제외)
  web/           웹 빌드 결과, 기존 dist의 역할
  native/        Rust 빌드·Windows 설치파일
  worker/        Worker 검증용 번들
  playwright/    브라우저 검증 캡처
```

## 실행과 배포

- `npm run dev`: 웹과 로컬 API를 실행합니다.
- `npm run desktop:dev`, `npm run android:dev`: 이동된 네이티브 프로젝트를 실행합니다.
- `npm run worker:dev`: 루트의 `.env`를 읽고 로컬 Worker를 실행합니다.
- `npm run worker -- <명령>`: 프로젝트의 Wrangler 설정을 선택합니다. 예: `npm run worker -- secret put STEAM_API_KEY`.
- `npm run worker:types`: `src/worker/worker-configuration.d.ts`를 다시 생성합니다.
- `npm run release -- "변경 내용"`: 검사·커밋·Worker 배포·운영 검증·푸시를 수행합니다.

Tauri 실행기는 앱 경로를 `src/native/`, 프런트엔드 작업 경로를 저장소 루트로 지정합니다. 기본 Rust 빌드 결과는 `output/native/`이며, 명시적으로 지정한 `CARGO_TARGET_DIR`는 우선 적용합니다. Android의 Gradle 생성물은 해당 프로젝트의 `build/` 하위에 두고 Git에서 제외합니다.

## 파일을 추가할 때

앱 기능은 `src/`, 작업 도구와 테스트는 `tooling/`, 설명 자료는 `docs/`, 생성물과 임시 검증 파일은 `output/`에 추가합니다. API 키와 서명키는 커밋하지 않습니다. 웹 빌드에는 `src/web/public/`의 파일만 복사되므로 설치파일이나 제출 자료를 이 폴더에 넣지 않습니다.

`main`은 공통 코드와 웹 배포 기준입니다. `codex/tauri`와 `codex/kotlin`은 각각 Tauri와 Android Kotlin 작업을 위한 시작 브랜치입니다. 현재 Android 앱은 Tauri의 Kotlin 호스트를 사용합니다.

설정 방식 참고: [Wrangler 설정](https://developers.cloudflare.com/workers/wrangler/configuration/), [Tauri 프로젝트 경로 지원](https://v2.tauri.app/release/@tauri-apps/cli/v2.0.4/).
