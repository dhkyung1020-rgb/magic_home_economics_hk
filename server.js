/* ============================================================
   가정 임포스터 — 마법 학교 방탈출 (실시간 멀티플레이 서버)
   Node.js + Express(정적 파일) + ws(WebSocket)
   실행: node server.js   (환경변수 PORT, ADMIN_PASSWORD 사용 가능)
   ============================================================ */
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'; // ★ 배포 시 꼭 바꾸세요

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.send('ok'));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/* ---------- 설정값 ---------- */
const numEnv = (k, d) => (process.env[k]!==undefined && !isNaN(+process.env[k])) ? +process.env[k] : d;
const CFG = {
  capacity:  numEnv('CAP', 12),        // 방 최대 인원
  minPlayers:numEnv('MIN_PLAYERS', 2), // 시작 최소 인원(권장 4+)
  quizN:     numEnv('QUIZ_N', 12),     // 방이 함께 풀어야 하는 퀴즈 수
  time:      numEnv('TIME', 300),      // 제한시간(초)
  sealCd:    numEnv('SEAL_CD', 22),    // 봉인 재사용 대기(초)
  sealRange: numEnv('SEAL_RANGE', 140),// 봉인 사거리(월드 px)
  jailDur:   numEnv('JAIL_DUR', 8),    // 봉인 지속(초)
  meetingDur:numEnv('MEETING_DUR', 24),// 긴급회의 투표 시간(초)
  chances:   numEnv('CHANCES', 2)      // 임포스터 지목 기회
};

const COLORS = [
  {id:"red",name:"빨강",c:"#e0453f",d:"#8f2420"},
  {id:"blue",name:"파랑",c:"#3b6fe0",d:"#22417f"},
  {id:"green",name:"초록",c:"#3fbf62",d:"#217038"},
  {id:"yellow",name:"노랑",c:"#f2c53d",d:"#a07f18"},
  {id:"pink",name:"분홍",c:"#f07cc0",d:"#a03e78"},
  {id:"purple",name:"보라",c:"#8a5ce0",d:"#4e2f8f"},
  {id:"orange",name:"주황",c:"#f0873d",d:"#a0511a"},
  {id:"cyan",name:"청록",c:"#3fcfd0",d:"#1c7f80"},
  {id:"lime",name:"연두",c:"#a7e03f",d:"#5f8f1c"},
  {id:"teal",name:"민트",c:"#2fb8a0",d:"#1a6f60"},
  {id:"rose",name:"장미",c:"#e85d7a",d:"#8f2f45"},
  {id:"indigo",name:"남보라",c:"#6a5de0",d:"#3a2f8f"}
];

const WORLD = { w:1680, h:1040 };
const SPAWNS = [[240,210],[1290,220],[240,820],[820,850],[1370,810],[870,530],[420,470],[1150,470]];
const JAIL = { x:1300, y:430, w:320, h:200 };
function jailSlot(i){ return { x: JAIL.x+40+(i%4)*70, y: JAIL.y+50+Math.floor(i/4)*70 }; }

