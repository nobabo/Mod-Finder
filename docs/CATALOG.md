# 게임 목록과 한국어 콘텐츠 관리

## 게임·장르

`shared/data/games.json`에서 게임을 추가합니다. 현재 14개 게임과 8개 장르를 지원하며, 기본 검색 범위는 마인크래프트·전체 장르·전체 출처입니다. 이 범위는 등록된 목록을 의미하며 모든 사이트의 모든 게임을 자동 수집하지 않습니다.

- `id`: 바뀌지 않는 앱 내부 ID. 기존 즐겨찾기·검색 기록과 연결됩니다.
- `name`, `koreanName`, `aliases`: 영문명, 한국어명, 검색용 별칭.
- `genres`: `shared/data/genres.json`의 장르 ID 배열.
- `sources`: 확인된 출처와 해당 게임의 scope. 숫자 ID도 문자열로 작성합니다.
- `image`: 선택 사항인 로컬 이미지 주소. 없으면 이니셜을 표시합니다.

추가한 게임: 발헤임, 테라리아(tModLoader), 프로젝트 좀보이드, 사이버펑크 2077, 발더스 게이트 3, 폴아웃 4, 리스크 오브 레인 2, 시티즈: 스카이라인, 돈 스타브 투게더.

테라리아의 모드 검색은 기본 게임의 월드·리소스팩 창작마당과 구분하여 [tModLoader 창작마당](https://steamcommunity.com/app/1281930/workshop/)에 연결합니다. 출처를 확장할 때는 각 사이트의 실제 게임 범위를 먼저 확인하세요. 매핑 참고: [프로젝트 좀보이드](https://steamcommunity.com/workshop/browse/?appid=108600), [시티즈: 스카이라인](https://steamcommunity.com/app/255710/workshop/), [돈 스타브 투게더](https://steamcommunity.com/app/322330/workshop/), [발헤임](https://thunderstore.io/c/valheim/), [리스크 오브 레인 2](https://thunderstore.io/c/riskofrain2/), [사이버펑크 2077](https://www.nexusmods.com/games/cyberpunk2077/mods), [발더스 게이트 3](https://www.nexusmods.com/games/baldursgate3/mods), [폴아웃 4](https://www.nexusmods.com/games/fallout4/mods).

검색은 게임·출처 조합별로 진행하고 동시에 최대 4개 요청을 처리합니다. 각 조합의 페이지 커서와 실패 상태를 따로 유지합니다. 미연동 사이트는 원본 사이트 안내에만 포함하고 결과 개수에는 넣지 않습니다. 검색 결과의 상세 화면에서 게임을 확인할 수 있습니다.

## 번역

- `shared/locales/ko.json`: 한국어 화면 문구.
- `shared/locales/en.json`: 동일한 키에 대응하는 영어 문구.
- `shared/locales/mods.ko.json`: 출처별 모드 제목·설명의 한국어 번역.
- `shared/locales/tags.ko.json`: 검색 결과 카드에 표시하는 출처 태그의 한국어 번역. 등록되지 않은 태그와 고유 명칭은 원문으로 표시합니다.
- `shared/locales/search.ko.json`: 뜻이 분명한 한글 검색어를 검색 사이트에 보낼 영어 검색어로 치환하는 사전.
- `shared/locales/search.games.ko.json`: 게임별로 다른 영어 검색어를 사용하는 한글 용어 사전. 게임 ID별로 등록합니다.

모드 번역의 키는 `출처:scope:모드ID`입니다. `title`, `summary`, `searchTerm`, `aliases`, `sourceUrl`, `reviewedAt`을 기록합니다. 현재 Sodium 두 출처의 번역을 등록했습니다. 검색은 해당 출처의 모드 `aliases`에 정확히 일치하면 `searchTerm`을 우선 사용합니다. 한 별칭이 서로 다른 검색어를 가리키면 원래 검색어를 유지합니다. 모드 별칭이 없으면 게임별 사전, 공통 사전 순으로 전체 검색어가 정확히 일치할 때만 영어로 바꿉니다. 전체 게임 검색도 각 게임에 맞는 용어로 따로 요청합니다. 예를 들어 `패브릭`은 마인크래프트에서만 `fabric`으로, `동료`는 스카이림에서 `follower`로 검색합니다. 사용자가 입력한 한글과 검색 기록은 그대로 유지합니다. 단어 일부나 임의 문장은 자동 번역하지 않습니다.

JSON은 번역을 표시하는 용도로만 사용합니다. 검색하지 않은 항목을 결과로 만들거나, 원본 통계·호환 정보·저장 데이터를 덮어쓰지 않습니다. 번역이 없는 항목은 원문을 표시합니다. 번역한 모드의 상세 화면에는 원문 보기가 있습니다. JSON 변경 후 앱을 다시 빌드하면 반영됩니다.

## 중복 제거

같은 출처·게임 범위·ID의 항목은 여러 페이지에 있어도 한 번만 표시합니다. 서로 다른 사이트의 모드는 `shared/data/verified-projects.json`에 확인된 동일 프로젝트 매핑이 있을 때 한 카드로 묶습니다. 카드는 묶음의 대표 항목을 표시합니다.

각 매핑에는 `projectId`, `listingKeys`, `evidenceUrl`을 기록하고 원본 주소와 확인 날짜를 함께 남깁니다. 제목이 같은 모드, 포크, 다른 게임의 모드는 자동으로 합치지 않습니다. 현재 Sodium의 [Modrinth](https://modrinth.com/mod/sodium)와 [CurseForge](https://www.curseforge.com/minecraft/mc-mods/sodium) 페이지가 같은 소스 프로젝트를 가리키는 것을 확인해 등록했습니다.
