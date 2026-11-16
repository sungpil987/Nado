(() => {
  const $ = id => document.getElementById(id), colors = 12, saveKey = 'nyangdoku-save-v1';
  let save = loadSave(), puzzle, cells = [], toastTimer, tutorialStep = -1, lastTap = null, pointerPath = null, mistakes = 0, stageFailed = false, clearPending = false, clearTimer = null, undoHistory = [];
  const levelBands=[{start:1,end:10,size:4},{start:11,end:25,size:5},{start:26,end:45,size:6},{start:46,end:70,size:7},{start:71,end:100,size:8},{start:101,end:140,size:9},{start:141,end:185,size:10},{start:186,end:235,size:11},{start:236,end:Infinity,size:12}];
  const levelBand = level => levelBands.find(b=>level>=b.start&&level<=b.end)||levelBands[levelBands.length-1];
  const levelSize = level => levelBand(level).size;
  function stageClues(level){if(level===1)return 2;const band=levelBand(level),size=band.size,span=Number.isFinite(band.end)?band.end-band.start+1:50,progress=Math.min(1,(level-band.start)/Math.max(1,span));const base=size<=5?2:size<=8?3:4;return Math.max(0,base-(progress>=.7?3:progress>=.35?2:progress>=.12?1:0))}
  const regionColor = Array.from({length:12},(_,i)=>`region-${i}`);
  let gameMode='stage',dailyDateKey=null,selectedDateKey=seoulTodayKey(),dailyMonthKey=selectedDateKey.slice(0,7);
  function loadSave(){try{const s=Object.assign({level:1,score:0,hints:2,solved:0,stageCache:{},stageAttempts:{},stageMistakes:{},seenStageKeys:[],dailyPuzzles:{},dailyResults:{},dailyProgress:{},dailyWins:0},JSON.parse(localStorage.getItem(saveKey)||'{}'));if(s.puzzleVersion!==6){s.stageCache={};s.stageAttempts={};s.stageMistakes={};s.seenStageKeys=[];s.puzzleVersion=6}s.stageCache ||= {};s.stageAttempts ||= {};s.stageMistakes ||= {};s.seenStageKeys ||= [];s.dailyPuzzles ||= {};s.dailyResults ||= {};s.dailyProgress ||= {};s.boardProgress ||= {};s.missions ||= {daily:{},weekly:{}};s.attendance ||= {claimed:{},streak:0,last:null};return s}catch{return {level:1,score:0,hints:2,solved:0,stageCache:{},stageAttempts:{},stageMistakes:{},seenStageKeys:[],dailyPuzzles:{},dailyResults:{},dailyProgress:{},dailyWins:0,puzzleVersion:6}}}
  function persist(){localStorage.setItem(saveKey,JSON.stringify(save))}
  function progressKey(){return gameMode==='daily'?'daily:'+dailyDateKey:'stage:'+save.level}
  function puzzleSignature(p){return stageHash(`${p.n}|${p.regions.join(',')}|${p.fixedCats.map(x=>x.join(',')).join(';')}`)}
  function saveBoard(){if(!puzzle)return;save.boardProgress ||= {};save.boardProgress[progressKey()]={signature:puzzleSignature(puzzle),cells:cells.slice(),undo:undoHistory.slice(-150)};persist()}
  function clearBoard(){if(save.boardProgress)delete save.boardProgress[progressKey()];persist()}
  function validPuzzle(p){if(!p||!Number.isInteger(p.n)||p.n<4||p.n>12||!Array.isArray(p.regions)||p.regions.length!==p.n*p.n||!Array.isArray(p.fixedCats)||!Array.isArray(p.solution)||p.solution.length!==p.n)return false;const n=p.n,regions=new Set(p.regions);if(regions.size!==n||p.regions.some(x=>!Number.isInteger(x)||x<0||x>=n))return false;const fixedRows=new Set();const solutionCells=p.solution.map((col,row)=>[row,col,row*n+col]);if(p.solution.some(col=>!Number.isInteger(col)||col<0||col>=n)||!((()=>{const cols=new Set(),regs=new Set();for(const [row,col,i] of solutionCells){if(cols.has(col)||regs.has(p.regions[i])||(row&&Math.abs(p.solution[row-1]-col)<=1))return false;cols.add(col);regs.add(p.regions[i])}return true})()))return false;for(const pair of p.fixedCats){if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||!Number.isInteger(pair[1])||pair[0]<0||pair[0]>=n||pair[1]<0||pair[1]>=n||fixedRows.has(pair[0])||p.solution[pair[0]]!==pair[1])return false;fixedRows.add(pair[0])}return countSolutions(n,p.regions,p.fixedCats)===1}
  function validPlacement(placed){if(placed.length!==puzzle.n)return false;const rows=new Set(),cols=new Set(),regions=new Set();for(const [r,c,i] of placed){if(rows.has(r)||cols.has(c)||regions.has(puzzle.regions[i]))return false;rows.add(r);cols.add(c);regions.add(puzzle.regions[i])}for(let a=0;a<placed.length;a++)for(let b=a+1;b<placed.length;b++)if(Math.abs(placed[a][0]-placed[b][0])<=1&&Math.abs(placed[a][1]-placed[b][1])<=1)return false;return true}
  save.coins=Number.isFinite(save.coins)?save.coins:0;
  save.missions ||= {daily:{},weekly:{}};save.attendance ||= {claimed:{},streak:0,last:null};save.ownedCats ||= ['default'];save.equippedCat ||= 'default';
  if(save.equippedCat==='tuxedo'){save.equippedCat='default';persist()}
  const catCatalog=[
    {id:'cheese',name:'치즈냥이',price:1,file:'cheese.png'},
    {id:'gray',name:'회색냥이',price:1,file:'gray.png'},
    {id:'calico',name:'삼색냥이',price:1,file:'calico.png'},
    {id:'siamese',name:'샴냥이',price:1,file:'siamese.png'},
    {id:'wildgray',name:'야생냥이',price:1,file:'wildgray.png'},
    {id:'tiger',name:'호랑이',price:1,file:'tiger.png'},
    {id:'lion',name:'사자',price:1,file:'lion.png'},
    {id:'leopard',name:'표범',price:1,file:'leopard.png'}
  ];
  const backgroundCatalog=[];
  const markCatalog=[];
  save.ownedMarks ||= ['default'];save.equippedMark ||= 'default';
  save.equippedBackground='default';
  save.equippedMark='default';
  if(!save.cleanHudDefaultApplied){save.equippedBackground='default';save.cleanHudDefaultApplied=true;persist()}
  function applyBackground(){document.body.classList.remove('has-custom-bg');document.body.style.removeProperty('--custom-game-bg')}
  function drawMark(el){el.innerHTML='';const item=markCatalog.find(x=>x.id===save.equippedMark);if(item){const img=document.createElement('img');img.className='mark-skin';img.src=item.file;img.alt='빈칸 표시';img.draggable=false;img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('span'),{className:'cross',textContent:'×'}))};el.appendChild(img)}else{const x=document.createElement('span');x.className='cross';x.textContent='×';el.appendChild(x)}}
  function renderCosmeticShop(type){const isBg=type==='background',grid=$(isBg?'backgroundShopGrid':'markShopGrid'),catalog=isBg?backgroundCatalog:markCatalog,owned=isBg?save.ownedBackgrounds:save.ownedMarks,equipped=isBg?save.equippedBackground:save.equippedMark;grid.innerHTML='';const all=[{id:'default',name:isBg?'기본 배경':'기본 X',price:0,file:null},...catalog];for(const item of all){const has=owned.includes(item.id),active=equipped===item.id,card=document.createElement('div');card.className='cosmetic-card'+(active?' equipped':'');const visual=document.createElement('div');visual.className='cosmetic-preview '+(isBg?'background-preview':'mark-preview');if(item.file){const img=document.createElement('img');img.src=item.file;img.alt=item.name;img.loading='lazy';visual.appendChild(img)}else visual.textContent=isBg?'기본':'×';const title=document.createElement('strong');title.textContent=item.name;const price=document.createElement('small');price.textContent=has?(active?'장착 중':'보유 중'):`🐟 ${item.price}코인`;const btn=document.createElement('button');btn.textContent=active?'장착 완료':has?'장착하기':'구매하기';btn.disabled=active;btn.addEventListener('click',()=>{if(!owned.includes(item.id)){if(save.coins<item.price){showToast('코인이 부족하다냥!');return}if(!confirm(`${item.name}을(를) ${item.price}코인에 구매할까냥?`))return;save.coins-=item.price;owned.push(item.id)}if(isBg){save.equippedBackground=item.id;applyBackground()}else{save.equippedMark=item.id;if(puzzle)cells.forEach((v,i)=>{if(v===1)drawCell(i)})}persist();updateCoins();renderCosmeticShop(type);showToast(`${item.name} 장착 완료다냥!`)});card.append(visual,title,price,btn);grid.appendChild(card)}}
  const selectedCat=()=>catCatalog.find(x=>x.id===save.equippedCat);
  const catImage=()=>selectedCat()?.file||'cat.png';
  function renderCatShop(){const grid=$('catShopGrid');grid.innerHTML='';const all=[{id:'default',name:'기본 냥이',price:0,file:'cat.png'},...catCatalog];for(const cat of all){const owned=save.ownedCats.includes(cat.id),equipped=save.equippedCat===cat.id,card=document.createElement('div');card.className='cat-product'+(equipped?' equipped':'');const img=document.createElement('img');img.src=cat.file;img.alt=cat.name;img.onerror=()=>{img.onerror=null;img.src='cat.png'};const title=document.createElement('strong');title.textContent=cat.name;const price=document.createElement('span');price.textContent=owned?(equipped?'장착 중':'보유 중'):`🐟 ${cat.price.toLocaleString()}코인`;const btn=document.createElement('button');btn.textContent=equipped?'장착 완료':owned?'장착하기':'구매하기';btn.disabled=equipped;btn.addEventListener('click',()=>{if(!save.ownedCats.includes(cat.id)){if(save.coins<cat.price){showToast('코인이 부족하다냥!');return}if(!confirm(`${cat.name}을(를) ${cat.price.toLocaleString()}코인에 구매할까냥?`))return;save.coins-=cat.price;save.ownedCats.push(cat.id)}save.equippedCat=cat.id;persist();updateCoins();renderCatShop();renderCatAppearance();showToast(`${cat.name} 장착 완료다냥!`)});card.append(img,title,price,btn);grid.appendChild(card)}}
  function renderCatAppearance(){document.querySelectorAll('.cell.cat img, .cat-chip img, #gameModalCat, .shop-dialog > img').forEach(img=>{img.src=catImage()})}
  // Mission rewards are claimed manually and never grant hints.
  let missionTab='daily',runHints=0;
  function weekKey(date){const d=new Date(date+'T12:00:00Z'),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10)}
  const missionDefs={
    daily:[{id:'play',name:'퍼즐 1판 클리어',target:1,coins:30},{id:'three',name:'퍼즐 3판 클리어',target:3,coins:60},{id:'clean',name:'실수 없이 1판 클리어',target:1,coins:40}],
    weekly:[{id:'five',name:'퍼즐 5판 클리어',target:5,coins:120},{id:'twenty',name:'퍼즐 20판 클리어',target:20,coins:300},{id:'daily',name:'데일리 챌린지 3일 클리어',target:3,coins:180}]
  };
  function missionBucket(type){const key=type==='daily'?seoulTodayKey():weekKey(seoulTodayKey());save.missions[type] ||= {};save.missions[type][key] ||= {counts:{},claimed:[]};return save.missions[type][key]}
  function recordMissionWin(isDaily,firstDaily,clean){const day=missionBucket('daily'),week=missionBucket('weekly');day.counts.play=(day.counts.play||0)+1;day.counts.three=(day.counts.three||0)+1;if(clean)day.counts.clean=(day.counts.clean||0)+1;week.counts.five=(week.counts.five||0)+1;week.counts.twenty=(week.counts.twenty||0)+1;if(isDaily&&firstDaily&&dailyDateKey===seoulTodayKey())week.counts.daily=(week.counts.daily||0)+1;persist();if(day.counts.play===1||day.counts.three===3||week.counts.five===5)showToast('미션 보상을 확인하라냥!')}
  function renderMissions(){const today=seoulTodayKey(),att=save.attendance,claimed=!!att.claimed[today];$('attendanceStatus').textContent=claimed?'오늘 출석 완료다냥!':'오늘 출석하면 코인을 받는다냥!';$('attendanceClaim').disabled=claimed;$('attendanceClaim').textContent=claimed?'오늘 출석 완료':'출석하고 코인 받기';$('missionStreak').textContent=`연속 출석 ${att.streak||0}일 · 다음 보상 ${Math.min(7,(att.streak||0)+1)*20}코인`;$('dailyMissionTab').classList.toggle('active',missionTab==='daily');$('weeklyMissionTab').classList.toggle('active',missionTab==='weekly');const bucket=missionBucket(missionTab),list=$('missionList');list.innerHTML='';for(const def of missionDefs[missionTab]){const count=Math.min(def.target,bucket.counts[def.id]||0),claimed=bucket.claimed.includes(def.id),row=document.createElement('div');row.className='mission-item';const label=document.createElement('div');label.innerHTML=`<strong>${def.name}</strong><small>${count}/${def.target} · 🐟 ${def.coins}코인</small>`;const btn=document.createElement('button');btn.textContent=claimed?'수령 완료':count>=def.target?'받기':'진행 중';btn.disabled=claimed||count<def.target;btn.addEventListener('click',()=>{if(bucket.claimed.includes(def.id)||(bucket.counts[def.id]||0)<def.target)return;bucket.claimed.push(def.id);save.coins+=def.coins;persist();updateCoins();renderMissions();showToast(`${def.coins}코인을 받았다냥!`)});row.append(label,btn);list.appendChild(row)}}
  function claimAttendance(){const today=seoulTodayKey(),att=save.attendance;if(att.claimed[today])return;const yesterday=shiftDate(today,-1);att.streak=att.last===yesterday?(att.streak||0)+1:1;att.last=today;att.claimed[today]=true;const reward=Math.min(7,att.streak)*20;save.coins+=reward;persist();updateCoins();renderMissions();showToast(`출석 보상 ${reward}코인을 받았다냥!`)}
  function openMissions(){missionTab='daily';renderMissions();$('missionModal').classList.remove('hidden')}
  function updateCoins(){$('coins').textContent=save.coins;$('shopCoins').textContent=save.coins}
  function seededRandom(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
  function stageHash(text){let a=0x811c9dc5,b=0x9e3779b9;for(let i=0;i<text.length;i++){const ch=text.charCodeAt(i);a=Math.imul(a^ch,0x01000193);b=Math.imul(b^ch,0x85ebca6b)}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')}
  function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function solveRows(n,rng){const cols=[];function dfs(r){if(r===n)return true;for(const c of shuffle(Array.from({length:n},(_,i)=>i),rng)){if(cols.includes(c)||(r&&Math.abs(cols[r-1]-c)<=1))continue;cols[r]=c;if(dfs(r+1))return true;cols.pop()}return false}return dfs(0)?cols.slice():null}
  function countSolutions(n,regions,fixedCats){const fixed=Array(n).fill(-1),usedColumns=Array(n).fill(false),usedRegions=Array(n).fill(false),chosen=[];fixedCats.forEach(([r,c])=>fixed[r]=c);let found=0;function visit(r){if(found>1)return;if(r===n){found++;return}const candidates=fixed[r]>=0?[fixed[r]]:Array.from({length:n},(_,c)=>c);for(const c of candidates){const region=regions[r*n+c];if(usedColumns[c]||usedRegions[region]||(r&&Math.abs(chosen[r-1]-c)<=1))continue;usedColumns[c]=true;usedRegions[region]=true;chosen[r]=c;visit(r+1);usedColumns[c]=false;usedRegions[region]=false;if(found>1)return}}visit(0);return found}
  function makeCandidate(n,clueCount,seed){const rng=seededRandom(seed),solution=solveRows(n,rng);if(!solution)return null;const cats=solution.map((c,r)=>[r,c]),biases=Array.from({length:n},()=>rng()*2.8-1.4),regions=Array.from({length:n*n},(_,idx)=>{const r=Math.floor(idx/n),c=idx%n;let best=Infinity,chosen=0;for(let i=0;i<n;i++){const d=(cats[i][0]-r)**2+(cats[i][1]-c)**2+biases[i];if(d<best){best=d;chosen=i}}return chosen});cats.forEach(([r,c],i)=>regions[r*n+c]=i);const palette=shuffle(Array.from({length:n},(_,i)=>i),rng),coloredRegions=regions.map(x=>palette[x]),rows=shuffle(Array.from({length:n},(_,i)=>i),rng).slice(0,clueCount).sort((a,b)=>a-b),fixedCats=rows.map(r=>[r,solution[r]]);if(countSolutions(n,coloredRegions,fixedCats)!==1)return null;return {n,solution,regions:coloredRegions,cats,fixedCats}}
  function sameSolution(a,b){return !!a&&!!b&&a.n===b.n&&a.solution.every((v,i)=>v===b.solution[i])}
  function makePuzzle(level){if(validPuzzle(save.stageCache[level]))return save.stageCache[level];delete save.stageCache[level];const n=levelSize(level),used=new Set(save.seenStageKeys),savedAttempt=save.stageAttempts[level],previous=save.stageCache[level-1];let fallback=null;
    for(let attempt=0;attempt<512;attempt++){if(savedAttempt!==undefined&&attempt!==savedAttempt)continue;const seed=(Math.imul(level,0x9E3779B1)^Math.imul(attempt+1,0x85EBCA77))>>>0,clueCount=stageClues(level),candidate=makeCandidate(n,clueCount,seed);if(!candidate||sameSolution(candidate,previous))continue;const key=stageHash(`${n}|${candidate.solution.join('')}|${candidate.regions.join('')}|${candidate.fixedCats.map(([r,c])=>r*n+c).join('.')}`);if(!fallback)fallback={candidate,attempt,key};if(savedAttempt!==undefined||!used.has(key)){storeStage(level,attempt,key,candidate);return candidate}}
    if(fallback){storeStage(level,fallback.attempt,fallback.key,fallback.candidate);return fallback.candidate}
    for(let clues=stageClues(level)+1;clues<=n;clues++)for(let attempt=0;attempt<512;attempt++){const seed=(Math.imul(level,0x9E3779B1)^Math.imul(attempt+1,0x85EBCA77))>>>0,candidate=makeCandidate(n,clues,seed);if(candidate){const key=stageHash(`recovery|${level}|${clues}|${attempt}`);storeStage(level,attempt,key,candidate);return candidate}}
    throw new Error('유일한 정답을 가진 퍼즐을 생성하지 못했어냥!')
  }
  function storeStage(level,attempt,key,candidate){save.stageAttempts[level]=attempt;if(!save.seenStageKeys.includes(key))save.seenStageKeys.push(key);save.stageCache[level]=candidate;for(const k of Object.keys(save.stageCache))if(Math.abs(Number(k)-level)>12)delete save.stageCache[k];persist()}
  function seoulTodayKey(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v={};parts.forEach(p=>{v[p.type]=p.value});return `${v.year}-${v.month}-${v.day}`}
  function shiftDate(key,amount){const [y,m,d]=key.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+amount));return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`}
  function dailySkill(){const recent=Object.keys(save.dailyResults).sort().slice(-7).map(k=>save.dailyResults[k]).filter(x=>Number.isFinite(x.mistakes));let tier=Math.min(5,Math.floor((save.solved+(save.dailyWins||0))/3));if(recent.length>=3){const avg=recent.reduce((s,x)=>s+x.mistakes,0)/recent.length,failRate=recent.filter(x=>x.failed).length/recent.length;if(avg<=0.25&&failRate===0)tier++;else if(avg>=2||failRate>=0.34)tier--}return Math.max(0,Math.min(5,tier))}
  function dailySize(dateKey){
    const seed=parseInt(stageHash(`daily-size-v6|${dateKey}`).slice(0,8),16)>>>0;
    return 9+(seed%4);
  }
  function dailyPuzzle(dateKey){
    const cached=save.dailyPuzzles[dateKey];
    // Keep previously started or completed daily puzzles stable across updates.
    if(cached?.puzzle&&cached.puzzle.n>=9&&cached.puzzle.n<=12&&validPuzzle(cached.puzzle))return cached.puzzle;
    delete save.dailyPuzzles[dateKey];
    const n=dailySize(dateKey),tier=n-9,clueCount=n<=10?1:2;
    const seedBase=parseInt(stageHash(`${dateKey}|${n}|daily-v7-hard`).slice(0,8),16)>>>0;
    const used=new Set(save.seenStageKeys),previous=save.dailyPuzzles[shiftDate(dateKey,-1)]?.puzzle;
    for(let attempt=0;attempt<512;attempt++){
      const seed=(seedBase+Math.imul(attempt+1,0x9E3779B1))>>>0;
      const candidate=makeCandidate(n,clueCount,seed);
      if(!candidate||sameSolution(candidate,previous))continue;
      const key=stageHash(`daily|${n}|${candidate.solution.join('')}|${candidate.regions.join('')}|${candidate.fixedCats.map(([r,c])=>r*n+c).join('.')}`);
      if(used.has(key))continue;
      save.dailyPuzzles[dateKey]={puzzle:candidate,tier,key};
      save.seenStageKeys.push(key);persist();return candidate;
    }
    for(let clues=clueCount+1;clues<=n;clues++){
      for(let attempt=0;attempt<512;attempt++){
        const candidate=makeCandidate(n,clues,(seedBase+Math.imul(attempt+1,0x9E3779B1))>>>0);
        if(!candidate)continue;
        save.dailyPuzzles[dateKey]={puzzle:candidate,tier,key:stageHash(`daily-fallback-v7|${dateKey}|${n}|${clues}|${attempt}`)};
        persist();return candidate;
      }
    }
    throw new Error('데일리 퍼즐 생성에 실패했다냥!');
  }
  function render(){clearTimeout(clearTimer);clearPending=false;const isDaily=gameMode==='daily';puzzle=isDaily?dailyPuzzle(dailyDateKey):makePuzzle(save.level);cells=Array.from({length:puzzle.n*puzzle.n},()=>0);mistakes=isDaily?(save.dailyProgress[dailyDateKey]?.mistakes||0):(save.stageMistakes[save.level]||0);stageFailed=false;$('screenHeading').textContent=isDaily?'데일리 챌린지':`레벨 ${save.level}`;$('score').textContent=save.score;$('hints').textContent=save.hints;$('levelInfo').textContent=isDaily?`${dateLabel(dailyDateKey)} · ${puzzle.n} × ${puzzle.n} · 데일리 챌린지`:`${puzzle.n} × ${puzzle.n} · 힌트 고양이 ${puzzle.fixedCats.length}마리`;updateHearts();
    const board=$('board');board.innerHTML='';board.style.gridTemplateColumns=`repeat(${puzzle.n},minmax(0,1fr))`;board.style.gridTemplateRows=`repeat(${puzzle.n},minmax(0,1fr))`;board.style.gap=puzzle.n>=8?'3px':'5px';
    for(let i=0;i<puzzle.n*puzzle.n;i++){const r=Math.floor(i/puzzle.n),c=i%puzzle.n,el=document.createElement('button');el.className=`cell ${regionColor[puzzle.regions[i]%colors]}`;el.setAttribute('role','gridcell');el.setAttribute('aria-label',`행 ${r+1}, 열 ${c+1}`);el.dataset.i=i;board.appendChild(el)}
    puzzle.fixedCats.forEach(([r,c])=>{const i=r*puzzle.n+c;cells[i]=2;drawCell(i);$('board').children[i].classList.add('locked');$('board').children[i].setAttribute('aria-label',`행 ${r+1}, 열 ${c+1}, 고정 힌트 고양이`)});
    undoHistory=[];const progress=save.boardProgress?.[progressKey()];if(progress?.signature===puzzleSignature(puzzle)&&Array.isArray(progress.cells)&&progress.cells.length===cells.length){const locked=new Set(puzzle.fixedCats.map(([r,c])=>r*puzzle.n+c));if(progress.cells.every((v,i)=>(v===0||v===1||v===2)&&(!locked.has(i)||v===2))){cells=progress.cells.slice();undoHistory=Array.isArray(progress.undo)?progress.undo.filter(x=>Number.isInteger(x.i)&&x.i>=0&&x.i<cells.length&&!locked.has(x.i)&&[0,1,2].includes(x.previous)&&[0,1,2].includes(x.value)).slice(-150):[];cells.forEach((_,i)=>drawCell(i))}}else if(progress){delete save.boardProgress[progressKey()]}
    requestAnimationFrame(()=>{board.style.height=`${board.clientWidth}px`});renderCatAppearance();$('caption').textContent='한 번 터치 X · 두 번 터치 고양이 · 드래그 X다냥!';persist();if(!save.tutorialDone)showTutorial();if(mistakes>=3)failStage();}
  function isFixed(i){return puzzle.fixedCats.some(([r,c])=>r*puzzle.n+c===i)}
  function activateCell(i){if(stageFailed)return;if(isFixed(i)){showToast('이 고양이는 퍼즐에 있는 힌트야');return}const now=Date.now();if(lastTap&&lastTap.i===i&&now-lastTap.time<360){lastTap=null;setCell(i,2);return}lastTap={i,time:now};setCell(i,cells[i]===1?0:1)}
  function paintCross(i){if(i<0||isFixed(i)||cells[i]===2||cells[i]===1)return;setCell(i,1,false)}
  function showWrongMove(i){
    const cell=$('board').children[i];
    if(!cell)return;
    cell.classList.remove('mistake-flash');
    cell.querySelectorAll('.wrong-x').forEach(x=>x.remove());
    const mark=document.createElement('span');
    mark.className='wrong-x';
    mark.textContent='✕';
    mark.setAttribute('aria-hidden','true');
    cell.appendChild(mark);
    void cell.offsetWidth;
    cell.classList.add('mistake-flash');
    setTimeout(()=>{mark.remove();cell.classList.remove('mistake-flash')},950);
  }
  let xAudioContext=null,lastXSoundAt=0;
  function playXSound(){
    const now=performance.now();
    if(now-lastXSoundAt<75)return;
    lastXSoundAt=now;
    try{
      const AudioContextType=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextType)return;
      if(!xAudioContext)xAudioContext=new AudioContextType();
      if(xAudioContext.state==='suspended')xAudioContext.resume().catch(()=>{});
      const t=xAudioContext.currentTime,osc=xAudioContext.createOscillator(),gain=xAudioContext.createGain();
      osc.type='sine';
      osc.frequency.setValueAtTime(620,t);
      osc.frequency.exponentialRampToValueAtTime(410,t+.055);
      gain.gain.setValueAtTime(.0001,t);
      gain.gain.exponentialRampToValueAtTime(.045,t+.008);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.075);
      osc.connect(gain);gain.connect(xAudioContext.destination);
      osc.start(t);osc.stop(t+.08);
    }catch{}
  }
  function animateXMark(i,added){
    const cell=$('board').children[i];
    if(!cell)return;
    cell.classList.remove('x-mark-pop','x-mark-clear');
    void cell.offsetWidth;
    cell.classList.add(added?'x-mark-pop':'x-mark-clear');
    setTimeout(()=>cell.classList.remove('x-mark-pop','x-mark-clear'),190);
    if(added)playXSound();
  }
  let lastGameSoundAt=0;
  function gameTone(kind){
    const now=performance.now();
    if(now-lastGameSoundAt<65&&kind!=='wrong')return;
    lastGameSoundAt=now;
    try{
      const AudioContextType=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextType)return;
      if(!xAudioContext)xAudioContext=new AudioContextType();
      if(xAudioContext.state==='suspended')xAudioContext.resume().catch(()=>{});
      const ctx=xAudioContext,t=ctx.currentTime;
      const tones={
        cat:[[520,780,.12,.055],[780,980,.1,.035]],
        wrong:[[240,125,.18,.075]],
        undo:[[440,330,.08,.028]],
        hint:[[620,900,.16,.042],[900,1240,.17,.032]],
        win:[[523,659,.12,.04],[659,784,.13,.04],[784,1046,.22,.05]]
      };
      let offset=0;
      for(const [from,to,duration,volume] of tones[kind]||[]){
        const osc=ctx.createOscillator(),gain=ctx.createGain(),at=t+offset;
        osc.type=kind==='wrong'?'triangle':'sine';
        osc.frequency.setValueAtTime(from,at);
        osc.frequency.exponentialRampToValueAtTime(to,at+duration);
        gain.gain.setValueAtTime(.0001,at);
        gain.gain.exponentialRampToValueAtTime(volume,at+.012);
        gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start(at);osc.stop(at+duration+.012);
        offset+=duration*.72;
      }
    }catch{}
  }
  function gameCellFeedback(i,kind){
    const el=$('board').children[i];
    if(!el)return;
    const cls=kind==='cat'?'cat-placed':'cell-undo-pop';
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(()=>el.classList.remove(cls),360);
  }
  function setCell(i,value,check=true){
    if(stageFailed||clearPending||mistakes>=3||isFixed(i))return;
    const previous=cells[i];
    if(value===2&&previous===2)value=0;
    if(previous===value)return;
    const wrongCat=value===2&&puzzle.solution[Math.floor(i/puzzle.n)]!==i%puzzle.n;
    if(wrongCat){
      mistakes++;
      if(gameMode==='daily'){
        save.dailyProgress[dailyDateKey]={mistakes};
        save.dailyResults[dailyDateKey]={completed:false,mistakes};
      }else save.stageMistakes[save.level]=mistakes;
      persist();
      updateHearts();
      showWrongMove(i);
      gameTone('wrong');
      $('caption').textContent=mistakes>=3?'틀렸어! 기회가 모두 끝났어.':`틀렸어! 빨간 X · 남은 기회 ${3-mistakes}번`;
      showToast(mistakes>=3?'틀렸어! 마지막 기회를 사용했어':`틀렸어! 남은 기회 ${3-mistakes}번`);
      if(mistakes>=3)setTimeout(()=>{if(!stageFailed)failStage()},900);
      return;
    }
    undoHistory.push({i,previous,value});
    if(undoHistory.length>150)undoHistory.shift();
    cells[i]=value;
    drawCell(i);
    if(value===1||previous===1)animateXMark(i,value===1);
    if(value===2){gameCellFeedback(i,'cat');gameTone('cat')}
    saveBoard();
    if(check)validate();
  }
  function updateHearts(){$('hearts').classList.remove('heart-pulse');void $('hearts').offsetWidth;$('hearts').classList.add('heart-pulse');$('hearts').textContent='♥ '.repeat(Math.max(0,3-mistakes))+'♡ '.repeat(Math.min(3,mistakes)).trim();$('hearts').setAttribute('aria-label',`남은 실수 기회 ${Math.max(0,3-mistakes)}회`)}
  function failStage(){stageFailed=true;if(gameMode==='daily')save.dailyResults[dailyDateKey]={completed:false,mistakes,failed:true};$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modalTitle').textContent='기회가 끝났다냥!';$('modalText').textContent='세 번 실수했다냥. 같은 퍼즐에 다시 도전하라냥!';$('modalButton').textContent='다시 도전하냥';persist();$('modal').classList.remove('hidden')}
  function restartStage(){clearTimeout(clearTimer);clearPending=false;clearBoard();undoHistory=[];if(gameMode==='daily'){save.dailyProgress[dailyDateKey]={mistakes:0};delete save.dailyResults[dailyDateKey]}else save.stageMistakes[save.level]=0;persist();$('modal').classList.add('hidden');render();showToast('같은 퍼즐을 다시 시작했어')}
  function cellAtPoint(x,y){const el=document.elementFromPoint(x,y)?.closest('.cell');return el&&$('board').contains(el)?Number(el.dataset.i):-1}
  function boardPointerDown(e){const el=e.target.closest('.cell');if(!el||pointerPath||stageFailed)return;e.preventDefault();const i=Number(el.dataset.i);pointerPath={id:e.pointerId,start:i,last:i,dragged:false};try{$('board').setPointerCapture(e.pointerId)}catch{}}
  function boardPointerMove(e){if(!pointerPath||stageFailed||pointerPath.id!==e.pointerId)return;const i=cellAtPoint(e.clientX,e.clientY);if(i<0||i===pointerPath.last)return;pointerPath.dragged=true;lastTap=null;paintCross(pointerPath.start);paintCross(pointerPath.last);paintCross(i);pointerPath.last=i}
  function boardPointerUp(e){if(!pointerPath||pointerPath.id!==e.pointerId)return;const state=pointerPath,i=cellAtPoint(e.clientX,e.clientY);pointerPath=null;if(state.dragged){paintCross(state.start);paintCross(state.last);if(i>=0)paintCross(i)}else activateCell(i>=0?i:state.start)}
  function drawCell(i){const el=$('board').children[i];el.innerHTML='';el.classList.remove('cat','error');if(cells[i]===1){drawMark(el)}else if(cells[i]===2){const img=document.createElement('img');img.src=catImage();img.alt='고양이';el.appendChild(img);el.classList.add('cat')}}
  function validate(){const placed=[];cells.forEach((v,i)=>{if(v===2)placed.push([Math.floor(i/puzzle.n),i%puzzle.n,i])});$('board').querySelectorAll('.cell').forEach(el=>el.classList.remove('error'));let bad=new Set();for(let a=0;a<placed.length;a++){const [r,c,i]=placed[a];for(let b=a+1;b<placed.length;b++){const [rr,cc,j]=placed[b];if(r===rr||c===cc||puzzle.regions[i]===puzzle.regions[j]||(Math.abs(r-rr)<=1&&Math.abs(c-cc)<=1)){bad.add(i);bad.add(j)}}if(placed.length===puzzle.n&&!validPlacement(placed))bad.add(i)}
    bad.forEach(i=>$('board').children[i].classList.add('error'));if(bad.size){showToast('이 배치로는 답이 안 맞아. 빨간 칸을 다시 확인해봐');$('caption').textContent='정답이 아니거나 규칙이 겹친 칸을 살펴봐';return}
    if(placed.length===puzzle.n&&validPlacement(placed))finish()}
  function celebrate(){document.querySelectorAll('.cell.cat').forEach((el,i)=>{el.classList.remove('celebrate-cat');el.style.setProperty('--celebrate-delay',`${i*45}ms`);void el.offsetWidth;el.classList.add('celebrate-cat')});const layer=document.createElement('div');layer.className='confetti-layer';layer.setAttribute('aria-hidden','true');const palette=['#f3be4f','#eaa7c6','#67b3db','#a9d48e','#b4a6df','#fff'];for(let i=0;i<70;i++){const piece=document.createElement('i');piece.style.setProperty('--x',`${Math.random()*100}vw`);piece.style.setProperty('--delay',`${Math.random()*220}ms`);piece.style.setProperty('--duration',`${1.4+Math.random()*.9}s`);piece.style.setProperty('--spin',`${Math.floor(Math.random()*900-450)}deg`);piece.style.setProperty('--piece-color',palette[i%palette.length]);layer.appendChild(piece)}document.body.appendChild(layer);setTimeout(()=>layer.remove(),3500);$('modal').classList.add('celebration-modal');setTimeout(()=>$('modal').classList.remove('celebration-modal'),900)}
  function finish(){if(!clearPending){clearPending=true;gameTone('win');clearBoard();const wasDaily=gameMode==='daily',alreadyWon=wasDaily&&save.dailyResults[dailyDateKey]?.completed;if(!wasDaily)save.solved++;else if(!alreadyWon){save.dailyWins=(save.dailyWins||0)+1;save.dailyResults[dailyDateKey]={completed:true,mistakes};save.dailyProgress[dailyDateKey]={mistakes,completed:true}}const coinReward=(!wasDaily||!alreadyWon)?puzzle.n*10:0;if(coinReward)recordMissionWin(wasDaily,!alreadyWon,mistakes===0);if(coinReward){save.score+=puzzle.n*100;save.coins+=coinReward}persist();$('score').textContent=save.score;$('hints').textContent=save.hints;updateCoins();$('caption').textContent=wasDaily?'챌린지를 완료했다냥!':'완벽하다냥!';$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modalTitle').textContent=wasDaily?'챌린지 완료다냥!':'참 잘했다냥!';$('modalText').textContent=wasDaily?`${dateLabel(dailyDateKey)} 완료! 🐟 ${coinReward}코인을 얻었다냥!`:`레벨 ${save.level} 클리어! 🐟 ${coinReward}코인을 얻었다냥!`;$('modalButton').textContent=wasDaily?'달력으로':'다음 레벨 →';celebrate();clearTimer=setTimeout(()=>{$('modal').classList.remove('hidden');$('modal').classList.add('reward-pop');setTimeout(()=>$('modal').classList.remove('reward-pop'),850)},1000)}}
  function showToast(msg){const el=$('toast');el.textContent=msg.endsWith('냥!')?msg:msg.replace(/[.! ]+$/,'')+'다냥!';el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1900)}
  let milestoneAdPending=false;
  function advanceStage(){milestoneAdPending=false;clearPending=false;clearBoard();save.level++;persist();$('modal').classList.add('hidden');render()}
  window.nadoAdvanceLevel=()=>{if(milestoneAdPending)advanceStage()};
  function next(){if(!clearPending||milestoneAdPending)return;if(gameMode==='daily'){goDailyCalendar();return}if(!adFree&&save.level%10===0&&window.NyangdokuAds?.showInterstitialAtMilestone){milestoneAdPending=true;window.NyangdokuAds.showInterstitialAtMilestone();return}advanceStage()}
  function dailyDifficultyName(tier){return ['새싹','초보','보통','숙련','고수','냥고수'][Math.max(0,Math.min(5,tier))]}
  function dateLabel(key){const [y,m,d]=key.split('-').map(Number);return `${m}/${d}/${String(y).slice(-2)}`}
  function monthLength(y,m){return new Date(y,m,0).getDate()}
  function renderDailyCalendar(){const [y,m]=dailyMonthKey.split('-').map(Number),today=seoulTodayKey(),days=monthLength(y,m),first=new Date(y,m-1,1).getDay(),grid=$('calendarGrid');$('dailyYear').textContent=y;$('dailyMonthTitle').textContent=`${m}월`;grid.innerHTML='';const completed=Object.keys(save.dailyResults).filter(k=>k.startsWith(dailyMonthKey+'-')&&save.dailyResults[k]?.completed).length,goals=[10,20,days];$('monthlyCount').textContent=`${completed}/${days}`;$('trophyFill').style.width=`${Math.min(100,completed/days*100)}%`;document.querySelectorAll('.milestone').forEach((el,i)=>{el.querySelector('b').textContent=goals[i];el.classList.toggle('earned',completed>=goals[i])});$('nextMonth').disabled=dailyMonthKey>=today.slice(0,7);
    for(let i=0;i<first;i++){const blank=document.createElement('span');blank.className='calendar-blank';grid.appendChild(blank)}for(let day=1;day<=days;day++){const key=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,button=document.createElement('button');button.className='calendar-day';button.textContent=day;button.disabled=key>today;button.setAttribute('aria-label',`${y}년 ${m}월 ${day}일${save.dailyResults[key]?.completed?' 완료':''}`);if(key===selectedDateKey)button.classList.add('selected');if(save.dailyResults[key]?.completed){button.classList.add('completed');button.setAttribute('aria-label',`${y}년 ${m}월 ${day}일 도전 완료`)}if(key>today)button.classList.add('future');button.addEventListener('click',()=>{selectedDateKey=key;renderDailyCalendar()});grid.appendChild(button)}
    $('dailySelectedLabel').textContent=`${Number(selectedDateKey.slice(5,7))}/${Number(selectedDateKey.slice(8,10))}/${selectedDateKey.slice(2,4)}`;$('dailyDifficulty').textContent=`오늘의 도전 · ${save.dailyPuzzles[selectedDateKey]?.puzzle?.n||dailySize(selectedDateKey)}×${save.dailyPuzzles[selectedDateKey]?.puzzle?.n||dailySize(selectedDateKey)}`;$('dailyContinue').disabled=selectedDateKey>today;$('dailyContinue').textContent=save.dailyResults[selectedDateKey]?.completed?'완료 · 다시 도전':'계속하기';$('dailySelectedLabel').textContent+=save.dailyResults[selectedDateKey]?.completed?'  ✓ 완료':'';}
  function openDailyCalendar(){const today=seoulTodayKey();if(selectedDateKey>today)selectedDateKey=today;if(dailyMonthKey>today.slice(0,7))dailyMonthKey=today.slice(0,7);$('dailyScreen').classList.remove('hidden');renderDailyCalendar()}
  function leaveCalendar(){ $('dailyScreen').classList.add('hidden');gameMode='stage';dailyDateKey=null;render() }
  function goDailyCalendar(){ $('modal').classList.add('hidden');gameMode='stage';dailyDateKey=null;openDailyCalendar();render() }
  function startDaily(){if(selectedDateKey>seoulTodayKey())return;dailyDateKey=selectedDateKey;gameMode='daily';$('dailyScreen').classList.add('hidden');$('modal').classList.add('hidden');render()}
  function shiftMonth(amount){const [y,m]=dailyMonthKey.split('-').map(Number),d=new Date(Date.UTC(y,m-1+amount,1));dailyMonthKey=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;const days=monthLength(d.getUTCFullYear(),d.getUTCMonth()+1);selectedDateKey=`${dailyMonthKey}-${String(Math.min(days,amount>0?Number(seoulTodayKey().slice(-2)):days)).padStart(2,'0')}`;if(selectedDateKey>seoulTodayKey())selectedDateKey=seoulTodayKey();renderDailyCalendar()}
  function dailyInfo(){const toast=$('dailyInfoToast');toast.textContent='매일 9×9~12×12 랜덤 도전! 초록색 체크 날짜는 완료한 날이야.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
  const tutorialPages=[
    {title:'냥도쿠에 온 걸 환영한다냥!',body:'목표는 <b>모든 행, 모든 열, 모든 색 구역에 고양이를 딱 한 마리씩</b> 놓는 거다냥! 아래 예시를 보면서 천천히 배워보자냥.',demo:'intro'},
    {title:'① 한 줄에 한 마리다냥!',body:'고양이가 이미 있는 <b>가로줄(행)</b>에는 다른 고양이를 놓을 수 없다냥. 고양이가 있는 줄을 먼저 지워보면 선택지가 확 줄어든다냥!',demo:'row'},
    {title:'② 세로줄도 한 마리다냥!',body:'고양이가 있는 <b>세로줄(열)</b>에도 추가로 놓으면 안 된다냥. 가로줄과 세로줄을 함께 제외하면 후보 칸이 줄어든다냥!',demo:'col'},
    {title:'③ 같은 색도 한 마리다냥!',body:'칸의 색은 하나의 <b>구역</b>을 뜻한다냥. 같은 색 칸에 고양이 두 마리는 금지다냥! 모양이 떨어져 있어도 색이 같으면 같은 구역이다냥.',demo:'color'},
    {title:'④ 바로 옆도 안 된다냥!',body:'고양이는 <b>가로·세로·대각선으로 맞닿으면</b> 안 된다냥. 특히 대각선으로 붙은 칸도 금지라는 걸 꼭 기억하라냥!',demo:'neighbor'},
    {title:'⑤ 왜 여기에 놓을까냥?',body:'예시에서 <b>❌ 표시된 칸은 규칙 때문에 불가능</b>하다냥. 남은 <b>반짝이는 칸</b>이 그 줄의 유일한 후보라면 거기에 고양이를 놓는 거다냥. 무작정 찍지 말고 하나씩 제외하라냥!',demo:'reason'},
    {title:'⑥ 이제 직접 해보자냥!',body:'<b>한 번 터치</b>하면 고양이가 없는 칸에 X를 표시한다냥. <b>빠르게 두 번 터치</b>하면 고양이를 놓는다냥. <b>드래그</b>하면 여러 칸에 X를 칠 수 있다냥. 실수 기회는 세 번이다냥!',demo:'controls'}
  ];
  function showTutorial(){tutorialStep=0;updateTutorial();$('modal').classList.remove('hidden')}
  function updateTutorial(){const page=tutorialPages[tutorialStep];$('modalTitle').textContent=page.title;$('modalText').innerHTML=page.body;$('modalButton').textContent=tutorialStep===tutorialPages.length-1?'퍼즐 시작하냥!':'다음 설명이다냥 →';$('tutorialCounter').classList.remove('hidden');$('tutorialCounter').textContent=`${tutorialStep+1} / ${tutorialPages.length}`;const demo=$('tutorialDemo');demo.classList.remove('hidden');demo.innerHTML='';const regions=[0,0,1,1,0,2,2,1,3,2,2,1,3,3,3,1];for(let i=0;i<16;i++){const r=Math.floor(i/4),col=i%4,cat=i===1,el=document.createElement('div');el.className='demo-cell region-'+regions[i];let mark='';if(cat)mark='🐱';else if(page.demo==='row'&&r===0)mark='×';else if(page.demo==='col'&&col===1)mark='×';else if(page.demo==='color'&&regions[i]===0)mark='×';else if(page.demo==='neighbor'&&[0,2,4,5,6].includes(i))mark='×';else if(page.demo==='reason'&&[0,2,4,5,6,8,9,10,12,13,14].includes(i))mark='×';else if(page.demo==='reason'&&i===11){mark='?';el.classList.add('candidate')}else if(page.demo==='controls'&&[4,8,12].includes(i))mark='×';el.textContent=mark;demo.appendChild(el)}}
  function advanceModal(){if(stageFailed){restartStage();return}if(tutorialStep>=0){tutorialStep++;if(tutorialStep<tutorialPages.length){updateTutorial();return}tutorialStep=-1;save.tutorialDone=true;persist();$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modal').classList.add('hidden');return}if(clearPending){next();return}$('modal').classList.add('hidden')}
  let adFree=false;
  let rewardBusy=false;
  const rewardKey=()=>gameMode==='daily'?'daily:'+dailyDateKey:'stage:'+save.level;
  window.onAdFreeStatus=owned=>{adFree=!!owned;updateShop()};
  window.onBillingMessage=message=>showToast(message);
  function updateShop(){const label=$('purchaseAdsBtn');if(label)label.textContent=adFree?'광고 제거 구매 완료':'광고 제거 영구 구매 · ₩3,900';const reward=$('rewardHintBtn');if(reward)reward.textContent=adFree?'무료 힌트 +2 (한 판 1회)':'광고 보고 힌트 +2'}
  let shopTab='cats';
  function selectShopTab(tab){shopTab=tab;const ids={cats:'Cats',extras:'Extras'};for(const [key,suffix] of Object.entries(ids)){const active=key===tab;$('shopTab'+suffix).classList.toggle('active',active);$('shopTab'+suffix).setAttribute('aria-selected',String(active));$('shopPanel'+suffix).classList.toggle('hidden',!active)}$('shopScrollTop')?.scrollTo?.({top:0,behavior:'instant'});const scroll=document.querySelector('.shop-scroll');if(scroll)scroll.scrollTop=0}
  function showShop(){updateCoins();renderCatAppearance();$('shopModal').classList.remove('hidden');renderCatShop();updateShop();selectShopTab(shopTab);window.NyangdokuAds?.isAdFree?.()}
  function rewardHints(){if(rewardBusy)return;if(adFree){if(save.freeHintClaimed?.[rewardKey()]){showToast('이번 판 무료 힌트는 이미 받았어');return}save.freeHintClaimed ||= {};save.freeHintClaimed[rewardKey()]=true;save.hints+=2;persist();$('hints').textContent=save.hints;showToast('무료 힌트 2개 획득!');return}if(!window.NyangdokuAds?.showRewardedAd){showToast('Android 앱에서 이용할 수 있어');return}rewardBusy=true;window.NyangdokuAds.showRewardedAd('hint')}
  function getHint(){if(stageFailed||clearPending)return;const options=puzzle.cats.map(([r,c])=>r*puzzle.n+c).filter(i=>cells[i]!==2);if(!options.length){showToast('이미 모든 고양이를 찾았다냥!');return}if(save.hints>0){save.hints--;persist();$('hints').textContent=save.hints;revealHint();return}showToast('힌트가 없다냥! 상점에서 광고를 보고 충전하라냥!');showShop()}
  function revealHint(){const options=puzzle.cats.map(([r,c])=>r*puzzle.n+c).filter(i=>cells[i]!==2);if(!options.length){showToast('모든 고양이를 이미 찾았어!');return}const i=options[0];setCell(i,2);gameTone('hint');$('board').children[i]?.classList.add('hint-glow');setTimeout(()=>$('board').children[i]?.classList.remove('hint-glow'),1400);$('caption').textContent='빛나는 칸에 힌트 고양이가 나타났다냥!';showToast('힌트 고양이 발견!')}
  window.onRewardedAd=kind=>{rewardBusy=false;if(kind==='hint'){save.hints+=2;persist();$('hints').textContent=save.hints;showToast('힌트 2개 획득!')}else if(kind==='double'){save.score+=puzzle.n*100;persist();$('score').textContent=save.score;showToast('점수 두 배 보상을 받았어!')}};
  window.onAdUnavailable=()=>{rewardBusy=false;showToast('광고가 아직 준비되지 않았어. 잠시 후 다시 눌러줘')};
  $('missionBtn').addEventListener('click',openMissions);$('missionCloseX').addEventListener('click',()=> $('missionModal').classList.add('hidden'));$('attendanceClaim').addEventListener('click',claimAttendance);$('dailyMissionTab').addEventListener('click',()=>{missionTab='daily';renderMissions()});$('weeklyMissionTab').addEventListener('click',()=>{missionTab='weekly';renderMissions()});for(const [tab,suffix] of Object.entries({cats:'Cats',extras:'Extras'}))$('shopTab'+suffix).addEventListener('click',()=>selectShopTab(tab));$('shopBtn').addEventListener('click',showShop);const closeShop=()=> $('shopModal').classList.add('hidden');$('closeShopBtn').addEventListener('click',closeShop);$('shopCloseX').addEventListener('click',closeShop);$('purchaseAdsBtn').addEventListener('click',()=>window.NyangdokuAds?.buyRemoveAds?.());$('restoreAdsBtn').addEventListener('click',()=>window.NyangdokuAds?.restorePurchases?.());$('rewardHintBtn').addEventListener('click',rewardHints);window.NyangdokuAds?.isAdFree?.();
  $('hintBtn').addEventListener('click',getHint);$('undoBtn').addEventListener('click',()=>{if(stageFailed||clearPending)return;const move=undoHistory.pop();if(!move){showToast('되돌릴 기록이 없다냥!');return}cells[move.i]=move.previous;drawCell(move.i);gameCellFeedback(move.i,'undo');gameTone('undo');saveBoard();validate();$('caption').textContent='마지막 입력을 되돌렸다냥!'});$('modalButton').addEventListener('click',advanceModal);$('gameCloseX').addEventListener('click',()=>{if(tutorialStep>=0){tutorialStep=-1;save.tutorialDone=true;persist();$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modal').classList.add('hidden');return}advanceModal()});$('settingsBtn').addEventListener('click',()=>showToast('진행 상황은 이 기기에 자동 저장돼'));
  $('dailyBtn').addEventListener('click',openDailyCalendar);$('dailyBack').addEventListener('click',leaveCalendar);$('dailyContinue').addEventListener('click',startDaily);$('dailyInfo').addEventListener('click',dailyInfo);$('monthlyTrophyBtn').addEventListener('click',dailyInfo);$('prevMonth').addEventListener('click',()=>shiftMonth(-1));$('nextMonth').addEventListener('click',()=>shiftMonth(1));
  const boardElement=$('board');boardElement.addEventListener('pointerdown',boardPointerDown);boardElement.addEventListener('pointermove',boardPointerMove);boardElement.addEventListener('pointerup',boardPointerUp);boardElement.addEventListener('pointercancel',()=>{pointerPath=null});
  const studioSplash=$('studioSplash');if(studioSplash){setTimeout(()=>{studioSplash.classList.add('studio-splash-out');setTimeout(()=>studioSplash.remove(),650)},1350)}
  applyBackground();window.addEventListener('resize',()=>{const board=$('board');if(board.clientWidth)board.style.height=`${board.clientWidth}px`});render();
})();