/* ---------- 퀴즈 (정답은 서버만 보관) ---------- */
const BANK = [
  {part:"1부·성장과 발달",q:"성장 호르몬이 활발히 분비되며 키와 몸무게가 급격하게 증가하는 현상은?",a:"성장 급등",o:["성장 급등","사춘기","2차 성징","성장판"],ex:"청소년기에 키·몸무게가 급격히 느는 현상을 ‘성장 급등’이라고 해요."},
  {part:"1부·성장과 발달",q:"여성의 성호르몬은 에스트로겐. 그렇다면 남성의 성호르몬은?",a:"테스토스테론",o:["테스토스테론","프로게스테론","에스트로겐","인슐린"],ex:"남성 성호르몬은 ‘테스토스테론’이에요."},
  {part:"1부·성장과 발달",q:"여러 가설을 세우고 체계적으로 시험하여 정답을 찾아가는 사고 능력은?",a:"가설 연역적 사고",o:["가설 연역적 사고","직관적 사고","자기중심적 사고","구체적 조작 사고"],ex:"가설을 세워 논리적으로 검증하는 사고를 ‘가설 연역적 사고’라 해요."},
  {part:"1부·성장과 발달",q:"눈에 보이지 않는 개념이나 현상을 이해하고 생각할 수 있는 청소년기 인지 발달 특징은?",a:"추상적 사고",o:["추상적 사고","구체적 사고","감각적 사고","반사적 사고"],ex:"눈에 보이지 않는 개념을 다루는 능력을 ‘추상적 사고’라고 해요."},
  {part:"1부·성장과 발달",q:"‘하인츠의 딜레마’ 이야기를 통해 학습하고자 하는 발달 영역은?",a:"도덕성 발달",o:["도덕성 발달","신체 발달","언어 발달","정서 발달"],ex:"하인츠의 딜레마는 옳고 그름을 판단하는 ‘도덕성 발달’을 다뤄요."},
  {part:"1부·성장과 발달",adv:true,q:"(심화) 성장 급등이 일어나는 시기는 보통 남자가 여자보다?",a:"늦음",o:["늦음","빠름","똑같음","성별과 무관"],ex:"여자는 10~12세, 남자는 12~14세로 남자가 더 ‘늦게’ 시작해요."},
  {part:"2부·생식기관",q:"여성의 생식기관 중 난자가 배출되는 곳이며, 좌우에 하나씩 있는 곳은?",a:"난소",o:["난소","자궁","난관","질"],ex:"난자를 만들고 배출하는 좌우 한 쌍의 기관은 ‘난소’예요."},
  {part:"2부·생식기관",q:"배란된 난자가 이동하거나 수정이 이루어지는 통로의 이름은?",a:"난관",o:["난관","자궁","질","요도"],ex:"난자의 이동·수정이 일어나는 통로는 ‘난관(수란관)’이에요."},
  {part:"2부·생식기관",q:"자궁은 평소 주먹만 한 크기지만, 임신 시 최대 몇 배까지 커질 수 있나요?",a:"약 500배",o:["약 500배","약 5배","약 50배","약 5000배"],ex:"자궁은 임신하면 약 500배까지 커질 수 있어요."},
  {part:"2부·생식기관",q:"남성의 생식기관 중 남성 호르몬을 분비하고 정자를 만드는 곳은?",a:"정소",o:["정소(고환)","부정소","정낭","전립선"],ex:"정자를 만들고 남성 호르몬을 분비하는 곳은 ‘정소(고환)’예요."},
  {part:"2부·생식기관",q:"정자를 성숙시키고 일시적으로 저장하는 기관의 이름은?",a:"부정소",o:["부정소","정소","정관","정낭"],ex:"정자를 성숙·저장하는 곳은 ‘부정소’예요."},
  {part:"2부·생식기관",adv:true,q:"(심화) 정자에게 영양분·에너지를 공급하는 액체(정액 성분)를 만드는 두 곳은?",a:"정낭, 전립선",o:["정낭, 전립선","정소, 부정소","정관, 요도","방광, 신장"],ex:"정액의 영양 성분은 ‘정낭’과 ‘전립선’에서 만들어요."},
  {part:"2부·생식기관",q:"정액 1회 분비량(약 2~5mL)에는 보통 몇 개의 정자가 들어 있나요?",a:"약 3억 개",o:["약 3억 개","약 300개","약 3만 개","약 30개"],ex:"한 번 사정 시 정자는 보통 약 2~3억 개 들어 있어요."},
  {part:"2부·생식기관",q:"잠을 자는 동안 자신도 모르게 사정을 경험하는 현상은?",a:"몽정",o:["몽정","배란","월경","사춘기"],ex:"수면 중 무의식적으로 사정하는 것을 ‘몽정’이라 해요."},
  {part:"2부·생식기관",adv:true,q:"(심화) 난자는 배란 후 약 며칠 동안 생존할 수 있나요?",a:"약 1일",o:["약 1일","약 3일","약 7일","약 12시간"],ex:"난자의 생존 기간은 배란 후 약 1일(24시간)이에요."},
  {part:"3부·임신과 피임",q:"수정란이 자궁 내막에 파고들어 정착하는 것을 무엇이라 하나요?",a:"착상",o:["착상","수정","배란","월경"],ex:"수정란이 자궁 내막에 자리 잡는 것을 ‘착상’이라 해요."},
  {part:"3부·임신과 피임",q:"출산 예정일 계산 시 ‘일’에는 며칠을 더해야 하나요? (월: +9 또는 −3)",a:"7일",o:["7일","10일","5일","14일"],ex:"네겔레 법칙: 마지막 월경 시작일의 월 +9(또는 −3), 일 +7."},
  {part:"3부·임신과 피임",adv:true,q:"(심화) 마지막 월경일이 1월 3일일 때 출산 예정일은?",a:"10월 10일",o:["10월 10일","10월 3일","9월 10일","4월 10일"],ex:"1월+9=10월, 3일+7=10일 → 10월 10일."},
  {part:"3부·임신과 피임",q:"남성 성기에 얇은 고무막을 씌워 정자의 진입을 물리적으로 막는 피임 도구는?",a:"콘돔",o:["콘돔","경구피임약","정관수술","자궁 내 장치"],ex:"물리적으로 정자를 차단하는 도구는 ‘콘돔’이에요."},
  {part:"3부·임신과 피임",q:"여성이 복용하여 배란을 억제해 임신을 피하는 방법은?",a:"경구피임약",o:["경구피임약","콘돔","정관수술","월경 주기법"],ex:"배란을 억제하는 먹는 약은 ‘경구피임약’이에요."},
  {part:"3부·임신과 피임",q:"정자가 이동하는 통로인 정관을 묶어 정자 배출을 막는 피임 방법은?",a:"정관수술",o:["정관수술","난관수술","콘돔","경구피임약"],ex:"정관을 묶는 남성 영구 피임법은 ‘정관수술’이에요."},
  {part:"4부·영양소",q:"에너지를 공급하는 3대 영양소는 탄수화물, 지방, 그리고?",a:"단백질",o:["단백질","비타민","무기질","물"],ex:"에너지원 3대 영양소는 탄수화물·지방·‘단백질’이에요."},
  {part:"4부·영양소",q:"탄수화물은 대부분 에너지원으로 쓰여 몸을 구성하는 비율이 ( )?",a:"낮다",o:["낮다","높다"],ex:"탄수화물은 대부분 에너지로 소비되어 몸 구성 비율은 ‘낮다’."},
  {part:"4부·영양소",q:"단백질 1g은 약 몇 kcal의 에너지를 내나요?",a:"약 4 kcal",o:["약 4 kcal","약 9 kcal","약 7 kcal","약 2 kcal"],ex:"탄수화물·단백질은 4kcal, 지방은 9kcal/g이에요."},
  {part:"4부·영양소",q:"비타민 A가 부족할 때 밤에 잘 보이지 않는 증상은?",a:"야맹증",o:["야맹증","괴혈병","각기병","구루병"],ex:"비타민 A 부족 시 어두운 곳에서 잘 못 보는 ‘야맹증’이 생겨요."},
  {part:"4부·영양소",adv:true,q:"(심화) 비타민 C가 부족하여 잇몸 등에서 피가 나는 병은?",a:"괴혈병",o:["괴혈병","야맹증","각기병","빈혈"],ex:"비타민 C 부족으로 잇몸 출혈이 나는 병은 ‘괴혈병’이에요."},
  {part:"4부·영양소",q:"뼈와 치아를 구성하며 부족 시 골다공증을 유발할 수 있는 무기염류는?",a:"칼슘",o:["칼슘","철분","나트륨","요오드"],ex:"뼈·치아를 이루는 무기염류는 ‘칼슘’이에요."},
  {part:"4부·영양소",q:"적혈구의 헤모글로빈 구성 성분으로, 부족하면 빈혈이 생기기 쉬운 영양소는?",a:"철분",o:["철분","칼슘","칼륨","인"],ex:"헤모글로빈을 이루는 무기염류는 ‘철분’이에요."},
  {part:"5부·의복",q:"시간(Time)·장소(Place)·상황(Occasion)에 맞게 옷을 입는 것을 뜻하는 약어는?",a:"T.P.O",o:["T.P.O","O.O.T.D","S.P.A","D.I.Y"],ex:"때·장소·상황에 맞춘 옷차림을 ‘T.P.O’라 해요."},
  {part:"5부·의복",adv:true,q:"(심화) 키가 작고 뚱뚱한 사람이 더 날씬해 보이려면 어떤 선의 옷이 유리?",a:"세로선",o:["세로선","가로선","물방울무늬","가로 줄무늬"],ex:"세로선(또는 각도가 큰 사선)은 길고 날씬해 보이게 해요."},
  {part:"5부·의복",q:"얼굴형과 ( ) 형태의 목둘레선은 단점을 부각하므로 피해야 한다.",a:"같은",o:["같은","다른"],ex:"얼굴형과 ‘같은’ 형태의 목둘레선은 단점을 더 강조해요."},
  {part:"5부·의복",q:"체형을 작아 보이게 하려면 명도가 ( ) 색이 유리하다.",a:"낮은",o:["낮은","높은"],ex:"명도가 ‘낮은(어두운)’ 색은 체형을 작아 보이게 해요."},
  {part:"5부·의복",adv:true,q:"(심화) 광택 있는 재질의 옷감은 채도를 ( ) 보이게 하여 체형을 확대해 보이게 한다.",a:"높게",o:["높게","낮게"],ex:"광택 재질은 채도를 ‘높게’ 보이게 해 커 보이게 만들어요."},
  {part:"5부·의복",q:"체격이 큰 사람에게는 무늬의 크기가 ( ) 것이 더 잘 어울린다.",a:"큰",o:["큰","작은"],ex:"체격이 큰 사람은 ‘큰’ 무늬가 조화로워요."}
];
function isCorrect(entry, choice){ return choice===entry.a || (typeof choice==='string' && choice.indexOf(entry.a)===0); }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

