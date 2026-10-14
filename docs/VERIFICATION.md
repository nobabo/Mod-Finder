# 검증 방법

Node.js 22.12 이상에서 의존성을 설치한 뒤 실행합니다.

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

타입 검사는 미사용 지역 변수와 매개변수도 검사합니다. 단위 테스트는 검색·페이지 병합·출처별 ID·API 검증·저장 데이터·번역·배경 이미지와 카드 움직임을 확인합니다.

## 브라우저

`npm run dev:ui`로 화면을 실행한 뒤 별도 Playwright CLI 세션에서 확인합니다.

```powershell
npx --package @playwright/cli playwright-cli -s=mod-finder-check open http://localhost:1420 --config tooling/config/playwright.json
npx --package @playwright/cli playwright-cli -s=mod-finder-check run-code --filename=tooling/scripts/verify-ui.js
npx --package @playwright/cli playwright-cli -s=mod-finder-check close
```

스크립트는 검색 응답을 통제해 결과 정렬·더 보기·필터·원본 링크·상세·즐겨찾기 저장·설정·모바일 넘침을 확인합니다. `verify-review-fixes.js`는 HTTP·출처 오류 후 같은 페이지 재시도, 비교 선택 상한, 언어 변경 시 입력 유지, 모바일 미분류, 필터만 사용하는 검색과 대기 중 프레임 예약도 검사합니다. 테스트 전용 브라우저 세션에서 사용하세요. 캡처는 `output/playwright/`에 저장합니다.

## API와 Workers

- `npm run smoke`: 실행 중인 로컬 API를 통한 Modrinth 실제 검색.
- `npm run worker:verify`: Workers 빌드와 배포 사전 검사, 로컬 Workers 실행 환경 검증. 실제 배포하지 않습니다.
- `node tooling/scripts/verify-deployment.mjs <HTTPS 주소>`: 배포된 API·보안 헤더·언어·비공개 경로 검사.
- `node tooling/scripts/verify-nexus.mjs <HTTPS 주소>`, `node tooling/scripts/verify-thunderstore.mjs <HTTPS 주소>`: 출처별 실제 검색 검사.

외부 API 검사는 네트워크와 해당 출처의 서비스 상태에 영향을 받습니다. 브라우저와 단위 테스트는 Windows·Android 설치 및 SQLite 실기기 검증을 대신하지 않습니다. 네이티브 릴리스 점검은 [배포 절차](RELEASE.md)와 [네이티브 의존성 경고](PREDEPLOY-AUDIT.md)를 참고하세요.

## 2026-09-26 정리 후 확인

타입 검사(미사용 코드 검사 포함), 85개 단위 테스트, 프로덕션 빌드가 통과했습니다. Playwright CLI에서 검색 정렬·자동 페이지 추가·필터·원본 링크와 상세·즐겨찾기 지속성·설정 열기·390px 모바일 화면을 확인했고 페이지 오류는 없었습니다. 1440×1000 및 390×844 캡처를 육안 확인했습니다. 이번 정리에서는 원격 배포·실제 외부 API 호출·네이티브 패키지 재빌드를 수행하지 않았습니다.

## 2026-10-14 리뷰 후속 수정 확인

타입 검사, 386개 단위 테스트, 프로덕션 웹 빌드와 로컬 Worker 실행 검사가 통과했습니다. 첫 후속 배포에서 운영 검색·다음 페이지·Android용 검색 계획·언어·보안 헤더·비공개 경로와 배포 자산의 일치를 확인했습니다. npm 의존성 감사는 취약점 0건입니다.

Playwright CLI의 기존 화면 검사 8개 흐름과 리뷰 후속 검사 12개 흐름이 통과했고 페이지 오류는 없었습니다. HTTP 503·출처 오류·요청 제한 후 기존 결과와 같은 커서의 재시도, 비교 3개 상한, 언어 변경 시 입력 유지, 모바일 미분류, 필터만 사용하는 검색, 순위 항목의 상세 화면, 로컬 폰트와 한국어 요약의 선택적 로딩을 확인했습니다. 대기 중인 게임 선택 화면의 700ms 구간에서는 예약된 애니메이션 콜백 3개를 관찰했습니다. 이는 통제된 브라우저 검사이며 기기별 GPU 성능 개선율을 측정한 결과는 아닙니다.

Windows 0.1.1 설치파일과 Android 0.2.2 APK를 생성했고, 이전 세션의 Windows 저장소 테스트 및 Android 단위 테스트·정적 검사·릴리스 빌드 통과 기록을 확인했습니다. Android APK는 기존 릴리스 키의 서명과 정렬 검사를 통과했습니다. 두 GitHub 공개 파일을 다시 내려받아 로컬 산출물과 전체 SHA-256이 일치하는지 확인한 뒤 다운로드 메타데이터를 갱신했습니다. Windows 설치파일에는 게시자 서명이 없으며, 이번 버전의 Windows·Android 실제 기기 설치·실행은 검증하지 않았습니다.

GitHub Android 검사는 실행 환경의 사전 설치 여부에 의존하지 않도록 커밋 SHA로 고정한 SDK 준비 단계를 사용합니다.
