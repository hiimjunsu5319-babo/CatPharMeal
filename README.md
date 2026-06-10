# 가약학식

가톨릭대학교 식당 페이지에서 이번 주 메뉴 PDF를 서버가 가져오고, 앱에서 메뉴표를 확인할 수 있게 해주는 PWA입니다.

원본 페이지:
https://www.catholic.ac.kr/ko/campuslife/restaurant.do

## 구조

- `server.js`: Express 서버입니다.
- `public/`: 브라우저에 제공되는 프론트엔드 파일입니다.
- `/api/restaurants`: 식당별 최신 PDF 링크를 반환합니다.
- `/api/pdf?id=buon`: 해당 식당 PDF를 서버가 받아 프록시로 보여줍니다.
- `/api/menu?id=buon`: 해당 식당 PDF를 서버가 받아 텍스트로 파싱해 JSON으로 반환합니다.

식당 ID:

- `buon`: 부온 프란조(2층)
- `bona`: 카페 보나(1층)

## 로컬 실행

```powershell
npm install
npm start
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## Render 배포 설정

Render에서 `New Web Service`를 만들고 GitHub 저장소를 연결합니다.

설정값:

```text
Build Command: npm install
Start Command: npm start
```

또는 `render.yaml`을 사용하면 아래 설정이 자동으로 적용됩니다.

```yaml
buildCommand: npm install
startCommand: npm start
healthCheckPath: /healthz
```

배포가 끝나면 예를 들어 `https://gayaak-meal.onrender.com` 같은 주소가 생깁니다.

## GitHub Pages와 함께 쓰기

GitHub Pages는 정적 파일만 제공하므로 `server.js`를 실행할 수 없습니다. GitHub Pages에서 화면을 열고 싶다면 Render에 서버를 먼저 배포한 뒤, `public/api-config.js`에 Render 주소를 넣습니다.

```js
window.GAYAAK_API_BASE = "https://gayaak-meal.onrender.com";
```

Render 주소로 직접 접속할 경우에는 빈 값 그대로 두면 됩니다.

```js
window.GAYAAK_API_BASE = "";
```
