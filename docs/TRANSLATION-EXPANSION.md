# 게임별 설명 번역 확장

2026-10-30 작업은 기존 설명 번역을 보존하고, 지원하는 각 게임에서 일반 모드를 1,000개씩 추가하는 기준으로 진행한다. Minecraft와 Thunderstore의 독립 모드팩 분류, Nexus Collections도 일반 모드와 분리해 각각 1,000개를 목표로 한다. 공급량이 적거나 설명이 비어 있거나 이미 한국어인 경우에는 실제 처리한 수와 사유를 기록한다. Steam Workshop의 컬렉션은 별도 모드팩 분류로 추정하지 않는다.

정확한 게임·출처·분류별 수량과 부족 사유는 개발 검증용 `tooling/data/translation-expansion.manifest.json`에 기록한다. 수량은 출처별 항목 수다. 서로 다른 사이트의 같은 프로젝트를 제목으로 합치거나 서로 다른 모드를 하나로 세지 않는다. 이전 번역에 출처 ID가 없는 경우에는 기존 제목을 신규 후보에서 보수적으로 제외한다. 별도 콘텐츠 유형인 신규 Nexus 컬렉션은 출처 ID를 구분해 같은 제목의 일반 모드와 함께 보존한다. 새 번역에는 모두 출처별 ID를 보존한다.

Steam 추가분은 구독순으로 살피되, 영어 설명으로 판별된 신규 항목을 다음 순위까지 더 수집해 게임마다 1,000개를 선정한다. 일부 비영문 원문에서 반복 번역이 확인되어 적용한 기준이며, 기존 번역은 보존한다. 다른 출처에서 비영문으로 감지된 항목과 원문·고유명사 관련 이상 후보는 원문을 대조해 직접 교정한다. 따라서 정확히 연속된 순위 1,001~2,000위 목록을 의미하지 않는다.

## 준비 도구

- `node tooling/scripts/expand-minecraft-translations.mjs --collect-only --reuse`
- `node tooling/scripts/expand-nexus-translations.mjs --collect-only --reuse`
- `node tooling/scripts/expand-nexus-collections.mjs --collect-only --reuse`
- `node tooling/scripts/expand-steam-translations.mjs --collect-only --resume`
- `node tooling/scripts/expand-thunderstore-translations.mjs --collect-only`

번역 준비 파일과 체크포인트는 Git에서 제외된 `output/translation-expansion/`에 둔다. API 인증키는 기존 서버용 `.env`에서만 읽고 기록하지 않는다. 원본 API 응답 전체나 공유 검색 캐시는 만들지 않는다. Thunderstore의 운영 저장·캐시 허용 설정도 변경하지 않는다. 각 후보 파일은 해당 분류 수집을 마친 뒤 임시 파일에서 원자적으로 교체한다.

번역에는 기존 Google Translate 자동 번역 체크포인트와 로컬 모델을 사용한다. 영어는 헬싱키 대학교 언어기술 연구팀의 [OPUS-MT 영어→한국어 모델](https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-ko)(CC-BY-4.0), 그 밖의 언어는 [M2M100 418M](https://huggingface.co/facebook/m2m100_418M)(MIT)을 사용한다. 모델과 Python 의존성은 앱에 포함하지 않는다. 일부 작은 Nexus 컬렉션은 원문과 대조해 Codex가 번역했고, 출처별 산출물에 번역 경로를 기록한다. 표본 교정은 전체 수작업 검수를 의미하지 않는다. 고유명사나 전문 용어에 자동 번역의 어색함과 오역이 남을 수 있다.

`tooling/lib/local-translation-server.py`는 `127.0.0.1`에만 서버를 연다. 이번 Windows CUDA 환경에서 사용한 준비·실행 명령은 다음과 같다. 기존 전역 Python 패키지는 바꾸지 않고 의존성을 `output/`에 분리한다.

```powershell
python -m pip install --target output/local-translation-python transformers==4.57.3 sentencepiece==0.2.2 sacremoses==0.2.0 ctranslate2==4.8.4 langid==1.1.6
python -m pip install --target output/local-translation-cuda torch==2.11.0+cu128 --index-url https://download.pytorch.org/whl/cu128
python -B tooling/scripts/prepare-local-translation.py
python -B tooling/lib/local-translation-server.py --device cuda --engine ct2 --english-opus --port 8772
```

다른 PowerShell 창에서 `$env:MOD_TRANSLATION_URL='http://127.0.0.1:8772/translate'`를 설정한다. 각 수집 명령에서 `--collect-only`를 빼면 저장한 후보와 체크포인트를 이어서 번역한다. Thunderstore의 번역만 재개할 때는 `--from-candidates`를 사용한다. Google 경로에는 여러 프로세스가 공유하는 요청 속도 제한이 적용된다.

## 반영과 검증

`node tooling/scripts/import-translation-expansion.mjs`는 모든 필수 게임·분류 산출물을 먼저 확인한 뒤 앱의 설명 카탈로그에 추가한다. 같은 원문·출처의 기존 번역을 덮어쓰지 않고, 일반 모드와 모드팩에 같은 출처 ID가 겹치거나 공급량을 확인하지 않은 미완료 분류가 있으면 중단한다. 전체 수량과 분류별 결과를 함께 저장한다. 예전 원문을 `import-mod-summaries.mjs`로 다시 가져와도 이후 추가된 출처별 번역은 보존한다.

Nexus 모드팩은 게임의 검색 필터에서 **컨텐츠 → 모드팩**을 선택해 조회한다. `collectionsV2`의 실제 응답만 표시하며 ID는 `nexus:<게임 범위>:collection-<slug>`로 일반 모드와 구분한다. 한 글자 검색은 정확히 일치하는 결과를, 두 글자 이상은 API의 부분 검색을 요청한다. 게임 버전·로더 정보가 제공되지 않으면 `null`을 유지한다. 원문 설명이 바뀌면 예전 번역을 적용하지 않는다.

타입 검사·단위 테스트·빌드와 Worker 검증을 수행한다. 브라우저 확인은 Playwright CLI에서 `tooling/scripts/verify-translation-expansion.js`를 실행하고 결과 화면은 `output/playwright/`에 저장한다. 이는 목록·설명 표시의 변경이며 모드 파일이나 게임 내부 언어 파일을 수정하지 않는다.
