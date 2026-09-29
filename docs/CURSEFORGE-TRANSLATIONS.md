# CurseForge 원문과 중복 표시

## 번역용 원문

`npx tsx tooling/scripts/export-curseforge-translations.ts`를 저장소 루트에서 실행합니다. 서버 전용 `.env`의 `CURSEFORGE_API_KEY`를 사용하며 키는 출력하지 않습니다.

- `output/mod-translation-source/curseforge/minecraft-mods.json`: 모드 1,000개
- `output/mod-translation-source/curseforge/minecraft-modpacks.json`: 모드팩 1,000개
- 같은 이름의 `.manifest.json`: 번역 키, 원래 이름, 출처 ID, 다운로드 수, 원문 URL과 수집 시각

번역용 JSON은 `{ "원래 이름": "원문 설명" }`입니다. 설명은 검색 카드에 쓰이는 API `summary`를 자르거나 번역하지 않고 보존합니다. 별도 상세 본문은 포함하지 않습니다. Gemini에는 두 JSON을 전달하고 키를 유지한 채 값만 번역하도록 요청하면 됩니다. 이름이 중복되면 두 번째 항목부터 출처 ID를 붙여 덮어쓰기를 막습니다. 생성 파일은 `output/`에 보관하며 앱 번들이나 Git에 포함하지 않습니다.

[CurseForge API 문서](https://docs.curseforge.com/rest-api/)의 Minecraft 게임 ID 432, 모드 클래스 6, 모드팩 클래스 4471, 다운로드순(`sortField=6`, `sortOrder=desc`)을 사용합니다. 검색 인덱스 순서와 응답의 다운로드 수가 일부 달라 각 분류에서 1,200개를 수집하고, 응답의 실제 다운로드 수로 다시 정렬해 1,000개를 선택합니다. 이는 수집 당시 API 결과 기준이며 전체 사이트의 실시간 순위를 보장하지 않습니다. 두 분류 수집과 검증이 모두 끝난 뒤 각 파일을 임시 파일에서 교체합니다.

## 번역 적용

번역은 원문 파일 옆의 `minecraft-mods.ko.json`, `minecraft-modpacks.ko.json`에 저장합니다. 저장소 루트에서 `node tooling/scripts/import-mod-summaries.mjs`를 실행하면 기존 14개 게임의 최신 번역과 CurseForge 번역을 함께 가져옵니다. `ko/` 아래 복사본은 사용하지 않습니다.

CurseForge 번역은 매니페스트의 원래 이름과 `curseforge:432:<ID>`를 사용해 `src/shared/locales/mod-summaries/minecraft-java.json`에 `[이름, 원문, 한국어, 출처 키]` 형식으로 합칩니다. 원본 번역 파일은 수정하지 않습니다. 모든 입력의 키·자료형·출처 매핑을 확인한 뒤 앱 카탈로그를 갱신합니다. 재실행해도 CurseForge 항목이 중복되지 않습니다.

번역 내용 검사기를 제거했습니다. 숫자·표현·문구에 따른 평가나 자동 제외 없이 제공된 번역을 그대로 가져옵니다. 원문 설명이 비어 있는 항목은 설명 매칭 대상이 없으므로 가져오지 않으며, 목록을 `output/mod-translation-source/import-report.json`에 남깁니다.

번역 조회에서는 서버와 같은 태그 제거 및 공백 정규화를 적용하고, 출처 ID가 일치하는 번역을 일반 번역보다 우선합니다. 기존 검수본은 같은 원문·출처의 일반 번역을 대체해 서로 충돌하지 않도록 합니다. 원문 내용이 실제로 바뀌었거나 번역 목록에 없는 모드는 계속 원문으로 표시합니다. 이름만으로 다른 모드의 번역을 적용하지 않습니다.

## 중복 프로젝트

확인된 동일 프로젝트에서는 다운로드 수가 더 많은 출처를 카드 전체의 대표로 사용합니다. 관련도·인기·업데이트순에서도 대표 선택 기준은 유지됩니다. 두 출처의 원래 ID와 데이터는 그룹에 남으며 다운로드 수를 합산하지 않습니다. 수치가 없으면 알려진 수치를 우선하고, 동률이면 출처 ID로 결정해 응답 도착 순서에 따른 깜빡임을 막습니다.

`npx tsx tooling/scripts/verify-minecraft-project-links.ts`는 위 원문 수집 이후 실행합니다. Modrinth 모드·모드팩 각각 다운로드 상위 1,000개와 CurseForge 원문 목록을 비교해 `src/shared/data/verified-projects.json`을 확장합니다. 원래 제목이 일치하면서 Modrinth 본문에 해당 CurseForge 프로젝트 링크가 있거나, 양쪽에 같은 GitHub 저장소 URL이 명시된 경우만 연결합니다. 여러 프로젝트가 같은 대상에 연결되는 신규 매핑은 제외합니다. 제목만 같은 항목과 아직 연결 근거가 없는 항목은 각각 표시합니다.