/* ---------- 방 상태 ---------- */
const rooms = new Map();
let ridSeq = 1, pidSeq = 1;
function uid(p){ return p + (Date.now().toString(36)) + (p==='r'?(ridSeq++):(pidSeq++)); }

function makeRoom(name, isDefault){
  const id = uid('r');
  const r = {
    id, name, isDefault: !!isDefault,
    players: new Map(),         // pid -> player
    state: 'lobby',             // lobby | countdown | playing | ended
    countdownT: null,
    // game
    quizIds: [], solved: new Set(), locks: new Map(), // qid->pid
    timeLeft: CFG.time, impostorId: null, chances: CFG.chances,
    lastTick: 0,
    meeting: null               // {votes:Map(pid->target), until}
  };
  rooms.set(id, r);
  return r;
}
// 기본 방 5개
['1반 방','2반 방','3반 방','4반 방','5반 방'].forEach(n=>makeRoom(n, true));

function usedColors(room){ const s=new Set(); room.players.forEach(p=>s.add(p.color.id)); return s; }
function pickColor(room){ const used=usedColors(room); return COLORS.find(c=>!used.has(c.id)) || COLORS[room.players.size % COLORS.length]; }

function roomList(){
  return [...rooms.values()].map(r=>({
    id:r.id, name:r.name, count:r.players.size, cap:CFG.capacity,
    state:r.state, isDefault:r.isDefault
  }));
}
function send(ws, msg){ try{ if(ws.readyState===1) ws.send(JSON.stringify(msg)); }catch(e){} }
function broadcast(room, msg){ room.players.forEach(p=>send(p.ws, msg)); }
function lobbyWatchers(){ return [...wss.clients].filter(c=>c.readyState===1 && !c.roomId && c.kind!=='admin'); }
function pushRoomList(){ const list=roomList(); lobbyWatchers().forEach(c=>send(c,{t:'rooms',rooms:list})); pushAdmin(); }
function lobbyPayload(room){ return { t:'lobby', roomId:room.id, name:room.name,
  players:[...room.players.values()].map(p=>({id:p.id,nick:p.nick,ready:p.ready,color:p.color})) }; }

