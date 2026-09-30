# Galaxy Store 등록 자료

## Android 0.2.1

- 앱 이름: **Mod Finder**
- 패키지: `io.modfinder.app`
- 버전: `0.2.1` / versionCode `2001`
- 지원: Android 10 이상, target SDK 36(Android 16)
- 파일: `output/releases/v0.2.1/ModFinder-0.2.1-Android.apk`
- 개인정보처리방침: <https://modfinder.pages.dev/privacy/>
- 앱 사용: 계정·광고·인앱 결제 없음. 인터넷 연결 필요.
- 개발자 문의: <https://github.com/nobabo/Mod-Finder/issues>

서명키는 기존 설치본과 같은 키를 사용한다. 스토어에는 release APK를 올리고, `.debug` 패키지는 올리지 않는다. 웹사이트의 기존 Android 다운로드 파일은 별도 바이너리 게시 전까지 이전 버전일 수 있다.

## 한국어 소개

### 짧은 소개

게임 모드를 검색하고 즐겨찾기로 모아 보세요.

### 상세 소개

Mod Finder는 여러 모드 사이트의 검색 결과를 게임별로 모아 보여줍니다. 관심 있는 모드를 찾고, 정보를 확인하고, 원본 사이트로 이동할 수 있습니다.

- 마인크래프트, 스타듀 밸리, 스카이림, 림월드 등 14개 게임 검색
- 출처에서 제공하는 게임 버전·로더·카테고리 필터
- 다운로드 또는 구독 순위와, 수집된 커뮤니티 글의 모드 언급 순위
- 즐겨찾기와 폴더, 최근 검색, 모드 정보 비교
- 테마 색상과 언어 선택

검색 결과와 필터는 각 출처의 제공 범위에 따라 달라집니다. 커뮤니티 순위는 수집 시점의 게시글 제목에 나타난 언급량을 기준으로 하며, 일부 게임에서 제공됩니다. 모드 파일을 설치하거나 실행하는 기능은 없습니다. 원하는 모드의 원본 사이트에서 이용 조건과 호환성을 확인해 주세요.

로그인·광고·인앱 결제 없이 사용할 수 있습니다. 즐겨찾기와 최근 검색은 기기에 저장됩니다.

## English listing

### Short description

Find and save mods across your favorite games.

### Description

Mod Finder brings mod search results from multiple sources into one app. Choose a game, find mods, review their information and open the original source website.

- Search across 14 games, including Minecraft, Stardew Valley, Skyrim and RimWorld
- Filter by game version, loader and category where the source supports them
- Explore download or subscription rankings and community mention rankings
- Organize bookmarks in folders, revisit recent searches and compare mod information
- Choose a theme color and display language

Results and filters depend on each source's coverage. Community rankings are snapshots of mod mentions in collected post titles and are available for selected games. Mod Finder does not install or run mod files. Check the original source for requirements, compatibility and terms.

No login, ads or in-app purchases. Bookmarks and recent searches stay on your device. An internet connection is required for online search.

## 검수 담당자 메모

앱 내 로그인은 없습니다. 첫 화면에서 게임 아이콘을 눌러 게임을 선택하고 검색어를 입력합니다. 검색 결과의 제목은 상세 정보를, 아이콘과 ‘원본 사이트에서 보기’는 외부 브라우저를 엽니다. 즐겨찾기는 북마크 아이콘으로 저장하고 하단 즐겨찾기 탭에서 확인합니다. 설정 카드에서 테마·언어와 개인정보처리방침을 확인할 수 있습니다. 유리 굴절 효과는 Android 13 이상에서 제공되며 이전 버전에는 반투명 패널을 표시합니다.

## 이미지와 등록 확인

`output/releases/v0.2.1/galaxy-store/`에 512×512 PNG 아이콘과 실제 앱을 촬영한 스크린샷을 둔다. 테스트용 가짜 검색 결과를 담은 `output/android/device-screens/` 이미지는 스토어에 올리지 않는다. 스토어 스크린샷은 별도 `NativeStoreCapture` 검사로 운영 API에 연결해 촬영한다.

판매자 화면의 실제 등록·제출 가능 상태를 확인한다. 신규 가입 완료 화면만으로 최종 심사 제출이나 판매자 승인이 완료되었다고 판단하지 않는다. 공개 개발자 이메일, 배포 국가와 연령 등급은 판매자 정보와 실제 앱 내용에 맞춰 직접 입력한다. 게임 로고·스크린샷 등 제3자 자산에 관한 증빙을 요청받으면 해당 권리 자료를 제출해야 한다.

### 판매자 승인과 Google 개발자 인증

삼성의 현재 등록 준비 안내는 무료·유료 앱 모두 **Commercial Seller(상업 판매자)** 자격을 요구한다. Galaxy Store 가입·게시 비용이 무료여도 판매자 승인은 별도다. 현재 계정 화면에서 사업자 전환을 요구하면 먼저 그 조건을 해결해야 한다. 문서에 개인 판매자 설명도 함께 남아 있으므로 사업자가 없는 개인의 신규 신청 가능 여부와 D‑U‑N‑S 없는 대체 서류는 Seller Portal 고객지원에 확인한다.

Google **Android Developer Verification(ADV)**은 삼성 판매자 승인과 별도다. 삼성의 2026-07-31 공지는 2026-09-02부터 ADV 미승인 바이너리가 포함된 앱의 신규·업데이트 제출을 전면 차단한다고 안내한다. Google Play 외부에만 배포하는 경우 Android Developer Console에서 신원 확인과 패키지·서명키 등록을 진행한다. 최대 20대 기기를 위한 무료 제한적 배포 계정은 공개 스토어 배포 용도가 아니다.

Google 공식 FAQ에 따르면 Android Developer Console의 전체 배포 계정 등록비는 25달러다. Galaxy Store의 게시 비용과 구분해야 한다. 이미 Play Console 계정이 있다면 Google 안내에 따라 그 계정에서 외부 배포 앱도 관리할 수 있다.

이 APK의 패키지명은 `io.modfinder.app`이며 자체 서명 인증서 SHA-256 지문은 `72f8adb6b398439720dcbe920280246aae2ba435ac03e9a4b3942e0d1b0ac171`이다. 인증서 지문은 공개 정보이고, 개인 서명키 파일·암호를 스토어 소개나 문서에 넣지 않는다.

2026-09-30 확인한 공식 자료:

- [신규 앱 등록](https://developer.samsung.com/galaxy-store/launch.html)
- [상업 판매자 승인 준비](https://developer.samsung.com/galaxy-store/prepare.html)
- [가입·게시 비용 FAQ](https://developer.samsung.com/galaxy-store/faq.html)
- [삼성 ADV 필수 조치 공지](https://seller.samsungapps.com/notice/getNoticeDetail.as?csNoticeID=0000011990&localeLanguage=ko)
- [Google Android 개발자 인증](https://developer.android.com/developer-verification?hl=ko)
- [Google 인증 계정·등록비 FAQ](https://developer.android.com/developer-verification/guides/faq?hl=ko)
- [등록 이미지 규격: 아이콘 512×512, 스크린샷 변 길이 320–3840·최대 비율 2:1](https://seller.samsungapps.com/guidePopup.as?localeLanguage=ko&numcid=0201010000)
- [16KB 페이지 지원 안내](https://seller.samsungapps.com/notice/getNoticeDetail.as?csNoticeID=0000011451)
- [배포 정책](https://developer.samsung.com/galaxy-store/distribution-guide.html)

앱 등록 화면이 최신 요구사항의 기준이다. 이 문서는 계정 승인이나 심사 통과를 확인하는 자료가 아니다.
