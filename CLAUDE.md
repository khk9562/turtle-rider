# 거북 라이더 (Turtle Rider) - Claude Code 규칙

## 커밋 컨벤션
- `FEAT:` - 새로운 기능 추가
- `FIX:` - 버그 수정
- `DOCS:` - PLAN.md 등 문서만 업데이트하는 경우
- 각 기능/수정은 개별 커밋으로 분리할 것

## 문서 규칙
- 코드 변경 시 항상 `PLAN.md`를 함께 업데이트할 것
- PLAN.md에는 현재 구현 상태, 개선 사항, 우선순위를 반영

## 코드 규칙
- 게임 규칙(경로, 속도, 박스 효과, 단계 생성, 판정)은 `src/game/`의 순수 함수로 두고 vitest로 검증한다. DOM을 쓰지 않는다
- 시뮬레이션은 고정 간격(`SIM_DT`)으로만 진행한다. 화면 재생 속도가 판정 결과를 바꾸면 안 된다
- 단계는 시드 난수로 만든다. 같은 단계 번호는 항상 같은 맵이어야 한다
- 변경 후 `npm run lint`, `npm test`, `npm run build`가 모두 통과해야 한다

## 스타일 규칙
- 모바일 우선. 넓은 화면(>= 46rem, 아이패드/PC)에서는 왼쪽 패널 + 오른쪽 판 2열. 어느 크기에서도 스크롤이 생기면 안 된다
- 거의 무채색으로 유지한다. 색은 박스와 거북이에만 쓴다
- 절대 크기(px) 대신 상대 크기(rem, %, dvh) 사용. 캔버스 안 그리기는 월드 단위(360x600)를 쓴다
- CSS Modules 사용 (`.module.css`)
- 색은 직접 쓰지 말고 테마 변수(`--color-*`, `--accent-solid`, `--theme-line`)를 쓸 것. 원본은 `src/shared/theme.ts`
- 반경은 `--radius`(2px) 하나만 쓴다. 판 위 박스와 범례 아이콘만 예외로 6px
- 픽셀 아트는 `src/render/sprites.ts`에 문자열 격자로 둔다. 색 글자는 `pixelPalette`에 있어야 한다

## 브랜치
- main 브랜치에 직접 푸시
- 코드를 main에 푸시한 뒤 `npm run deploy:pages`로 GitHub Pages(gh-pages 브랜치)도 갱신한다
- `.github/workflows/`는 Claude 세션 권한으로 푸시할 수 없다. 워크플로 변경은 `docs/deploy-pages.yml`을 고치고 사용자에게 반영을 요청한다