/* ---------- 입장/대기실 ---------- */
function joinRoom(ws, room, nick){
  if(room.state!=='lobby'){ send(ws,{t:'error',msg:'이미 게임이 시작된 방이에요.'}); return; }
  if(room.players.size>=CFG.capacity){ send(ws,{t:'error',msg:'방이 가득 찼어요.'}); return; }
  const pid = uid('p');
  const color = pickColor(room);
  const sp = SPAWNS[room.players.size % SPAWNS.length];
  const player = { id:pid, ws, nick:(nick||'익명').slice(0,12), ready:false, color,
    x:sp[0], y:sp[1], face:1, role:'crew', jailed:false, everJailed:false, jailUntil:0 };
  room.players.set(pid, player);
  ws.roomId = room.id; ws.pid = pid; ws.kind='player';
  send(ws, { t:'joined', roomId:room.id, name:room.name, you:pid, color, cfg:{capacity:CFG.capacity,minPlayers:CFG.minPlayers} });
  broadcast(room, lobbyPayload(room));
  pushRoomList();
}

function setReady(room, pid, ready){
  const p = room.players.get(pid); if(!p) return;
  p.ready = !!ready;
  broadcast(room, lobbyPayload(room));
  // 자동 시작 판정
  const list=[...room.players.values()];
  const allReady = list.length>=CFG.minPlayers && list.every(x=>x.ready);
  if(allReady && room.state==='lobby'){ beginCountdown(room); }
  else if(!allReady && room.state==='countdown'){ cancelCountdown(room); }
}
function beginCountdown(room){
  room.state='countdown'; let n=3;
  broadcast(room,{t:'countdown',n});
  room.countdownT=setInterval(()=>{
    n--;
    if(n<=0){ clearInterval(room.countdownT); room.countdownT=null; startGame(room); }
    else broadcast(room,{t:'countdown',n});
  },1000);
  pushRoomList();
}
function cancelCountdown(room){
  if(room.countdownT){ clearInterval(room.countdownT); room.countdownT=null; }
  room.state='lobby'; broadcast(room,{t:'countdownCancel'}); pushRoomList();
}

