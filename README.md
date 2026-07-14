# 가정 임포스터 — 마법 학교 방탈출 (실시간 멀티플레이)

중학교 1학기 가정 복습용 실시간 멀티플레이 게임입니다. 학생들이 각자 기기에서 접속해
방에 모이고, 한 명이 숨은 **임포스터(마녀)** 가 되어 친구들을 몰래 **마법진에 봉인**합니다.
견습생들은 제한시간 안에 **퀴즈를 모두 풀거나**, **긴급회의에서 임포스터를 지목**하면 승리합니다.

- 기본 방 **5개** 자동 생성 + 학생이 **방 추가 생성** 가능 (선착순 입장, 방당 최대 12명)
- 입장 시 **닉네임** 설정
- 방의 **모든 인원이 ‘준비 완료’** 를 누르면 **자동 시작**
- **관리자 화면**(`/admin.html`)에서 로그인 후 **모든 게임 강제 종료 · 전원 퇴장**

---

## 🎮 조작법
- 이동: **WASD / 방향키** 또는 **화면 클릭**(모바일은 왼쪽 조이스틱)
- 견습생: 빛나는 **마법서(📖)** 에 다가가면 퀴즈가 열림
- 임포스터: 근처 견습생에게 다가가 **🔮 봉인** 버튼(또는 **E** 키)
- 누구나: **🚨 회의** 버튼으로 긴급회의 → 임포스터 지목 투표(기회 2번)

---

## 🚀 GitHub → Render 무료 배포 (권장, 어디서나 접속)

> GitHub Pages는 정적 파일만 호스팅하므로 이 게임(실시간 서버)은 **동작하지 않습니다.**
> 코드는 GitHub에 두고, **Render** 같은 무료 호스팅이 서버를 실행하게 합니다.

### 1) GitHub에 코드 올리기
```bash
cd magic-impostor
git init
git add .
git commit -m "가정 임포스터 멀티플레이"
git branch -M main
git remote add origin https://github.com/<본인아이디>/magic-impostor.git
git push -u origin main
```
(GitHub 웹에서 새 저장소를 먼저 만들어 두세요.)

### 2) Render에 연결
1. https://render.com 가입(무료) → **New +** → **Web Service**
2. 방금 올린 GitHub 저장소를 선택
3. 설정이 자동으로 잡힙니다(이 저장소의 `render.yaml` 덕분):
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. **Environment** 탭에서 `ADMIN_PASSWORD` 값을 원하는 비밀번호로 입력 (관리자 로그인용)
5. **Create Web Service** → 몇 분 뒤 `https://magic-impostor-xxxx.onrender.com` 주소가 생김

### 3) 학생·관리자 접속
- 학생: 생성된 주소를 그대로 공유 (예: `https://magic-impostor-xxxx.onrender.com`)
- 관리자(선생님): 주소 뒤에 `/admin.html` (예: `.../admin.html`) → 비밀번호로 로그인

> 무료 플랜은 접속이 없으면 잠들었다가 첫 접속 시 30초쯤 깨어납니다(수업 시작 1분 전 미리 한 번 열어두면 좋아요).
> Railway(railway.app)도 같은 방식(저장소 연결 → 자동 실행)으로 됩니다.

---

## 💻 로컬에서 실행 (같은 와이파이 테스트용)
```bash
cd magic-impostor
npm install
ADMIN_PASSWORD=원하는비번 node server.js
```
- 접속: `http://localhost:3000` , 관리자: `http://localhost:3000/admin.html`
- 같은 와이파이의 다른 기기는 `http://<이 컴퓨터 IP>:3000` 으로 접속

---

## ⚙️ 설정 바꾸기
- 관리자 비밀번호: 환경변수 `ADMIN_PASSWORD` (기본값 `admin1234` — **꼭 변경**)
- 퀴즈 문항/정답: `server.js` 상단의 `BANK` 배열에서 수정 (자궁 크기·정자 수 등 교재 기준에 맞게 조정 가능)
- 방 인원·제한시간·퀴즈 수·봉인 쿨다운 등: `server.js` 의 `CFG` 객체
- 기본 방 개수/이름: `server.js` 의 `['1반 방','2반 방',...]` 부분

---

## 📁 구성
```
magic-impostor/
├─ server.js          # 게임 서버(방·역할·봉인·퀴즈·회의·관리자)
├─ package.json
├─ render.yaml        # Render 원클릭 설정
├─ Procfile           # (Railway/Heroku 계열용)
├─ public/
│  ├─ index.html      # 학생 화면(로비·대기실·실시간 게임)
│  └─ admin.html      # 관리자 화면
└─ README.md
```
