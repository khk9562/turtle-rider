# 거북 라이더 (Turtle Rider)

선을 그려 픽셀 거북이를 제한 시간 안에 골까지 보내는 모바일 퍼즐 게임입니다.

## 놀이 방법
1. 단계가 시작되면 거북이가 출발점에서 골까지 **일직선으로** 가는 모습을 2배속으로 보여 줍니다. 이 시간이 감을 잡는 기준입니다.
2. 출발점부터 손가락으로 선을 그립니다. 맵의 **박스를 모두 지나** 골까지 이어야 출발할 수 있습니다.
3. 거북이는 선을 따라 걷습니다. 내리막은 빠르고 오르막은 느립니다.
4. 박스를 밟으면 잠깐 속도가 바뀝니다.

| 박스 | 효과 | 등장 |
|---|---|---|
| 풀숲 | x1.4, 1.5초 | 1단계 |
| 토끼 | x2, 2초 | 2단계 |
| 달팽이 | x0.45, 2.5초 | 3단계 |
| 비행기 | x3.2, 1.2초 | 5단계 |

5. 1~3단계는 "N초 이내", 4단계부터는 "A초 초과 ~ B초 이내" 조건이 붙습니다. 너무 빨라도 실패이므로, 선을 완만하게 하거나 굴곡지게 그려 도착 시간을 맞춰야 합니다.

## 개발
```bash
npm install
npm run dev        # 개발 서버
npm test           # 게임 로직 테스트
npm run lint
npm run build      # dist/
npm run build:single  # 단일 HTML 파일(dist-single/)
```

## GitHub Pages 배포
자동 배포 워크플로는 `docs/deploy-pages.yml`에 있습니다. 한 번만 설정하면 이후 main에 푸시할 때마다 배포됩니다.
1. GitHub에서 **Add file > Create new file**로 `.github/workflows/deploy.yml`을 만들고 `docs/deploy-pages.yml` 내용을 붙여 넣어 커밋합니다.
2. 저장소 **Settings > Pages > Source**를 **GitHub Actions**로 바꿉니다.