/* ---------- 게임 시작 ---------- */
function startGame(room){
  const list=[...room.players.values()];
  if(list.length<CFG.minPlayers){ room.state='lobby'; return; }
  // 역할 배정
  const imp = list[Math.floor(Math.random()*list.length)];
  room.impostorId = imp.id;
  list.forEach((p,i)=>{ p.role = (p.id===imp.id)?'impostor':'crew';
    const sp=SPAWNS[i%SPAWNS.length]; p.x=sp[0]; p.y=sp[1]; p.face=1;
    p.jailed=false; p.everJailed=false; p.jailUntil=0; p.sealReadyAt=0; });
  room.quizIds = shuffle(BANK.map((_,i)=>i)).slice(0, Math.min(CFG.quizN, BANK.length));
  room.solved = new Set(); room.locks = new Map();
  room.timeLeft = CFG.time; room.chances = CFG.chances; room.meeting=null;
  room.state='playing'; room.lastTick=Date.now();
  const pubPlayers = list.map(p=>({id:p.id,nick:p.nick,color:p.color,x:p.x,y:p.y}));
  list.forEach(p=>send(p.ws,{ t:'start', youId:p.id, role:p.role,
    quizN:room.quizIds.length, time:CFG.time, players:pubPlayers,
    sealCd:CFG.sealCd, sealRange:CFG.sealRange, cfg:CFG }));
  pushRoomList();
}

/* ---------- 봉인(임포스터) ---------- */
function doSeal(room, pid){
  if(room.state!=='playing' || room.meeting) return;
  const imp = room.players.get(pid);
  if(!imp || imp.role!=='impostor' || imp.jailed) return;
  const now=Date.now();
  if(now < (imp.sealReadyAt||0)) return;
  // 사거리 내 봉인 안 된 크루 중 가장 가까운 대상
  let target=null, best=1e9;
  room.players.forEach(p=>{
    if(p.role==='impostor'||p.jailed) return;
    const d=Math.hypot(p.x-imp.x,p.y-imp.y);
    if(d<CFG.sealRange && d<best){ best=d; target=p; }
  });
  if(!target) return;
  imp.sealReadyAt = now + CFG.sealCd*1000;
  sealPlayer(room, target);
  send(imp.ws,{t:'sealCd', until: imp.sealReadyAt});
}
function sealPlayer(room, target){
  const idx=[...room.players.values()].filter(p=>p.jailed).length;
  const slot=jailSlot(idx);
  target.jailed=true; target.everJailed=true; target.jailUntil=Date.now()+CFG.jailDur*1000;
  target.x=slot.x; target.y=slot.y;
  // 락 걸린 퀴즈 해제
  for(const [qid,who] of [...room.locks]) if(who===target.id) room.locks.delete(qid);
  broadcast(room,{t:'sealed', targetId:target.id, x:target.x, y:target.y});
  send(target.ws,{t:'youSealed', until:target.jailUntil});
  // 승리 판정: 임포스터 제외 전원 everJailed
  const remaining=[...room.players.values()].filter(p=>p.role!=='impostor' && !p.everJailed);
  if(remaining.length===0) endGame(room, false, '🔮 모든 견습생이 마법진에 봉인됐어요! 임포스터(마녀)의 승리!');
}

