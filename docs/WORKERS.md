# Cloudflare Workers 배포

React 화면과 검색 API를 하나의 Worker로 배포합니다. PostgreSQL, Redis, D1, KV, Docker는 필요하지 않습니다. Fastify는 기존 로컬 앱 개발에만 사용하며 Worker에는 포함되지 않습니다.

2026-09-25의 성능·보안·공급망 점검과 네이티브 경고는 [배포 전 점검](PREDEPLOY-AUDIT.md)을 참고하세요.

운영 주소: https://mod-finder.yjh802637.workers.dev — 2026-09-25 배포 및 공개 사이트 검증 완료. [배포 구성](DEPLOYMENT.md)과 [검증 방법](VERIFICATION.md)을 참고하세요.

## 로컬 검증

Node.js 22.12 이상을 사용하세요. 검증 환경은 Node.js 24입니다.

```powershell
npm ci
# .env가 없을 때만 실행
Copy-Item .env.example .env
npm run worker:types
npm run worker:dev
```

`http://localhost:8787`에서 사용합니다. `.env`의 키는 비워 두어도 Modrinth·Thunderstore·Nexus 검색이 됩니다. CurseForge·Steam의 승인된 키가 있다면 `.env`에 설정할 수 있습니다. `.env`는 공유하거나 커밋하지 마세요. 타입 생성은 로컬 변수의 이름과 설정을 읽으므로 재생성할 때 `.env.example`에 있는 두 API 키 이름을 `.env`에 유지하세요.

`npm run worker:verify`는 Workers용 화면 빌드, 배포 dry-run, 실제 Workers 런타임을 사용한 지역·언어·CORS·정적 파일·API 라우팅·요청 제한 검증을 수행합니다. Cloudflare 계정이나 실제 배포 없이 실행됩니다. API 정규화와 외부 응답 처리는 `npm test`로 확인합니다.

## 실제 배포

1. Cloudflare 계정을 만들고 `npm run worker -- login`으로 브라우저에서 로그인합니다.
2. `tooling/config/wrangler.jsonc`의 Worker 이름을 확인합니다. 요청 제한 namespace ID가 같은 계정의 다른 서비스와 겹치지 않게 유지하세요.
3. `npm run worker:deploy`를 실행합니다. 출력되는 HTTPS `workers.dev` 주소에서 사이트를 사용할 수 있습니다. 별도 도메인은 선택 사항입니다.
4. 승인된 API 키가 준비된 경우 아래 명령의 안전한 입력 창에서 등록합니다. 로컬 `.env`는 자동으로 업로드되지 않습니다.

```powershell
npm run worker -- secret put CURSEFORGE_API_KEY
npm run worker -- secret put STEAM_API_KEY
```

키 값을 명령 인수, `VITE_*`, `tooling/config/wrangler.jsonc`, 브라우저 저장소에 넣지 마세요. 키가 없는 출처는 원본 링크를 제공합니다. Thunderstore·Nexus는 키 없이 직접 검색합니다.

Workers 전용 빌드는 기존 `.env`의 `VITE_API_BASE_URL`을 사용하지 않습니다. 화면은 같은 사이트의 `/v1/*`를 호출합니다. 일반 `npm run build`는 기존 앱 빌드용 설정을 유지하므로 Workers 배포에는 반드시 `worker:deploy`를 사용하세요.

## 언어와 기기 저장

- 같은 URL에서 Cloudflare의 접속 국가 정보가 `KR`이면 한국어, 그 외 또는 국가 미확인이면 영어를 제공합니다. 국적·민족을 추정하지 않습니다.
- 사용자가 한국어·English를 직접 고르면 언어 쿠키를 1년간 유지합니다. Automatic/자동 선택으로 되돌리면 쿠키를 삭제합니다. VPN이나 접속망 때문에 국가 정보가 실제 거주지와 다를 수 있습니다.
- HTML의 언어·제목·설명도 요청별로 설정하고 HTML 캐시를 차단합니다. JS·CSS·이미지는 정적 파일로 제공합니다.
- 로컬 Vite나 네이티브 앱처럼 국가 정보를 받지 못하는 환경에서는 브라우저 언어를 초기값으로 사용합니다.
- 날짜·숫자·버튼·필터·상태·도움말을 번역합니다. 모드 제목·제작자·설명 등 출처의 콘텐츠는 원문을 유지합니다.
- 즐겨찾기·비교 목록·기록은 같은 도메인의 localStorage를 공유하므로 언어를 바꿔도 유지됩니다. 도메인을 바꾸면 기존 도메인의 저장 목록이 자동 이전되지는 않습니다.

## 운영 범위

서버 검색 캐시나 사용자 DB는 없습니다. Workers의 요청 제한은 익명 사용자의 IP를 기준으로 한 대략적인 지역별 제한입니다. 공유 IP 사용자는 제한을 함께 받을 수 있고, 외부 제공자의 전체 API 할당량을 보장하는 장치는 아닙니다.

응답 크기·시간 제한과 고정된 출처 URL 검증을 유지합니다. 외부 API가 다른 주소로 리디렉션해도 따라가지 않습니다. `/internal/*`는 공개하지 않습니다. Worker 오류 로그는 검색어·요청 URL·IP·키를 담지 않으며 자동 invocation 로그는 끕니다.

로컬 Workers 런타임 검증에 이어 실제 계정에 배포하고 공개 HTTPS 주소에서 API·브라우저 동작을 확인했습니다. 무료 CPU 한도의 여유와 동시 부하, 승인된 CurseForge·Steam 키를 사용한 검색은 별도 운영 검증이 필요합니다.
