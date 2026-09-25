# 제목·설명 검색 순서

가져온 결과 전체를 제목과 설명 모두 포함 → 제목 포함 → 설명 포함 → 출처가 반환한 기타 관련 결과 순으로 정렬합니다. 같은 단계에서는 기존 출처 순위와 제목 완전 일치를 활용합니다. 응답 도착 순서와 페이지 번호가 더 높은 우선순위를 덮어쓰지 않습니다. 새 페이지의 더 적합한 결과는 위로 올라올 수 있습니다.

대소문자, Unicode 호환 문자, 연속 공백을 정규화하고 한국어 번역 및 확인된 검색 별칭도 반영합니다. 동일 프로젝트 묶기와 출처별 문자열 ID는 유지합니다. 원본 통계와 미확인 호환성은 바꾸지 않습니다.

Modrinth와 Thunderstore의 실제 검색에서 제목에 없는 키워드가 설명에 포함된 결과를 확인했습니다. Thunderstore 검색은 공식 [목록 검색 구현](https://github.com/thunderstore-io/Thunderstore/blob/master/django/thunderstore/api/cyberstorm/views/package_listing_list.py)을 사용합니다. Modrinth는 [공식 검색 API](https://docs.modrinth.com/api/operations/searchprojects/)의 결과를 사용합니다.

Nexus는 공개 GraphQL 스키마에서 `ModsFilter.description`과 중첩 AND/OR를 확인했습니다. 게임 범위 AND (제목 OR 본문)으로 검색하고, 본문의 일치 여부는 `searchMatch`에 검색어와 함께 보관합니다. 긴 HTML 본문 자체는 클라이언트 결과에 싣지 않습니다. 이 표시값은 같은 검색어에만 순위 계산에 사용합니다. 개인 API 키를 전달하지 않습니다.

전체 사이트의 모든 본문을 별도로 수집하거나 인덱싱하지 않습니다. 검색 후보는 각 출처의 검색 계약·키 설정·페이지 범위에 의존하며, 연결하지 못한 사이트의 링크를 검색 결과로 세지 않습니다.

검증: 제목만/설명만/둘 다 일치, 번역 별칭, 전각 문자, 페이지 추가 후 우선순위, Nexus 본문 전용 결과와 게임 범위 보존. 브라우저 테스트용 가상 결과 캡처는 실제 출처 검색 증거와 구분하여 `description-ranking-fixture.png`, `clean-results-*.png`로 저장합니다.