/* ---------- 퀴즈 ---------- */
function assignQuiz(room, pid){
  const p=room.players.get(pid); if(!p||p.jailed||room.meeting) return;
  const qid = room.quizIds.find(q=>!room.solved.has(q) && !room.locks.has(q));
  if(qid===undefined){ send(p.ws,{t:'noQuiz'}); return; }
  room.locks.set(qid, pid);
  const e=BANK[qid];
  send(p.ws,{t:'quizQ', qid, part:e.part, q:e.q, o:shuffle(e.o), adv:!!e.adv,
    solved:room.solved.size, quizN:room.quizIds.length});
}
function answerQuiz(room, pid, qid, choice){
  const p=room.players.get(pid); if(!p) return;
  const e=BANK[qid]; if(!e) return;
  if(room.locks.get(qid)!==pid){ /* 이미 남이 처리 */ }
  const correct=isCorrect(e, choice);
  if(correct){
    room.locks.delete(qid);
    if(p.role!=='impostor') room.solved.add(qid); // 임포스터 정답은 집계 안 함(위장)
    broadcast(room,{t:'progress', solved:room.solved.size, quizN:room.quizIds.length});
    send(p.ws,{t:'answerResult', correct:true, answer:e.a, ex:e.ex, solved:room.solved.size, quizN:room.quizIds.length});
    if(room.solved.size>=room.quizIds.length) endGame(room, true, '📖 제한시간 안에 모든 퀴즈를 완료했어요! 견습생 승리!');
  }else{
    room.locks.delete(qid); // 다시 풀 수 있게 해제
    send(p.ws,{t:'answerResult', correct:false, answer:e.a, ex:e.ex, solved:room.solved.size, quizN:room.quizIds.length});
  }
}

/* ---------- 긴급회의 & 지목 투표 ---------- */
function callMeeting(room, pid){
  if(room.state!=='playing' || room.meeting) return;
  if(room.chances<=0) return;
  const p=room.players.get(pid); if(!p||p.jailed) return;
  room.meeting={ votes:new Map(), until:Date.now()+CFG.meetingDur*1000, caller:pid };
  broadcast(room,{t:'meeting', by:p.nick, until:room.meeting.until, chances:room.chances,
    players:[...room.players.values()].map(x=>({id:x.id,nick:x.nick,color:x.color,jailed:x.jailed}))});
}
function castVote(room, pid, target){
  if(!room.meeting) return;
  room.meeting.votes.set(pid, target); // target: pid or 'skip'
  broadcast(room,{t:'voteCount', count:room.meeting.votes.size, total:room.players.size});
  if(room.meeting.votes.size>=room.players.size) tallyMeeting(room);
}
function tallyMeeting(room){
  if(!room.meeting) return;
  const tally={};
  room.meeting.votes.forEach(t=>{ tally[t]=(tally[t]||0)+1; });
  let top=null, topN=0, tie=false;
  for(const k in tally){ if(tally[k]>topN){ top=k; topN=tally[k]; tie=false; } else if(tally[k]===topN){ tie=true; } }
  room.meeting=null;
  let ejected=(top&&top!=='skip'&&!tie)?top:null;
  const wasImp = ejected && ejected===room.impostorId;
  if(wasImp){
    const imp=room.players.get(room.impostorId);
    endGame(room, true, `🕵️ 지목 성공! ${imp?imp.nick:'마녀'}가 임포스터였어요. 견습생 승리!`);
    return;
  }
  if(ejected){ room.chances--; }
  const ejP = ejected?room.players.get(ejected):null;
  broadcast(room,{t:'meetingResult', ejected: ejP?ejP.nick:null, wasImpostor:false,
    chances:room.chances, skip:!ejected});
  room.lastTick=Date.now(); // 타이머 재개 기준
}

