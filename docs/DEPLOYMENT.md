# 배포 구성

웹은 Cloudflare Workers에서 정적 화면과 검색 API를 함께 제공합니다. Node 서버와 Workers는 `server/api.ts` 및 출처 어댑터를 공유합니다. 별도 데이터베이스·검색 캐시·OCI 서버는 필요하지 않습니다.

Modrinth·Thunderstore·Nexus는 개인 키 없이 조회하며, Steam Workshop·CurseForge는 서버 환경변수의 키를 사용합니다. 출처가 비활성화되었거나 키가 없으면 검색 결과와 구분된 외부 링크 상태를 반환합니다.

배포 명령과 서버 비밀값 설정은 [Workers 안내](WORKERS.md), 재현 가능한 검사는 [검증 방법](VERIFICATION.md)을 참고하세요. 과거 배포 버전과 로컬 테스트 패키지를 현재 소스의 검증 결과로 사용하지 않습니다.

Windows·Android는 별도 패키지이며 운영 HTTPS API를 지정해 다시 빌드해야 합니다. [배포 절차](RELEASE.md)와 [네이티브 의존성 경고](PREDEPLOY-AUDIT.md)를 확인하세요.

## 현재 배포 — 2026-09-26 KST

- 주소: https://mod-finder.yjh802637.workers.dev
- 버전: `1e040d1f-dc5f-41bd-8f31-0f5384273c7a`, 트래픽 100%.
- 검색어 없는 목록 탐색·추가 결과 조회, 한국어 설명 초안 11,126개, 발헤임 이후 9개 게임의 검색창 로고 연결을 반영. 번역 검토 대상 850개는 원문 유지.
- 타입 검사, 118개 테스트, 일반/Workers 빌드, Workers 런타임 검사 통과. 공개 API·페이지 이동·언어·보안 헤더·비공개 경로 검사 통과.
- 브라우저에서 빈 검색, 추가 로딩(120→220개), 9개 게임의 로고 이미지 로드, 한국어 설명·원문 보기를 확인. 운영 API의 Modrinth·ATLauncher·Steam·Nexus·Thunderstore 빈 검색도 확인.
- 기록: `output/deployment/verification.json`, `output/playwright/deployed-empty-search-valheim.png`, `output/playwright/deployed-korean-summary.png`. 네이티브 패키지는 재빌드하지 않음.
