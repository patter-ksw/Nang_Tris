# 냥트리스 프로젝트 개발 규칙 (Nang_Tris Project Rules)

## 진행 프로세스 규칙
1. **계획서 작성 및 즉시 실행**:
   - 새로운 기능이나 변경 사항 개발 시, `implementation_plan.md`를 작성하여 진행 계획을 기록합니다.
   - 이때 `implementation_plan.md`의 `ArtifactMetadata`에서 `RequestFeedback`은 항상 `false`로 설정합니다.
   - 사용자의 확인이나 승인(Proceed) 버튼 클릭, 또는 "시작해줘" 등의 답변을 기다리지 않고, 계획 수립 즉시 구현 및 로컬 검증 작업을 시작합니다.
2. **자동 배포 확인 및 최종 보고**:
   - 개발 및 로컬 검증이 끝나면 Git 커밋 후 푸시하여 Vercel 배포를 자동으로 진행하고 완료 상태까지 직접 확인합니다.
   - 모든 검증 과정이 끝나면 최종 결과를 채팅창으로 한 번에 보고합니다.