/* ---------- 종료/리셋 ---------- */
function endGame(room, crewWin, reason){
  if(room.state==='ended') return;
  room.state='ended';
  const imp=room.players.get(room.impostorId);
  broadcast(room,{t:'end', crewWin, reason,
    impostorId:room.impostorId, impostorNick: imp?imp.nick:'?',
    solved:room.solved.size, quizN:room.quizIds.length,
    jailed:[...room.players.values()].filter(p=>p.role!=='impostor'&&p.everJailed).length,
    targets:[...room.players.values()].filter(p=>p.role!=='impostor').length });
  setTimeout(()=>resetRoom(room), 6500);
  pushRoomList();
}
function resetRoom(room){
  if(!rooms.has(room.id)) return;
  room.state='lobby'; room.impostorId=null; room.meeting=null; room.solved=new Set(); room.locks=new Map();
  room.players.forEach(p=>{ p.ready=false; p.role='crew'; p.jailed=false; p.everJailed=false; });
  broadcast(room, lobbyPayload(room));
  broadcast(room, {t:'reset'});
  pushRoomList();
}

/* ---------- 퇴장/연결종료 ---------- */
function leaveRoom(ws){
  const room=rooms.get(ws.roomId); const pid=ws.pid;
  ws.roomId=null; ws.pid=null;
  if(!room) return;
  const wasImp = room.impostorId===pid;
  room.players.delete(pid);
  for(const [qid,who] of [...room.locks]) if(who===pid) room.locks.delete(qid);
  if(room.players.size===0){
    if(room.countdownT){ clearInterval(room.countdownT); room.countdownT=null; }
    if(!room.isDefault){ rooms.delete(room.id); pushRoomList(); return; }
    room.state='lobby'; room.impostorId=null; room.meeting=null; pushRoomList(); return;
  }
  if(room.state==='playing'){
    if(wasImp){ endGame(room, true, '🚪 임포스터가 방을 나갔어요. 견습생 승리!'); return; }
    // 남은 크루가 모두 봉인됐는지 재확인
    const remaining=[...room.players.values()].filter(p=>p.role!=='impostor'&&!p.everJailed);
    if(remaining.length===0){ endGame(room, false, '🔮 모든 견습생이 봉인됐어요! 임포스터 승리!'); return; }
  }
  if(room.state==='countdown'){ // 인원 변화로 준비 조건 깨질 수 있음
    const list=[...room.players.values()];
    if(!(list.length>=CFG.minPlayers && list.every(x=>x.ready))) cancelCountdown(room);
  }
  broadcast(room, lobbyPayload(room));
  pushRoomList();
}

/* ---------- 관리자 ---------- */
function adminSnapshot(){
  return { t:'adminSnapshot', rooms:[...rooms.values()].map(r=>({
    id:r.id, name:r.name, isDefault:r.isDefault, state:r.state, count:r.players.size,
    players:[...r.players.values()].map(p=>({nick:p.nick, ready:p.ready, role:r.state==='playing'?p.role:undefined}))
  })) };
}
function pushAdmin(){ [...wss.clients].filter(c=>c.readyState===1 && c.kind==='admin').forEach(c=>send(c, adminSnapshot())); }
function adminEndAll(){
  rooms.forEach(room=>{
    if(room.countdownT){ clearInterval(room.countdownT); room.countdownT=null; }
    const hadPlayers=room.players.size>0;
    room.players.forEach(p=>{ send(p.ws,{t:'kicked', reason:'관리자가 모든 게임을 종료했습니다.'});
      p.ws.roomId=null; p.ws.pid=null; });
    room.players.clear(); room.state='lobby'; room.impostorId=null; room.meeting=null;
    room.solved=new Set(); room.locks=new Map();
  });
  // 생성된(기본이 아닌) 방 제거
  [...rooms.values()].forEach(r=>{ if(!r.isDefault) rooms.delete(r.id); });
  pushRoomList(); pushAdmin();
}

