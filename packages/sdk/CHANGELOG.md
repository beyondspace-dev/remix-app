# @remixapp/sdk

## 0.4.0

### Minor Changes

- 9e6a60c: 프로젝트 lifecycle에 자동으로 정리되는 timer와 비동기 작업용 AbortSignal 추가

## 0.3.1

## 0.3.0

### Minor Changes

- 3b5e5da: Add per-rule native event `activityState` control with `always` as the default for newly built projects.
- 20c7c35: 안정적인 프로젝트 ID와 기기별 프로젝트 Constants를 추가하고, Host의 override 관리, 필수 값 검증, 런타임 설정 템플릿 및 `context.constants`를 지원합니다.
- 20c7c35: SDK, 개발 런타임 및 Android Host 전반에 단발, 패턴, 프리셋, 세기, 반복 재생 및 명시적 중지를 지원하는 진동 제어를 추가합니다.

## 0.2.0

### Minor Changes

- Add native MQTT, namespaced events, the shared action contract, and paused-Activity native event rules.

  This release changes the project runtime API. Rebuild existing projects and
  migrate event subscriptions to `context.events.on(...)`. The per-status
  `.on(...)` methods and `context.device.runtime` are no longer available.
