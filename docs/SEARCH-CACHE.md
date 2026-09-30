# 사용자 기기의 검색 캐시

웹과 Tauri Windows 공통 클라이언트는 같은 검색의 응답을 사용자 기기의 IndexedDB에 저장합니다. 새로고침하거나 다시 실행해도 유효한 결과를 재사용합니다. 서버·다른 사용자와 공유하지 않으며, Android Kotlin 클라이언트에는 이 캐시가 적용되지 않습니다.

- 게임·출처·원래 검색어·필터·정렬·페이지 커서·API 주소·언어가 모두 같은 요청만 재사용합니다. 제목이 같은 모드를 자동 병합하지 않습니다.
- 결과가 있는 페이지는 저장 시점부터 30분, 빈 결과는 5분 동안 유효합니다. 조회해도 만료 시점을 연장하지 않습니다. 원래 조회 시간과 ID·커서·출처·알 수 없는 통계 및 호환 정보의 null을 그대로 보존합니다.
- 최대 100페이지, 검색 키와 응답의 UTF-8 크기 기준 약 8 MiB를 보관합니다. 새 응답을 저장할 때 만료·손상·제한 초과 페이지를 정리하며, 오래된 페이지부터 제거합니다.
- 한 페이지의 완전한 응답 저장과 이전 페이지 정리는 같은 IndexedDB 트랜잭션에서 처리합니다. 오류·연결 실패·인증 필요·요청 제한·출처 비활성·외부 링크 응답은 캐싱하지 않습니다. 다른 게임이나 출처의 항목이 섞인 응답도 저장하지 않습니다.
- 동시에 진행 중인 동일 요청은 하나로 합칩니다. 호출 하나를 취소해도 다른 호출은 계속되며, 모두 취소하면 네트워크 요청도 취소합니다.
- 저장소를 사용할 수 없거나 용량이 부족해도 검색 결과를 표시하고 실행 중 메모리 캐시를 사용합니다. 저장소를 여는 데 500ms, 트랜잭션에는 1초의 상한을 둡니다.

CurseForge API 응답은 메모리 캐시나 디스크 캐시에 보관하지 않습니다. Thunderstore도 기본적으로 자동 캐싱하지 않으며, 별도 정책 검토 후 빌드 환경에서 `VITE_ALLOW_THUNDERSTORE_PERSISTENCE=true`를 명시한 경우에만 허용합니다. 기본값은 false이고 공용 캐시는 추가하지 않습니다. 즐겨찾기·폴더·비교·설정 저장과는 별도의 DB를 사용합니다.

캐시는 브라우저 프로필과 사이트 주소별로 분리됩니다. 브라우저의 해당 사이트 데이터 삭제 기능으로 제거할 수 있습니다. 시크릿 모드나 브라우저의 저장 공간 정리에 따라 사라질 수 있습니다. 캐시 적중 시 클라이언트의 `SearchResult.cached`는 true이며 서버 응답과 `Cache-Control: no-store`는 기존대로 유지합니다. 서버에서 출처를 비활성화한 경우 이미 저장된 결과는 최대 30분 동안 표시될 수 있습니다.

## 검증

`tooling/tests/search-cache.test.ts`에서 만료·키 분리·페이지 스냅샷·출처 정책·손상·용량 제한·저장 실패·동시 요청·취소를 검사합니다. 아래 브라우저 검증은 실제 IndexedDB, 새로고침 후 재사용, 검색 화면, 만료·손상 복구와 저장 차단 시 검색을 확인합니다. 테스트 전용 Playwright CLI 세션에서 실행합니다.

```powershell
npm run dev:ui
npx --package @playwright/cli playwright-cli -s=modfinder-cache-check open http://localhost:1420 --config tooling/config/playwright.json
npx --package @playwright/cli playwright-cli -s=modfinder-cache-check run-code --filename=tooling/scripts/verify-search-cache.js
npx --package @playwright/cli playwright-cli -s=modfinder-cache-check close
```