/* ---------- 게임 루프 (15Hz) ---------- */
setInterval(()=>{
  const now=Date.now();
  rooms.forEach(room=>{
    if(room.state!=='playing') return;
    const dt=(now-room.lastTick)/1000; room.lastTick=now;
    // 회의 중엔 타이머/봉인 정지
    if(room.meeting){
      if(now>=room.meeting.until) tallyMeeting(room);
    }else{
      room.timeLeft-=dt;
      // 봉인 해제
      room.players.forEach(p=>{ if(p.jailed && now>=p.jailUntil){ p.jailed=false;
        p.x=JAIL.x-40; p.y=JAIL.y+JAIL.h/2; send(p.ws,{t:'youReleased'}); } });
      if(room.timeLeft<=0){ endGame(room, false, '⏰ 시간이 다 되었어요! 임포스터의 승리!'); return; }
    }
    // 상태 브로드캐스트
    broadcast(room,{ t:'state',
      players:[...room.players.values()].map(p=>({id:p.id,x:Math.round(p.x),y:Math.round(p.y),face:p.face,jailed:p.jailed})),
      timeLeft:Math.max(0,Math.round(room.timeLeft)), solved:room.solved.size, quizN:room.quizIds.length,
      meeting: room.meeting? Math.max(0,Math.round((room.meeting.until-now)/1000)) : null });
  });
}, 66);

/* ---------- WS 라우팅 ---------- */
wss.on('connection', (ws)=>{
  ws.kind=null; ws.roomId=null; ws.pid=null;
  send(ws,{t:'rooms', rooms:roomList()});
  ws.on('message', (buf)=>{
    let m; try{ m=JSON.parse(buf.toString()); }catch(e){ return; }
    const room=rooms.get(ws.roomId);
    switch(m.t){
      case 'listRooms': send(ws,{t:'rooms', rooms:roomList()}); break;
      case 'join': { const r=rooms.get(m.roomId); if(!r){ send(ws,{t:'error',msg:'방을 찾을 수 없어요.'}); break; } joinRoom(ws, r, m.nick); break; }
      case 'createRoom': {
        if([...rooms.values()].length>=40){ send(ws,{t:'error',msg:'방이 너무 많아요.'}); break; }
        const nm=(m.name||'새 방').slice(0,16); const r=makeRoom(nm,false); joinRoom(ws,r,m.nick); break; }
      case 'ready': if(room) setReady(room, ws.pid, m.ready); break;
      case 'move': if(room && room.state==='playing'){ const p=room.players.get(ws.pid);
        if(p && !p.jailed && !room.meeting){ p.x=Math.max(0,Math.min(WORLD.w,m.x)); p.y=Math.max(0,Math.min(WORLD.h,m.y)); p.face=m.face||1; } } break;
      case 'reqQuiz': if(room) assignQuiz(room, ws.pid); break;
      case 'answer': if(room) answerQuiz(room, ws.pid, m.qid, m.choice); break;
      case 'seal': if(room) doSeal(room, ws.pid); break;
      case 'meeting': if(room) callMeeting(room, ws.pid); break;
      case 'vote': if(room) castVote(room, ws.pid, m.target); break;
      case 'leave': leaveRoom(ws); send(ws,{t:'left'}); send(ws,{t:'rooms',rooms:roomList()}); break;
      // 관리자
      case 'adminLogin':
        if(m.pw===ADMIN_PASSWORD){ ws.kind='admin'; ws.roomId=null; send(ws,{t:'adminOk'}); send(ws, adminSnapshot()); }
        else send(ws,{t:'adminFail'}); break;
      case 'adminState': if(ws.kind==='admin') send(ws, adminSnapshot()); break;
      case 'adminEndAll': if(ws.kind==='admin') adminEndAll(); break;
    }
  });
  ws.on('close', ()=>{ if(ws.pid) leaveRoom(ws); });
});

server.listen(PORT, ()=> console.log('가정 임포스터 서버 실행: http://localhost:'+PORT+'  (관리자: /admin.html)'));
