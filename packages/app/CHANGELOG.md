# @remixapp/app

## 0.4.0

### Minor Changes

- 9e6a60c: 프로젝트 lifecycle에 자동으로 정리되는 timer와 비동기 작업용 AbortSignal 추가
- 4191ce6: Device owner로 설치되지 않은 경우에도 가능한 정상 작동하도록 변경

### Patch Changes

- Updated dependencies [307f2ad]
- Updated dependencies [9e6a60c]
- Updated dependencies [4191ce6]
  - @remixapp/core@0.4.0
  - @remixapp/sdk@0.4.0
  - @remixapp/runtime@0.4.0

## 0.3.1

### Patch Changes

- 0c9fe42: 릴리즈 파이프라인 개선
  - @remixapp/core@0.3.1
  - @remixapp/runtime@0.3.1
  - @remixapp/sdk@0.3.1

## 0.3.0

### Minor Changes

- 20c7c35: 프로젝트 초기화 제어, 카메라 권한 지원, 투명한 WebView 비디오 포스터 및 일관된 설치·실행 도구를 추가해 Android Host의 생명주기와 화면 처리를 개선합니다.
- 3b5e5da: Add per-rule native event `activityState` control with `always` as the default for newly built projects.
- 20c7c35: 안정적인 프로젝트 ID와 기기별 프로젝트 Constants를 추가하고, Host의 override 관리, 필수 값 검증, 런타임 설정 템플릿 및 `context.constants`를 지원합니다.
- 20c7c35: SDK, 개발 런타임 및 Android Host 전반에 단발, 패턴, 프리셋, 세기, 반복 재생 및 명시적 중지를 지원하는 진동 제어를 추가합니다.

### Patch Changes

- 20c7c35: Android 화면 깨우기 동작을 수정하고, Host가 Device Owner로 프로비저닝된 경우 선언된 위험 권한을 자동으로 허용합니다.
- 20c7c35: Host 런타임, MQTT 및 native event 설정이 동일한 활성 프로젝트 manifest를 사용하도록 조회 경로를 native core 저장소로 통합합니다.
- Updated dependencies [20c7c35]
- Updated dependencies [3b5e5da]
- Updated dependencies [20c7c35]
- Updated dependencies [20c7c35]
- Updated dependencies [20c7c35]
  - @remixapp/core@0.3.0
  - @remixapp/sdk@0.3.0
  - @remixapp/runtime@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies
  - @remixapp/core@0.2.0
  - @remixapp/sdk@0.2.0
  - @remixapp/runtime@0.2.0
