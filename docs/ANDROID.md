# Kotlin Android 앱

Android 0.2.0부터 화면은 Kotlin과 Jetpack Compose로 구현합니다. Android APK에는 웹 앱, JavaScript 번들, Tauri/Rust 런타임을 넣지 않습니다. 웹과 Windows는 기존 화면을 사용합니다.

## 구성

- `src/android/`: Activity, Compose 화면, AGSL 유리 재질, 검색·저장 코드와 Android 리소스.
- `tooling/android/`: 독립 Gradle 프로젝트와 고정 버전의 Gradle Wrapper.
- `tooling/config/android.json`: Android 버전과 증가하는 versionCode.
- `tooling/scripts/prepare-android.ts`: 공통 게임·카테고리·언어·한글 검색 사전·검수된 번역·게임별 순위표를 Android 에셋으로 준비. 배경·로고·게임 아이콘은 경로와 내용 해시만 기록.
- `tooling/tests/android/`: JVM 회귀 테스트와 기기에서 실행하는 Compose 테스트.
- `output/android/`: 빌드 결과, 준비한 에셋, 검사 보고서.

Android Studio에서는 `tooling/android/`를 엽니다. 앱 코드는 Gradle sourceSets를 통해 `src/android/`에서 읽습니다. Android 10(API 29)부터 설치할 수 있으며, Android 16(API 36)을 대상으로 빌드합니다. debug 앱 ID는 `io.modfinder.app.debug`이므로 사용자의 정식 앱과 데이터를 덮어쓰지 않습니다.

## 유리 효과와 성능

Android 13(API 33) 이상에서는 Android `RuntimeShader`의 AGSL로 패널 굴절, RGB 분산, 테두리 반사광과 터치 반응을 그립니다. Android 10–12에서는 같은 배경을 샘플링한 반투명 패널과 테마 테두리를 사용합니다. 구버전에는 AGSL 굴절이 없습니다.

배경은 화면·게임·사진·테마가 바뀔 때만 별도 작업 스레드에서 준비합니다. 최대 75만 픽셀, 긴 변 1,200픽셀로 제한한 장면을 여러 패널이 공유합니다. 셰이더는 보이는 유리 패널 내부에서만 실행합니다. 화면을 매 프레임 캡처하거나 WebGL 결과를 다른 캔버스로 복사하지 않습니다. 검색 목록은 LazyColumn으로 화면에 필요한 항목만 구성합니다.

대기 화면에는 상시 프레임 루프가 없습니다. 사진은 탐색 화면이 앞에 있을 때 20초마다 바뀝니다. 설정·상세 화면과 백그라운드에서는 사진 타이머를 멈춥니다. 기존 웹의 계속 움직이는 오로라·파티클 대신 정적인 테마 조명과 터치 시 유리 반응을 사용합니다.

## 검색과 저장

Android 0.2.1부터 게임 이미지 103개는 APK에 포함하지 않고 운영 Worker에서 필요할 때 불러옵니다. 이미지 주소에 내용 해시를 붙여 앱 업데이트 시 변경된 이미지를 구분합니다. 자체 게임 이미지 전용 캐시는 디스크 24MiB·메모리 8MiB로 제한합니다. 이미 받은 이미지는 오프라인에서도 캐시가 남아 있으면 사용할 수 있습니다. 처음 실행할 때 네트워크가 없거나 이미지 요청이 실패하면 테마 배경을 표시하며, 검색 입력과 화면 전환은 이미지 로딩을 기다리지 않습니다.

운영 API는 `https://modfinder.pages.dev`입니다. `MODFINDER_API_URL`로 다른 공개 HTTPS 원점을 설정할 수 있습니다. 키는 서버에만 둡니다. 검색은 최대 4개 요청을 동시에 보내고, 새 검색은 이전 요청을 취소합니다. 추가 페이지는 스크롤에 따라 읽고 반복 커서는 중단합니다. ID는 문자열로 보관하고, 출처가 검증된 연결에 대해서만 같은 게임의 결과를 묶습니다. 외부 링크와 실제 검색 결과는 구분합니다.

모든 출처에서 즐겨찾기 참조를 남길 수 있습니다. CurseForge는 식별자만 저장하며 API 응답은 저장하지 않습니다. Thunderstore도 기본적으로 식별자만 남깁니다. 정책 검토 후 `MODFINDER_ALLOW_THUNDERSTORE_PERSISTENCE=true`로 빌드한 경우에만 상세 데이터 저장을 허용합니다. 참조는 실행 시 API에서 다시 읽고, 오프라인에서는 식별자와 원본 사이트 링크를 유지합니다. 공용 검색 캐시와 모드 제공자 아이콘의 디스크 캐시는 사용하지 않습니다.

즐겨찾기·폴더·최근 검색·비교·테마·언어는 한 파일의 완전한 스냅샷으로 직렬화하고 Android AtomicFile로 교체합니다. 기존 Tauri 앱의 `modfinder.db`와 `local_state`를 읽어 첫 실행 때 가져옵니다. 기존 DB는 변경하지 않습니다. 데이터가 손상된 경우 오류를 표시하고 빈 상태로 덮어쓰지 않습니다. 웹뷰에만 저장된 테마·언어 설정은 Android 첫 실행에서 기본값을 사용합니다.

## 빌드와 검증

저장소 루트에서 실행합니다.

```powershell
npm run android:init
npm run android:check
npm run android:test:device
npm run android:build
```

`android:check`는 Kotlin 테스트·Android Lint·debug APK 빌드를 실행합니다. `android:test:device`는 연결된 테스트 기기 또는 에뮬레이터에서 실행합니다. 테스트는 별도 debug 앱에서 고정 응답으로 검색·페이지 추가·취소·필터·즐겨찾기·화면 전환과 실제 AGSL 컴파일을 검사합니다.

`Build-Android.bat`와 `android:build`는 release 테스트·Lint를 거쳐 기존 서명키로 설치용 APK를 생성하고 서명과 16KB 정렬을 확인합니다. 원격 게임 이미지가 APK 에셋에 들어 있으면 빌드를 실패 처리합니다. 결과는 `output/releases/v0.2.1/ModFinder-0.2.1-Android.apk`입니다. 기존 정식 앱 ID와 서명키를 유지하고 versionCode를 2001로 올려 업데이트 설치를 지원합니다. Android 서명 환경변수와 개인 서명 설정은 [배포 절차](RELEASE.md)를 따릅니다.

Java, Android SDK Platform 36과 Build Tools가 필요합니다. Android 빌드에 Rust·NDK·WebView는 필요하지 않습니다. 빌드는 APK를 로컬에 생성하며, 기존 웹 다운로드의 바이너리를 자동 교체하지 않습니다.

실기기 성능은 별도 검증 대상입니다. Galaxy S22 Ultra / One UI 8.0 / Android 16에서 검색 입력, 빠른 스크롤, 키보드 전환, 앱 복귀, 재실행 후 즐겨찾기를 확인합니다. 에뮬레이터 수치로 이 기기의 프레임률이나 발열 개선을 단정하지 않습니다.

공식 참고: [AGSL](https://developer.android.com/develop/ui/views/graphics/agsl), [RuntimeShader 사용](https://developer.android.com/develop/ui/views/graphics/agsl/using-agsl).
