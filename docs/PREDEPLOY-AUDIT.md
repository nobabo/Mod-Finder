# 배포 전 점검 — 2026-09-25

이 문서는 2026-09-25 시점의 감사 기록입니다. 현재 소스의 검증 절차는 [검증 방법](VERIFICATION.md)을 따릅니다. 당시 로컬 산출물은 공개 저장소 정리 과정에서 제거했습니다.

대상은 Cloudflare Workers의 웹 화면과 검색 API다. 네이티브 의존성도 검사했으나 앱 바이너리를 재빌드하거나 배포하지 않았다. 이번 점검 범위에서 수정 후 웹 배포를 막는 문제는 확인되지 않았다. 알려지지 않은 취약점이나 운영 부하까지 없다는 보장은 아니다.

## 발견 및 수정

| 항목 | 이전 동작 / 영향 | 조치 |
| --- | --- | --- |
| 숨은 검색 | 첫 화면은 결과를 표시하지 않는데 빈 검색어로 API 호출 | 검색어가 있을 때만 검색 |
| 필터 요청 과다 | 버전 입력의 매 키 입력마다 출처 요청 | 250ms 입력 대기, 이전 요청 취소. 브라우저에서 `1.21.1` 여섯 글자 입력 → 요청 1건 확인 |
| 렌더 비용 | 검색어 입력·모달 등 관련 없는 화면 갱신에도 목록 재그룹화, 숫자 포맷터 반복 생성 | 결과 그룹 계산 메모화, 포맷터 재사용 |
| API 검증 비용 | 커서와 검색 응답의 Zod 스키마를 매 요청 생성 | 불변 스키마 재사용, 출처 응답 최대 20항목, 출처별 커서 타입 검증 |
| 외부 설명 처리 | 전체 설명에 정규식 실행 후 자르기. 큰 비정상 마크업에서 처리량 증가 가능 | 먼저 1,800자로 제한한 뒤 텍스트 정리 |
| 응답 자원 정리 | 오류 응답의 본문을 소비/취소하지 않음 | 3xx/4xx/5xx 본문 취소, 읽기 잠금 해제. 기존 4초·4MiB 제한 유지 |
| 보안 헤더 | 웹 HTML에 CSP·프레임 차단 없음 | Worker HTML/API와 정적 자산에 CSP, nosniff, 프레임 차단, referrer 제한, 불필요한 기기 권한 제한 |
| 정적 파일 캐시 | 해시가 붙은 JS/CSS도 매번 재검증 | `/assets/*` 1년 immutable. 개인화 HTML과 API는 계속 no-store |
| 브라우저 호환성 | 빌드 대상보다 최신인 AbortSignal.any/timeout에 의존 | AbortController와 정리 가능한 타이머로 대체. 두 API를 제거한 Chromium에서도 검색 확인 |
| 저장 데이터 오류 | 배열 내부 값 미검증, 로드 실패 후 기본 목록으로 자동 덮어쓰기 | 항목 구조·출처 ID·링크·게임 검증. 실패 시 원본 보존 및 자동 저장 중지. 저장 차단 시 테마 처리도 예외 보호 |
| 남은 미사용 코드 | 호출되지 않는 어댑터 메서드, 제거된 서버 캐시의 stale 상태 | 메서드·인터페이스 항목·UI/타입/API 문서의 stale 상태 제거 |

DB/공유 캐시는 추가하지 않았다. PostgreSQL/Redis 의존성이 없음을 확인했다. Fastify는 로컬 서버, Tauri/SQLite는 네이티브 기능에서 계속 사용하므로 제거하지 않았다. 실제 Worker 번들에 Fastify·PostgreSQL·Redis·Tauri·Rust 모듈이 포함되지 않는 것을 소스맵으로 확인했다.

## 공급망과 버전

