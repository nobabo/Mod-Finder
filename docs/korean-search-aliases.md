# 순위 기반 한글 검색어와 단수·복수 검색

2026-10-04 운영 API의 14개 게임 다운로드·구독 순위 상위 30개씩(420개)과 배포된 검색 순위 스냅샷(2026-09-30)을 대조했다. 게임별 검색어 사전 `src/shared/locales/search.games.ko.json`에 한글 별칭 270개를 추가했다. 검색 순위의 이름·횟수·순서를 갱신한 것은 아니다.

- 검색 순위의 `community-mods.json` 한글 이름과 마인크래프트 `community-pack-names.ko.json` 이름은 원래 검색어로 연결한다. 새로 등록한 이름도 같은 경로를 사용한다.
- 다운로드 순위의 출처·scope·ID에 연결된 `mods.ko.json` 제목과 별칭을 우선 사용한다. 추가 발음·줄임말은 게임별 검색어 사전에 둔다. 예: 그뉴호 → GT New Horizons, 대확장 → Stardew Valley Expanded, 컴벳 → Combat Extended, 트래픽 매니저 → Traffic Manager.
- 한글 별칭은 유니코드 조합과 띄어쓰기 차이를 허용한다. 정확한 표기를 우선하며 같은 우선순위에서 여러 대상이 충돌하면 원문을 보존한다. 커뮤니티 언급 집계용 정규식을 검색어 변환에 사용하지 않는다.
- 현재 순위에서 확인한 DawnCraft, Cursed Walking, SevTech, StoneBlock, WackyEpicMMOSystem 등에도 한글 발음 별칭을 추가했다. 이 별칭은 검색 요청을 위한 것이며 출처 간 모드 ID를 연결하거나 제목만으로 결과를 합치지 않는다.

## 단수·복수

운영 CurseForge 모드팩 검색에서 `zombie`와 `zombies`의 결과 개수와 항목이 서로 다른 것을 확인했다. `search-number-variants.ts`의 게임 검색용 명사 쌍은 양쪽을 첫 검색 단계에서 함께 요청한다. 한쪽에서 결과가 나와도 다른 쪽을 생략하지 않는다. 한글을 영문으로 변환한 뒤에도 적용한다.

`zombie/zombies`, `enemy/enemies`, `boss/bosses`, `city/cities`와 `knife/knives`, `wolf/wolves`, `leaf/leaves`, `child/children`, `person/people` 등이 대상이다. 알려진 단일 명사에만 적용하며 영문 모드 전체 이름이나 알 수 없는 단어에서 임의로 `s`를 제거하지 않는다. `Iris`, `Nemesis`, `All the Mods 10`은 그대로 유지한다. 추가 요청은 변환 대상 검색어당 최대 한 개이며 기존 동시 실행 제한을 따른다. 한글 부분 이름·설명에서 찾은 검색 후보와 결합한 뒤 동일 요청을 제거한다.

각 요청은 같은 게임·출처·필터·정렬을 유지한다. 요청 상태와 다음 페이지는 검색어까지 포함한 키로 구분하며, 결과는 기존 출처별 ID로 중복 제거한다. 새 결과나 다운로드 수를 만들어내지 않는다.

### 여러 게임의 운영 API 대조

2026-10-04 21:38 KST에 14개 게임·5개 출처에서 서로 다른 단어 18쌍을 실제 조회했다. 각 표기의 첫 페이지 20개를 비교하고, 합친 결과의 ID 집합이 두 페이지의 합집합과 정확히 같은지 확인했다. 18쌍 모두 통과했다. 아래 수치는 조회 당시 API가 반환한 전체 결과 수이며, 다운로드 수나 모든 페이지를 수집한 결과가 아니다.

| 게임 / 출처 | 단수 / 복수 | 단수 결과 수 | 복수 결과 수 | 첫 페이지 합친 항목 수 |
| --- | --- | ---: | ---: | ---: |
| 마인크래프트 / CurseForge | zombie / zombies | 2,975 | 1,434 | 37 |
| 마인크래프트 / Modrinth | enemy / enemies | 117 | 289 | 40 |
| 마인크래프트 / Modrinth | knife / knives | 73 | 43 | 40 |
| 마인크래프트 / Modrinth | leaf / leaves | 351 | 549 | 40 |
| 마인크래프트 / Modrinth | wolf / wolves | 453 | 148 | 40 |
| 스타듀 밸리 / Nexus | crop / crops | 1,265 | 2,085 | 36 |
| 스카이림 / Nexus | weapon / weapons | 11,209 | 13,299 | 37 |
| 리썰 컴퍼니 / Thunderstore | monster / monsters | 370 | 241 | 28 |
| 림월드 / Steam | child / children | 607 | 682 | 28 |
| 발헤임 / Thunderstore | portal / portals | 170 | 109 | 30 |
| 테라리아 / Steam | recipe / recipes | 1,282 | 1,282 | 29 |
| 프로젝트 좀보이드 / Steam | vehicle / vehicles | 3,996 | 3,995 | 32 |
| 사이버펑크 2077 / Nexus | item / items | 2,372 | 2,805 | 29 |
| 발더스 게이트 3 / Nexus | spell / spells | 3,817 | 3,344 | 38 |
| 폴아웃 4 / Nexus | companion / companions | 3,393 | 2,673 | 34 |
| 리스크 오브 레인 2 / Thunderstore | skill / skills | 129 | 77 | 24 |
| 시티즈: 스카이라인 / Steam | tree / trees | 10,901 | 10,847 | 30 |
| 돈 스타브 투게더 / Steam | chest / chests | 552 | 511 | 35 |

테라리아처럼 전체 개수가 같아도 첫 페이지에 서로 다른 항목이 있었다. 전체 개수만 같다고 두 검색을 생략하지 않는다. 재점검은 `npx tsx tooling/scripts/verify-number-search.ts`로 실행한다. 이 검증도 원본 응답을 저장하지 않고 집계 숫자만 출력한다.

## 다시 점검하기

저장소 루트에서 `npx tsx tooling/scripts/audit-ranking-search.ts`를 실행한다. UI와 같은 출처·페이지·지표 규칙으로 순위를 읽고 다음 내용을 출력한다.

- 게임별 점검 시각, 검색 순위 스냅샷 시각, 확인한 순위 항목 수
- 한글 이름이 영문 검색으로 연결되지 않는 검색 순위 ID
- 번역 사전에 없는 다운로드 순위의 출처별 ID와 원래 제목(새 별칭 검토 후보)
- 실패한 출처: 일부 출처 실패를 완전한 점검으로 취급하지 않고 종료 코드 1을 반환

이 명령은 앱 데이터나 원본 API 응답을 파일·공유 캐시에 저장하지 않는다. Thunderstore 저장 허용 설정도 변경하지 않는다. 자동 정기 수집은 설정하지 않았으며 새 후보의 한글 별칭은 검토 후 추가한다.
