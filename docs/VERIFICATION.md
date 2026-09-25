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
npx --package @playwright/cli playwright-cli -s=mod-finder-check open http://localhost:1420
npx --package @playwright/cli playwright-cli -s=mod-finder-check run-code --filename=scripts/verify-ui.js
npx --package @playwright/cli playwright-cli -s=mod-finder-check close
```

스크립트는 검색 응답을 통제해 결과 정렬·자동 페이지 추가·필터·원본 링크·상세·즐겨찾기 저장·설정·모바일 넘침을 확인합니다. 테스트 전용 브라우저 세션에서 사용하세요. 캡처는 `output/playwright/`에 저장합니다.

## API와 Workers

- `npm run smoke`: 실행 중인 로컬 API를 통한 Modrinth 실제 검색.
- `npm run worker:verify`: Workers 빌드와 배포 사전 검사, 로컬 Workers 실행 환경 검증. 실제 배포하지 않습니다.
- `node scripts/verify-deployment.mjs <HTTPS 주소>`: 배포된 API·보안 헤더·언어·비공개 경로 검사.
- `node scripts/verify-nexus.mjs <HTTPS 주소>`, `node scripts/verify-thunderstore.mjs <HTTPS 주소>`: 출처별 실제 검색 검사.

외부 API 검사는 네트워크와 해당 출처의 서비스 상태에 영향을 받습니다. 브라우저와 단위 테스트는 Windows·Android 설치 및 SQLite 실기기 검증을 대신하지 않습니다. 네이티브 릴리스 점검은 [배포 절차](RELEASE.md)와 [네이티브 의존성 경고](PREDEPLOY-AUDIT.md)를 참고하세요.

## 2026-09-26 정리 후 확인

타입 검사(미사용 코드 검사 포함), 85개 단위 테스트, 프로덕션 빌드가 통과했습니다. Playwright CLI에서 검색 정렬·자동 페이지 추가·필터·원본 링크와 상세·즐겨찾기 지속성·설정 열기·390px 모바일 화면을 확인했고 페이지 오류는 없었습니다. 1440×1000 및 390×844 캡처를 육안 확인했습니다. 이번 정리에서는 원격 배포·실제 외부 API 호출·네이티브 패키지 재빌드를 수행하지 않았습니다.
