# Windows 배포·SignPath 검토

2026-11-08 보안 후속 수정: 폰트 도구의 `brotli`와 Cargo의 `tokio` 패치를 적용했다. `glib`의 Linux 의존성 알림은 미해결이며, 근거와 배포 범위는 [배포 전 점검의 후속 기록](PREDEPLOY-AUDIT.md)을 참고한다. 아래 기존 검토는 당시 상태를 기록한 것이다.

0.2.6 follow-up: the user approved publishing the verified fullscreen feature with the reviewed search dictionary updates. This release keeps NSIS and the existing Windows signing state. The 0.2.5 observations below describe the review baseline; they do not imply a SignPath application, MSI migration, or account/security change.

2026-11-03 기준의 준비 검토다. SignPath 신청, 계정·인증서 생성, 라이선스 선택, MSI 전환, 공개 정책 변경은 하지 않았다. 현재 공개 배포는 0.2.5 NSIS EXE이고, 전체화면 변경은 로컬 검증용이다.

## SignPath 조건과 현재 상태

공식 [Foundation 조건](https://signpath.org/terms.html)은 공개 저장소 외에도 아래 사항을 요구한다. 다음 표의 상태는 소스·공개 이력·읽기 전용 API로 확인한 범위다. 서비스 가입이나 승인 결과를 대신하지 않는다.

| 조건 | 상태 | 프로젝트 증거와 필요한 조치 |
| --- | --- | --- |
| 유지·공개 릴리스·기능 설명 | 확인됨 | 공개 `nobabo/Mod-Finder`, 2026-09-25 생성, 최근 소스·CI·0.2.5 EXE 릴리스, README 기능 설명이 있다. 다운로드 화면 자체는 간결한 링크이므로 README/설명 연결을 확인할 필요가 있다. |
| 검증 가능한 프로젝트 평판 | 미확인 | 확인 시 별·포크 각 0개. 공개 사전 릴리스는 존재하지만 실제 사용자·외부 검증 자료는 확인하지 않았다. 공식 최소 별 수·운영 기간은 명시되어 있지 않다. 재단 판단 대상이다. |
| 프로젝트·소스 소유와 유지 책임 | 일부 확인 | 연결 계정과 유일한 저장소 협업자는 관리자 `nobabo`. 모든 기여·외부 코드·자료에 대한 권리와 신청자의 실제 유지 책임은 저장소 권한만으로 증명되지 않는다. |
| 프로젝트 OSS 라이선스·상업적 이중 라이선스 제한 | 필요 조치 | 루트 LICENSE/COPYING, Cargo license 표기가 없고 GitHub licenseInfo=null이다. 소유자가 라이선스를 결정해야 한다. 외부 자료까지 자동으로 재라이선스할 수는 없다. |
| 비공개·비OSS 구성요소 배제 | 미확인 | 아래 의존성·게임 자료 검토가 필요하다. 소스가 공개됐다는 사실만으로 전체 설치 파일이 조건을 충족하지는 않는다. 시스템 라이브러리 예외의 적용도 실제 묶는 구성 기준으로 확인해야 한다. |
| 본인 프로젝트의 바이너리만 서명 | 일부 확인 | 자체 앱 EXE·설치 파일을 빌드한다. 제3자 DLL·WebView2·설치 도구 코드를 앱 인증서로 임의 재서명하면 안 된다. 서명 대상과 포함만 하는 대상을 구분해야 한다. |
| 악성/PUP·보안 우회 도구 배제 | 일부 확인 | 제품 기능은 모드 검색·외부 페이지 열기·로컬 저장이다. 모드 자동 설치나 취약점 공격·보안 우회 기능은 확인되지 않았다. 소스 검사와 통과한 테스트가 전체 공급망의 무해성 보증을 뜻하지는 않는다. |
| 개인정보·네트워크 공개 | 필요 조치 | `/privacy/`는 Android 0.2.1 표기다. 검색 API, Cloudflare, 외부 아이콘 요청과 로컬 관심 기록 설명은 있지만 Windows 배포 범위와 실제 제3자 정책 링크를 다시 대조해야 한다. |
| 요청하지 않은 데이터 전송의 고지·제어 | 미확인/필요 조치 | 검색은 사용자 동작이지만 초기 화면·이미지·추천 요청도 점검해야 한다. 설치 과정에 개인정보 정책 표시나 해당 데이터 전송의 비활성화 선택은 현재 설정에서 확인되지 않는다. 적용되는 전송을 재단과 확인하고 필요한 고지·선택을 준비한다. |
| 시스템 변경 고지·제거 제공 | 일부 확인 | NSIS currentUser 설치와 제거 UI가 있다. WebView2가 없을 때 다운로드·설치·권한 요청이 가능하다. 실제 설치/제거와 고지는 별도 기기에서 확인해야 한다. 이번 작업은 설치나 제거를 하지 않았다. |
| GitHub·SignPath MFA | 미확인 | GitHub `/user`가 MFA 필드를 제공하지 않아 null이었다. 비활성이라는 뜻이 아니다. SignPath 계정은 만들지 않았다. 참여자 전원의 양쪽 MFA를 사람이 확인해야 한다. |
| 작성자·검토자·서명 승인자 | 필요 조치 | 역할 명단·서명 정책이 없다. 한 관리자만 확인된다. 역할 담당자를 명시하고 외부 기여 검토 및 서명 승인 책임을 정해야 한다. 공식 조건에 최소 인원은 명시되지 않는다. 단독 운영의 역할 구성은 재단 확인 대상이다. |
| 외부 기여 검토 | 일부 확인/필요 조치 | `main` branch protection은 없고 ruleset도 비어 있다. 보호 설정 자체를 일률적 가입 필수로 단정할 수는 없지만, 검토를 우회하지 않는 절차가 필요하다. 설정 변경은 하지 않았다. |
| 릴리스별 수동 서명 승인 | 필요 조치 | 현재 `npm run release`는 검증·커밋·Worker 배포·푸시이고 SignPath 승인 단계는 없다. 공개 서명 릴리스의 별도 수동 승인과 기록을 설계해야 한다. |
| Code signing policy 공개 | 필요 조치 | 홈·다운로드·릴리스에서 연결되는 정책, 지원 표기, 역할 명단, 개인정보 정책 연결이 없다. 승인 전에 실제 지원 중인 것처럼 표시하지 않는다. |
| 제품명·버전 제한 | 일부 확인 | 현재 앱과 NSIS의 ProductName=`Mod Finder`, ProductVersion/FileVersion=`0.2.5`를 확인했다. 승인 후 SignPath artifact 제한으로 강제해야 한다. |
| 출처 검증과 서비스 제약 준수 | 필요 조치 | 현재 검사는 GitHub-hosted runner에서 실행하지만 공개 EXE는 로컬 빌드·수동 업로드다. 서명할 실제 설치 파일의 검증 가능한 CI 경로가 필요하다. 우회·로컬 업로드 대체는 적합한 해결이 아니다. |
| 위반 조사 협력·정지/취소 조건 | 미확인 | 담당자가 서비스 조건과 연락·조사 책임을 수락해야 한다. 이번 읽기 전용 검토로 약관에 동의하거나 책임을 대신 수락하지 않았다. |

[GitHub 연동 문서](https://docs.signpath.io/trusted-build-systems/github)는 OSS의 서명 선행 작업을 GitHub-hosted runner에서 실행하고, Actions artifact와 GitHub가 제공하는 출처 정보를 검증하도록 설명한다. 별도 관리자가 필요한지 등의 세부 역할 수용 여부, 프로젝트 평판, 자료의 OSS 적합성은 신청 전 확인 대상이다. SBOM은 실무상 유용하지만 현재 Foundation 조건에서 일률적인 현행 필수 요건으로 단정하지 않는다.

## 의존성과 자료의 권리

- 직접 npm 의존성 13개의 패키지 메타데이터는 MIT, Apache-2.0, ISC, BSD-2-Clause 계열이다. 서버 전용 코드와 실제 Windows 번들에 포함되는 코드는 다르다.
- 잠긴 Cargo 메타데이터를 Windows x64 대상으로 따라간 298개 패키지(빌드 의존성 포함) 중 라이선스가 비어 있는 것은 자체 `mod-finder`였다. 다른 표기에는 MIT/Apache 외 MPL-2.0, Unicode-3.0, Zlib 등이 있다. 이는 메타데이터 조사이며 각 조항·예외·고지의 완전한 준수 인증은 아니다. 세부 목록은 `output/deployment/windows-dependency-license-inventory.json`에 있다.
- 폰트 5종은 OFL 문서가 `src/web/public/fonts/*-OFL.txt`에 있고 원본·해시는 `sources.json`에 있다. native 빌드도 해당 폴더를 복사한다. 모든 다른 구성요소의 고지·저작권 문구가 설치 파일에 충분히 포함되는지는 추가 확인해야 한다.
- **가장 큰 별도 공백은 게임 이미지다.** `backgrounds.json`, `game-theme-backgrounds.json`, `logos.json`은 Minecraft 공식 사이트, Steam CDN, 게임 제작사 자료의 출처를 기록한다. 출처 URL·다운로드 가능 여부는 재배포 허가나 OSI 라이선스의 증거가 아니다. 자료별 이용 허가와 재단의 비OSS 구성요소 조건을 확인하거나, 적합한 자체/OSS 자료로 교체하는 결정을 해야 한다.
- WebView2 시스템 런타임과 재배포 도구는 Microsoft 조건을 따로 확인한다. 원본 제3자 바이너리의 서명을 보존하고 프로젝트 인증서로 덮어 서명하지 않는다.
- 기존 GitHub 알림 `brotli`(폰트 생성 도구, critical)와 `glib`(Cargo.lock, medium)는 남아 있다. 기존 통과한 npm/cargo 검사와 GitHub 알림의 범위는 다르다. 이번 전체화면 변경에서 의존성을 임의 갱신하지 않았다.

## MSI와 현재 NSIS EXE 비교

MSI 확장자로 바꾸는 것만으로 서명이나 SmartScreen 문제가 해결되지는 않는다. 두 형식 모두 신뢰된 Authenticode와 내부 프로그램 서명 계획이 필요하다. 새 서명 파일의 평판 경고도 즉시 없어질 것을 보장할 수 없다. [Microsoft 서명 비교](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [Tauri 서명 안내](https://v2.tauri.app/distribute/sign/windows/).

| 항목 | 현재 NSIS EXE | MSI 후보 |
| --- | --- | --- |
| 일반 사용자 설치 | currentUser, 기존 한국어·아이콘·설치/제거 문구 유지 | 설치 범위·권한·한국어·UI를 WiX 설정으로 따로 검토해야 한다. MSI가 반드시 관리자 전용이라는 뜻은 아니다. |
| 기업 배포·유지보수 | NSIS 스위치·스크립트 기반 | msiexec의 무인 설치·제거·복구·표준 로그와 Windows Installer 관리에 적합하다. |
| 서명 경로 | 내부 앱 EXE 및 필요 생성 바이너리를 먼저 서명하고 NSIS 패키징 후 외부 EXE 서명 | MSI와 내부 앱/CAB의 서명·검증 구성을 설계한다. SignPath는 MSI를 복합 형식으로 지원한다. |
| 서명 실무 | SignPath 문서에는 NSIS 내부를 MSI처럼 다루는 복합 형식이 확인되지 않는다. 사전 내부 서명과 외부 서명을 분리하는 검증이 필요하다. | 복합 MSI 구조를 활용할 수 있지만 서명 대상을 자체 파일로 제한해야 한다. 단순히 외부 MSI 하나만 서명해 끝났다고 가정하지 않는다. |
| 업데이트 | 기존 NSIS 설치/제거 식별 및 동작을 유지 | 안정된 UpgradeCode, ProductCode/버전 규칙, 같은 설치 범위가 필요하다. NSIS 설치가 MSI의 자동 major upgrade로 인식된다고 가정할 수 없다. |
| 앱 데이터 | 현재 사용자 app-config의 `modfinder.db/local_state` | 같은 앱 식별자·저장 경로를 유지할 수 있지만 전환·기존 제거·이중 설치·데이터 보존을 실제 시험해야 한다. |
| 자동 업데이트 | 현재 앱에 자동 업데이터 없음 | MSI 선택만으로 자동 업데이트가 생기지 않는다. |
| 빌드 | 기존 NSIS 타깃·사용자 정의 훅·이미지·출력 탐색이 준비됨 | Tauri의 WiX v3, Windows 빌드 및 VBScript 선택 기능 요건을 확인한다. 현 빌드 스크립트와 다운로드 동기화는 NSIS `.exe` 파일명을 가정한다. |

근거: [Tauri Windows installer](https://v2.tauri.app/distribute/windows-installer/), [SignPath 지원 형식](https://docs.signpath.io/artifact-configuration/reference), [msiexec 옵션](https://learn.microsoft.com/en-us/windows/win32/msi/command-line-options), [MSI major upgrade](https://learn.microsoft.com/en-us/windows/win32/msi/major-upgrades).

현재 목적이 일반 사용자 배포와 서명 신뢰 확보라면 **NSIS를 유지하면서 서명 요건을 먼저 준비**하는 편이 변경 범위가 작다. 기업 관리·표준 복구가 필요하면 MSI를 별도 배포 선택지로 시험할 가치가 있다. 포맷 전환 전에는 NSIS→MSI 및 MSI→다음 MSI, 삭제/재설치, 일반 사용자/관리자, WebView2 유무, 데이터 보존을 검증해야 한다. 이번에는 MSI를 빌드·설치·배포하거나 포맷 설정을 바꾸지 않았다.

## 전체화면 동작

데스크톱 설정 카드와 F11로 전체화면을 전환한다. Esc는 전체화면에서 대화상자·한글 조합·입력 취소 처리를 우선하고, 소비되지 않은 경우 창 모드로 돌아온다. 비어 있지 않은 검색창의 Esc는 기존 입력 지우기를 먼저 수행한다. F11은 설정이나 입력 포커스에서도 사용할 수 있다. Alt+F4 종료를 가로채지 않는다.

Tauri의 native fullscreen을 사용하며 CSS fullscreen이나 주 모니터 좌표를 강제하지 않는다. 잠긴 Tao 0.35.3 Windows 구현은 현재 모니터를 선택하고 WINDOWPLACEMENT를 저장·복원하며 작업 표시줄 전체화면 상태를 갱신한다. 따라서 일반 창 크기·위치·최대화 상태의 복귀를 그 구현에 맡긴다. 다중 모니터·서로 다른 DPI·모니터 연결 해제 상황의 실제 기기 검증은 구현 검토와 구분해 기록한다.

전체화면을 기본 시작 모드로 저장하지 않는다. 창 복귀 카드와 F11을 제공하고 Alt+F4를 유지하므로 다시 실행할 때도 기존 기본 창에서 시작한다. 창 이동·크기 변경·모니터 지정·전역 단축키 권한을 추가하지 않고, 로컬 main 창에 `core:window:allow-set-fullscreen`만 추가했다.

### 검증 상태

`npm run typecheck`, `npm test`(59개 파일·549개 테스트), `npm run build`, `npm run tauri -- build --no-bundle --ci`가 통과했다. 테스트는 키 반복·수정키·IME, 대화상자/입력 우선 처리, 중복 전환, 실제 상태 확인, 실패 후 재시도, 오래된 상태 응답 무시를 포함한다. 로컬 실행 파일은 `output/native/release/mod-finder.exe`이며 운영 HTTPS API를 사용한다. 기존 공개 NSIS와 GitHub/Worker는 바꾸지 않았다.

실제 창 검증도 진행했다. 앞선 요청은 300초 승인 시간 초과였지만, 사용자가 다시 실행 승인을 요청한 뒤 동일 실행 파일이 정상 실행됐다. Computer Use의 실제 화면과 접근성 상태에서 아래 동작을 확인했다.

- 일반 창(외곽 1362×933)에서 F11로 2560×1440 전체화면 진입: 제목 표시줄과 작업 표시줄이 보이지 않았다. Esc로 같은 일반 창 크기와 제목 표시줄이 복원됐다.
- 최대화에서 F11 진입 후 Esc 복귀: Windows의 `복원` 버튼이 다시 표시되어 최대화 상태가 유지됐다.
- 설정 카드 `전체화면`으로 진입했고, 전체화면의 설정에는 `창 모드` 카드가 표시됐다.
- `sodium` 입력 상태에서 F11로 전환해도 검색어가 유지됐다. 첫 Esc는 검색어만 지우고 전체화면을 유지했으며, 빈 검색창에서 다음 Esc는 창 모드로 복귀했다.
- 전체화면에서 설정을 연 뒤 Esc를 누르면 설정만 닫히고 전체화면을 유지했다.
- Ctrl+K로 검색창에 입력한 뒤 Enter 검색이 실행됐고 실제 Sodium 결과가 표시됐다.
- 전체화면에서 Alt+F4로 종료했고 후속 창 목록에서 Mod Finder가 사라진 것을 확인했다.

다중 모니터 간 이동, 서로 다른 DPI, 모니터 연결 해제, 실제 IME 조합 중 키 입력은 이번 GUI 검증에서 실측하지 않았다. 해당 경우는 현재 모니터·WINDOWPLACEMENT 구현 검토와 IME/수정키 자동 테스트의 범위로 구분한다. 공개 배포·버전·다운로드 자산은 바꾸지 않았다.