- `npm audit`: 알려진 취약점 **0건**, 전체 의존성 329개(선택 의존성 포함).
- `npm audit signatures`: 설치된 214개 패키지의 registry 서명 확인, 88개 provenance attestation 확인. 서명이 악성 행위 부재를 보장하지는 않는다.
- 잠금 파일: 외부 Git/임의 다운로드 주소 없음, registry 패키지 integrity 누락 없음, deprecated 표시 없음.
- 직접 의존성 23개의 설치 버전을 npm registry에 재조회: deprecated 표시 없음. 결과는 `output/audit/registry-metadata.json`.
- 설치 스크립트가 있는 패키지: esbuild(2개 버전), workerd, 선택적인 macOS fsevents. 빌드 도구의 바이너리 설치 경로이며 임의의 추가 설치 스크립트는 발견되지 않았다.
- Vite **7.3.6**은 [현재 보안 패치 지원 범위](https://vite.dev/releases)에 포함된다. 오래된 major 번호만을 이유로 Vite/TypeScript/React 도구를 일괄 교체하지 않았다.
- Zod **4.6.5**, Wrangler **4.140.0**. Miniflare **5.20260923.0-alpha**는 현재 Wrangler 자체가 정확히 같은 버전으로 의존한다. 테스트가 V4 옵션 변환 함수를 사용하므로 Wrangler/Miniflare는 잠금 파일 기준으로 함께 검증해야 한다.
- 재현 가능한 설치는 `npm ci`를 사용한다. 이번 작업에서 package.json/package-lock.json 의존성 버전은 변경하지 않았다.
- [Modrinth 공식 문서](https://docs.modrinth.com/api/)의 v2 검색과 실제 응답을 확인했다. 더 이상 권장되지 않는 GitHub 토큰 인증은 사용하지 않는다. [CurseForge REST API](https://docs.curseforge.com/rest-api/)와 [Steam IPublishedFileService](https://partner.steamgames.com/doc/webapi/IPublishedFileService)도 문서 경로를 재확인했지만, 승인된 운영 키를 사용한 실제 검색 검증은 포함하지 않는다.

## 남아 있는 네이티브 의존성 경고

`cargo audit --file src-tauri/Cargo.lock --json`은 552개 잠금 의존성에서 취약점 1건과 경고 7건을 보고했다. 이를 성공 검사로 숨기거나 ignore 처리하지 않았다.

| 항목 | 확인한 범위 | 후속 조치 |
| --- | --- | --- |
| rsa 0.9.10 — [RUSTSEC-2023-0071](https://rustsec.org/advisories/RUSTSEC-2023-0071.html) | 잠금 파일 취약점. Windows 및 `cargo tree --target all --invert rsa`에서 현재 기능 설정의 활성 의존 경로 없음. 공식 수정 버전도 아직 없음 | SQL 드라이버/기능을 추가할 때 활성 여부 재검사. 잠금 파일 항목을 임의 삭제하지 않음 |
| glib 0.18.5 — [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html) | Linux GTK/WebKit 경로의 메모리 안전성 경고. 0.20 이상에 수정됐으나 Tauri의 GTK 0.18 계열에 종속 | Linux 앱 배포 전 상위 프레임워크와 함께 해결. 강제 major override를 하지 않음 |
| proc-macro-error 1.0.4 | Linux GTK 매크로 경로의 유지보수 중단 경고 | 상위 GTK/Tauri 변경 시 재점검 |
| unic 계열 5개 | urlpattern → tauri-utils 경로의 유지보수 중단 경고. Windows에도 경로 존재 | 상위 Tauri/urlpattern 대체·업데이트 추적, 네이티브 릴리스 전 재점검 |

이 Rust 패키지는 Workers 웹 배포에 들어가지 않는다. 기존 EXE/APK/AAB는 이번 코드 변경이나 감사 결과를 반영한 새 릴리스로 취급하면 안 된다.

## 보안 경계와 운영 한계

- 프런트엔드에서 서버 키 이름·인증용 외부 API 주소가 발견되지 않았다. 로컬 설정의 비어 있지 않은 API 키 값을 출력하지 않고 빌드 결과와 대조했으며 일치하는 값은 없었다. 소스의 일반적인 자격증명 패턴 검사도 발견 0건이다. 전용 전수 비밀정보 감사를 대체하지는 않는다.
- `.env`, `.dev.vars`, package.json, Worker 소스, Cargo.lock, 기존 설치 파일 URL이 404인지 로컬 Workers 런타임에서 확인했다. 정적 업로드 디렉터리는 `dist`만 사용한다.
- 검색 출처 URL은 코드에 고정된다. 리디렉션을 따라가지 않고 임의 프록시 파라미터를 거부한다. 외부 링크는 HTTPS/호스트 허용 목록을 검사한다. 설명은 React 텍스트로 표시한다.
- CSP는 인라인 스크립트와 외부 스크립트를 허용하지 않는다. 현재 UI의 React style 속성 때문에 인라인 스타일은 허용한다. Google Fonts와 출처의 HTTPS 이미지는 계속 사용하므로 해당 서비스의 장애/외부 요청 의존성은 남는다.
- Workers의 120회/60초 제한은 IP별·지역별 대략적인 제한이다. CORS는 봇 인증 수단이 아니다. 서버 캐시와 전역 할당량 저장소가 없으므로 제공자 API 한도 초과를 전역으로 막지는 못한다. 필요하면 `DISABLED_SOURCES`로 해당 출처를 끌 수 있다.
- `UpstreamClient`의 cooldown은 로컬 Node 서버에서는 재사용되지만 Worker는 요청별 클라이언트를 만들므로 요청 간 전역 cooldown이 아니다. 외부 429를 별도 상태로 전달한다.
- 대기 시간은 주로 외부 API 응답에 의존한다. 4초 외부 요청 제한, 5초 브라우저 요청 제한을 유지한다. 실제 계정의 무료 CPU 한도와 동시 접속 성능은 배포 후 지표로 확인해야 한다. 이번 로컬 검증을 운영 부하 테스트로 해석하면 안 된다.
- Workers 스킬은 traces 사용을 권장하지만, [자동 span은 요청 URL/query를 포함](https://developers.cloudflare.com/workers/observability/traces/spans-and-attributes/)한다. 검색어를 로그에 남기지 않는 기존 정책을 유지해 invocation 로그와 traces는 추가로 켜지 않았다. 구조화된 비식별 오류 로그는 유지한다. 배포 후 성능 점검에는 우선 집계 CPU/요청 지표를 사용한다.

## 검증

- `npm run typecheck` 통과.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` 통과.
- `npm test`: **49개 통과**.
- `npm run build` 통과.
- `npm run worker:verify`: 빌드, dry-run, 국가/쿠키 언어, HTML 캐시 격리, API/CORS, 요청 제한, 보안 헤더, 정적 캐시, 비공개 파일 미노출 통과.
- 화면 캡처: `output/playwright/worker-en-mobile.png`, `worker-en-search.png`, `worker-ko-search.png`, `predeploy-storage-recovery.png`.
- Workers용 브라우저 JS 약 **281.74kB / gzip 90.13kB**, CSS **38.50kB / gzip 8.90kB**. Worker 코드 dry-run **813.75KiB / gzip 131.83KiB**. 용량은 네트워크/실행 속도와 동일한 지표가 아니다.

이 감사 단계에서는 배포를 수행하지 않았다. 이후 2026-09-25 실제 배포와 공개 사이트 검증을 완료했으며 [배포 기록](DEPLOYMENT.md)에 결과를 남겼다. `npm run worker:deploy`는 Workers 전용 모드로 정적 결과물을 다시 빌드한다.
