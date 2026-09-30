# 게임별 순위

게임을 선택하면 해당 게임의 검색 순위와 API 다운로드 순위를 표시한다. 검색 순위 항목을 누르면 현재 게임에서 원래 모드 이름으로 검색한다. 마인크래프트는 기존 모드팩 기준을 유지한다.

## 검색 순위

실제 디씨인사이드 모드 관련 말머리에 올라온 최근 글 **제목**에서 식별한 모드명·한국어 별칭의 언급량이다. 본문·댓글·조회수·추천수·앱 내 검색 횟수는 집계하지 않는다. 같은 글에서 같은 모드를 여러 번 언급해도 1회이며, 여러 모드를 언급한 글은 각 모드에 1회씩 반영한다.

게임마다 말머리별 최대 15페이지를 수집한 후 게시글 ID로 중복을 제거하고, 전체 말머리에서 가장 최근 글 최대 750개를 표본으로 삼는다. 글이 적은 갤러리는 실제 마지막 페이지까지만 수집한다. 상위 10개 이내의 확인된 항목만 표시하며, 없는 항목을 채워 넣지 않는다. 같은 갤러리를 사용하는 다른 시리즈 게임으로 명시된 글은 스카이림·폴아웃 4 집계에서 제외한다. 식별할 수 없는 모드명이나 별칭은 집계되지 않으므로 갤러리 전체의 모든 모드를 포괄하는 순위가 아니다.

| 게임 | 갤러리 | 말머리 ID |
| --- | --- | --- |
| 마인크래프트 | [스티브](https://gall.dcinside.com/mgallery/board/lists/?id=steve&search_head=70) | 70 모드 |
| 스타듀 밸리 | [스타듀 밸리](https://gall.dcinside.com/mgallery/board/lists/?id=stardew&search_head=40) | 40 모드/리텍 |
| 스카이림 SE | [엘더스크롤 시리즈](https://gall.dcinside.com/mgallery/board/lists/?id=skyrim&search_head=310) | 310 모드, 270 통팩 |
| 리썰 컴퍼니 | [리썰 컴퍼니](https://gall.dcinside.com/mgallery/board/lists/?id=lethalcompany&search_head=60) | 60 모드 |
| 림월드 | [림월드](https://gall.dcinside.com/mgallery/board/lists/?id=rimworld&search_head=30) | 30 모드소개, 70 모드번역, 190 모드후기, 80 모드제보 |
| 발헤임 | [Valheim](https://gall.dcinside.com/mgallery/board/lists/?id=valheim&search_head=30) | 30 모드 |
| 테라리아 | [테라리아](https://gall.dcinside.com/mgallery/board/lists/?id=terraria&search_head=160) | 160 모드 |
| 프로젝트 좀보이드 | [프로젝트 좀보이드](https://gall.dcinside.com/mgallery/board/lists/?id=pzom&search_head=50) | 50 모드소개 |
| 사이버펑크 2077 | [사이버펑크2077](https://gall.dcinside.com/mgallery/board/lists/?id=cyberpunk2077&search_head=110) | 110 모드 |
| 발더스 게이트 3 | [발더스 게이트 3](https://gall.dcinside.com/mgallery/board/lists/?id=bg3&search_head=120) | 120 모드, 250 모드질문 |
| 폴아웃 4 | [폴아웃](https://gall.dcinside.com/mgallery/board/lists/?id=fallout&search_head=50) | 50 모드소개 |
| 리스크 오브 레인 2 | [리스크 오브 레인 2](https://gall.dcinside.com/mgallery/board/lists/?id=riskofrain2&search_head=110) | 110 모드 |

2026-09-30에 확인한 말머리 구성을 `src/shared/data/community-galleries.json`에 저장했다. 공통 모드 탭이 없는 시티즈: 스카이라인과 돈 스타브 투게더는 사용자의 요청에 따라 검색 순위 탭을 표시하지 않는다. 비타협처럼 특정 모드 전용 말머리를 여러 모드의 검색 순위로 대신 사용하지 않는다.

순위는 날짜와 원본 URL, 글 ID, 실제 언급량을 포함한 배포 스냅샷이다. 실시간 집계나 자동 정기 갱신은 아니다. 갱신하려면 저장소 루트에서 다음을 실행한다.

```text
npm run community:refresh
npm run release -- "Refresh game community rankings"
```

수집·검증이 모든 지원 게임에서 끝나야 전체 스냅샷을 교체한다. 수집이 실패하거나 말머리가 변경되면 기존 데이터는 유지된다. 수집 원본은 `output/research/community-titles.json`, 배포용 데이터는 `src/shared/data/community-rankings.json`에 저장한다. 기존 네이티브 클라이언트 호환을 위한 마인크래프트 파일도 별도로 유지한다. 갤러리·말머리를 변경하면 대응하는 모드 별칭과 테스트를 함께 점검한다.

## 다운로드 순위

선택한 게임에 설정된 검색 API에서 `sort=downloads`, 빈 검색어로 각 출처 최대 3페이지를 가져와 내림차순으로 상위 30개를 표시한다. 순위 탭과 새로고침은 일반 검색 캐시를 거치지 않고 API에 요청한다. 마인크래프트는 모드팩 필터를 적용한다. 한 출처나 다음 페이지가 실패해도 다른 출처와 이미 받은 정상 페이지는 유지한다. 모든 출처가 실패한 경우 재시도를 제공한다. 확인되지 않은 다운로드 수는 0으로 바꾸지 않고 순위에서 제외한다. 다른 게임의 항목이나 출처·ID가 맞지 않는 응답도 제외한다.

웹·Windows의 공용 화면과 Android의 게임별 카탈로그·순위 선택에 같은 데이터를 반영한다. 기존 설치 바이너리는 별도 업데이트 빌드가 필요하다.

Steam 창작마당 게임은 API의 **누적 구독자**로 집계하고 ‘구독 순위’로 표시한다. 림월드도 Steam 순위를 사용하며 Nexus 다운로드 수와 구독자 수를 섞어서 비교하지 않는다. Steam 외의 게임은 API 다운로드 수를 사용한다. 같은 제목의 모드는 합치지 않고, 검증된 프로젝트 연결만 활용한다. Thunderstore 데이터의 저장·공유 캐시 정책은 기존의 명시적 동의 설정을 따른다.
