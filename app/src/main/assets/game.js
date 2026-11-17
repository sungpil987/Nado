(() => {
  const $ = id => document.getElementById(id), colors = 12, saveKey = 'nyangdoku-save-v1';
  let save = loadSave(), puzzle, cells = [], toastTimer, tutorialStep = -1, lastTap = null, pointerPath = null, mistakes = 0, stageFailed = false, clearPending = false, clearTimer = null, undoHistory = [];
  const levelBands=[{start:1,end:10,size:4},{start:11,end:25,size:5},{start:26,end:45,size:6},{start:46,end:70,size:7},{start:71,end:100,size:8},{start:101,end:140,size:9},{start:141,end:185,size:10},{start:186,end:235,size:11},{start:236,end:Infinity,size:12}];
  const levelBand = level => levelBands.find(b=>level>=b.start&&level<=b.end)||levelBands[levelBands.length-1];
  const levelSize = level => levelBand(level).size;
  function stageClues(level){if(level===1)return 2;const band=levelBand(level),size=band.size,span=Number.isFinite(band.end)?band.end-band.start+1:50,progress=Math.min(1,(level-band.start)/Math.max(1,span));const base=size<=5?2:size<=8?3:4;return Math.max(1,base-(progress>=.7?3:progress>=.35?2:progress>=.12?1:0))}
  const regionColor = Array.from({length:12},(_,i)=>`region-${i}`);
  let gameMode='stage',dailyDateKey=null,selectedDateKey=seoulTodayKey(),dailyMonthKey=selectedDateKey.slice(0,7);
  function loadSave(){try{const s=Object.assign({level:1,score:0,hints:2,solved:0,stageCache:{},stageAttempts:{},stageMistakes:{},seenStageKeys:[],dailyPuzzles:{},dailyResults:{},dailyProgress:{},dailyWins:0},JSON.parse(localStorage.getItem(saveKey)||'{}'));if(s.puzzleVersion!==6){s.stageCache={};s.stageAttempts={};s.stageMistakes={};s.seenStageKeys=[];s.puzzleVersion=6}s.stageCache ||= {};s.stageAttempts ||= {};s.stageMistakes ||= {};s.seenStageKeys ||= [];s.dailyPuzzles ||= {};s.dailyResults ||= {};s.dailyProgress ||= {};s.boardProgress ||= {};if(s.qualityVersion!==1){const key='stage:'+s.level;if(!s.boardProgress[key]?.cells?.some(v=>v!==0)){delete s.stageCache[s.level];delete s.stageAttempts[s.level]}s.qualityVersion=1}s.missions ||= {daily:{},weekly:{}};s.attendance ||= {claimed:{},streak:0,last:null};return s}catch{return {level:1,score:0,hints:2,solved:0,stageCache:{},stageAttempts:{},stageMistakes:{},seenStageKeys:[],dailyPuzzles:{},dailyResults:{},dailyProgress:{},dailyWins:0,puzzleVersion:6}}}
  function persist(){localStorage.setItem(saveKey,JSON.stringify(save))}
  // Stopwatch counts active gameplay only; saved milliseconds survive app restarts.
  let runElapsed=0,runStartedAt=0,runActive=false,runHintUsed=false;
  const runTimeText=ms=>{const sec=Math.floor(Math.max(0,ms)/1000);return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`};
  function runCurrentMs(){return runElapsed+(runActive?Math.max(0,Date.now()-runStartedAt):0)}
  function runTimerDraw(){
    $('runTimerValue').textContent=runTimeText(runCurrentMs());
    $('runTimerState').textContent=runActive?'플레이 중':runCurrentMs()>0?'일시정지':'첫 터치부터 기록';
  }
  function runPause(){
    if(!runActive)return;
    runElapsed=runCurrentMs();runActive=false;runStartedAt=0;runTimerDraw();
    if(puzzle&&!clearPending&&!stageFailed)saveBoard();
  }
  function isManuallyPaused(){return !$('pauseModal').classList.contains('hidden')}
  function openPause(){
    if(clearPending||stageFailed||isManuallyPaused())return;
    runPause();
    lastTap=null;pointerPath=null;
    $('pauseElapsed').textContent=runTimeText(runCurrentMs());
    $('pauseModal').classList.remove('hidden');
    $('pauseBtn').textContent='▶ 계속';
  }
  function closePause(){
    $('pauseModal').classList.add('hidden');
    $('pauseBtn').textContent='Ⅱ 일시정지';
    runTimerDraw();
  }
  function switchToStage(){
    runPause();
    closePause();
    lastTap=null;pointerPath=null;
    $('modal').classList.add('hidden');
    $('dailyScreen').classList.add('hidden');
    if(gameMode!=='stage'){
      gameMode='stage';
      dailyDateKey=null;
      render();
    }
  }
  function runStart(){
    if(runActive||clearPending||stageFailed||isManuallyPaused()||document.hidden||!$('profileModal').classList.contains('hidden')||!$('dailyScreen').classList.contains('hidden'))return;
    runStartedAt=Date.now();runActive=true;runTimerDraw();
  }
  function runReset(){
    runElapsed=0;runStartedAt=0;runActive=false;runHintUsed=false;runTimerDraw();
  }
  function recordResult(){
    const ms=runCurrentMs(),mode=gameMode,clean=!runHintUsed,perfect=mistakes===0;
    save.playStats ||= {games:0,totalMs:0,perfect:0,daily:0,records:{}};
    const stats=save.playStats;stats.games++;stats.totalMs+=ms;if(perfect)stats.perfect++;if(mode==='daily')stats.daily++;
    const size=puzzle.n,key=`${size}|${mode}|${clean?'clean':'hint'}`;
    const previous=stats.records[key];
    const entry={ms,mistakes,hintsUsed:!clean,level:mode==='stage'?save.level:null,date:mode==='daily'?dailyDateKey:null};
    const isBest=ms>0&&(!previous||ms<previous.ms);
    if(isBest)stats.records[key]=entry;
    return {ms,isBest,previous,clean,perfect};
  }
  function renderProfile(){
    const avatar=$('profileCatAvatar');if(avatar)avatar.src=catImage();
    const stats=save.playStats||{games:0,totalMs:0,perfect:0,daily:0,records:{}};
    const values=[['현재 레벨',save.level],['총 클리어',stats.games+'판'],['누적 플레이',runTimeText(stats.totalMs)],['퍼펙트 클리어',stats.perfect+'판'],['데일리 클리어',Object.values(save.dailyResults||{}).filter(v=>v?.completed).length+'일'],['최고 퍼즐 크기',levelSize(save.level)+'×'+levelSize(save.level)]];
    $('profileStats').innerHTML=values.map(([label,value])=>`<div class="profile-stat"><small>${label}</small><strong>${value}</strong></div>`).join('');
    $('profileRecords').innerHTML=Array.from({length:9},(_,i)=>i+4).map(n=>{
      const normal=stats.records[`${n}|stage|clean`],assisted=stats.records[`${n}|stage|hint`],daily=stats.records[`${n}|daily|clean`];
      return `<div class="profile-record-row"><b>${n}×${n}</b><span>일반 ${normal?runTimeText(normal.ms):'--:--'}</span><span>힌트 ${assisted?runTimeText(assisted.ms):'--:--'}</span><span>데일리 ${daily?runTimeText(daily.ms):'--:--'}</span></div>`;
    }).join('');
  }
  const settingsDefaults={sound:true,volume:65,vibration:true,animation:true,timer:true,errors:true,accessible:false,dark:false};
  function readSettings(){
    try{return {...settingsDefaults,...JSON.parse(localStorage.getItem('nyangdoku-settings-v1')||'{}')}}catch{return {...settingsDefaults}}
  }
  let preferences=readSettings();
  function applySettings(){
    document.body.classList.toggle('reduced-effects',!preferences.animation);
    document.body.classList.toggle('color-assist',!!preferences.accessible);
    document.body.classList.toggle('dark-mode',!!preferences.dark);
    $('runTimer').classList.toggle('timer-hidden',!preferences.timer);
    const pairs={Sound:'sound',Vibration:'vibration',Animation:'animation',Timer:'timer',Errors:'errors',Accessible:'accessible',Dark:'dark'};
    Object.entries(pairs).forEach(([id,key])=>{$('setting'+id).checked=!!preferences[key]});
    $('settingVolume').value=preferences.volume;
    $('settingVolumeValue').textContent=preferences.volume+'%';
    $('settingVolume').disabled=!preferences.sound;
  }
  function saveSettings(){localStorage.setItem('nyangdoku-settings-v1',JSON.stringify(preferences));applySettings()}
  function vibrateGame(kind){
    if(!preferences.vibration)return;
    try{
      if(window.NyangdokuAds&&typeof window.NyangdokuAds.vibrate==='function'){
        window.NyangdokuAds.vibrate(kind);
      }else if(navigator.vibrate){
        navigator.vibrate(kind==='wrong'?[35,45,55]:kind==='win'?[22,55,35]:kind==='cat'?24:12);
      }
    }catch{}
  }
  function openSettings(){
    runPause();
    applySettings();
    $('settingsModal').classList.remove('hidden');
  }
  function closeSettings(){$('settingsModal').classList.add('hidden')}
  function progressKey(){return gameMode==='daily'?'daily:'+dailyDateKey:'stage:'+save.level}
  function puzzleSignature(p){return stageHash(`${p.n}|${p.regions.join(',')}|${p.fixedCats.map(x=>x.join(',')).join(';')}`)}
  function saveBoard(){if(!puzzle)return;save.boardProgress ||= {};save.boardProgress[progressKey()]={signature:puzzleSignature(puzzle),cells:cells.slice(),undo:undoHistory.slice(-150),runElapsed:runCurrentMs(),runHintUsed};persist()}
  function clearBoard(){if(save.boardProgress)delete save.boardProgress[progressKey()];persist()}
  function validPuzzle(p){if(!p||!Number.isInteger(p.n)||p.n<4||p.n>12||!Array.isArray(p.regions)||p.regions.length!==p.n*p.n||!Array.isArray(p.fixedCats)||!Array.isArray(p.solution)||p.solution.length!==p.n)return false;const n=p.n,regions=new Set(p.regions);if(regions.size!==n||p.regions.some(x=>!Number.isInteger(x)||x<0||x>=n))return false;const fixedRows=new Set();const solutionCells=p.solution.map((col,row)=>[row,col,row*n+col]);if(p.solution.some(col=>!Number.isInteger(col)||col<0||col>=n)||!((()=>{const cols=new Set(),regs=new Set();for(const [row,col,i] of solutionCells){if(cols.has(col)||regs.has(p.regions[i])||(row&&Math.abs(p.solution[row-1]-col)<=1))return false;cols.add(col);regs.add(p.regions[i])}return true})()))return false;for(const pair of p.fixedCats){if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||!Number.isInteger(pair[1])||pair[0]<0||pair[0]>=n||pair[1]<0||pair[1]>=n||fixedRows.has(pair[0])||p.solution[pair[0]]!==pair[1])return false;fixedRows.add(pair[0])}return countSolutions(n,p.regions,p.fixedCats)===1}
  function validPlacement(placed){if(placed.length!==puzzle.n)return false;const rows=new Set(),cols=new Set(),regions=new Set();for(const [r,c,i] of placed){if(rows.has(r)||cols.has(c)||regions.has(puzzle.regions[i]))return false;rows.add(r);cols.add(c);regions.add(puzzle.regions[i])}for(let a=0;a<placed.length;a++)for(let b=a+1;b<placed.length;b++)if(Math.abs(placed[a][0]-placed[b][0])<=1&&Math.abs(placed[a][1]-placed[b][1])<=1)return false;return true}
  save.coins=Number.isFinite(save.coins)?save.coins:0;
  save.missions ||= {daily:{},weekly:{}};save.attendance ||= {claimed:{},streak:0,last:null};save.ownedCats ||= ['default'];save.equippedCat ||= 'default';
  const catCatalog=[
    {id:'2_1',name:'치즈',file:'2_1.png',rarity:'common'},
    {id:'3_1',name:'코숏',file:'3_1.png',rarity:'common'},
    {id:'4_1',name:'페르시안',file:'4_1.png',rarity:'common'},
    {id:'5_1',name:'스핑크스',file:'5_1.png',rarity:'common'},
    {id:'6_1',name:'치타',file:'6_1.png',rarity:'common'},
    {id:'7_1',name:'삼색',file:'7_1.png',rarity:'common'},
    {id:'8_1',name:'마눌',file:'8_1.png',rarity:'common'},
    {id:'9_1',name:'검냥',file:'9_1.png',rarity:'common'},
    {id:'10_1',name:'호랑이',file:'10_1.png',rarity:'common'},
    {id:'11_1',name:'사자',file:'11_1.png',rarity:'common'},
    {id:'12_1',name:'백호',file:'12_1.png',rarity:'common'},
    {id:'13_1',name:'퓨마',file:'13_1.png',rarity:'common'},
    {id:'1_2',name:'잠옷 신사',file:'1_2.png',rarity:'rare'},
    {id:'2_2',name:'우비 치즈',file:'2_2.png',rarity:'rare'},
    {id:'3_2',name:'딸기 코숏',file:'3_2.png',rarity:'rare'},
    {id:'4_2',name:'꿀벌 페르시안',file:'4_2.png',rarity:'rare'},
    {id:'5_2',name:'개구리 스핑크스',file:'5_2.png',rarity:'rare'},
    {id:'6_2',name:'토끼 치타',file:'6_2.png',rarity:'rare'},
    {id:'7_2',name:'수박 삼색',file:'7_2.png',rarity:'rare'},
    {id:'8_2',name:'목도리 마눌',file:'8_2.png',rarity:'rare'},
    {id:'9_2',name:'산타 검냥',file:'9_2.png',rarity:'rare'},
    {id:'10_2',name:'루돌프 호랑이',file:'10_2.png',rarity:'epic'},
    {id:'11_2',name:'해적 사자',file:'11_2.png',rarity:'epic'},
    {id:'11_3',name:'닌자 사자',file:'11_3.png',rarity:'epic'},
    {id:'12_2',name:'왕자 백호',file:'12_2.png',rarity:'epic'},
    {id:'13_2',name:'공주 퓨마',file:'13_2.png',rarity:'epic'},
    {id:'1_3',name:'파일럿 신사',file:'1_3.png',rarity:'epic'},
    {id:'2_3',name:'뱀파이어 치즈',file:'2_3.png',rarity:'epic'},
    {id:'4_3',name:'경찰 페르시안',file:'4_3.png',rarity:'epic'},
    {id:'5_3',name:'파라오 스핑크스',file:'5_3.png',rarity:'epic'},
    {id:'6_3',name:'정글 치타',file:'6_3.png',rarity:'epic'},
    {id:'7_3',name:'천사 삼색',file:'7_3.png',rarity:'epic'},
    {id:'8_3',name:'악마 마눌',file:'8_3.png',rarity:'epic'},
    {id:'9_3',name:'도둑 검냥',file:'9_3.png',rarity:'epic'},
    {id:'10_3',name:'메이드 호랑이',file:'10_3.png',rarity:'epic'},
    {id:'12_3',name:'군인 백호',file:'12_3.png',rarity:'epic'},
    {id:'13_3',name:'셰프 퓨마',file:'13_3.png',rarity:'epic'}
  ];
  const rarityConfig={
    common:{label:'일반',weight:70},
    rare:{label:'희귀',weight:22},
    epic:{label:'영웅',weight:8}
  };
  const GACHA_COST=1,GACHA_DUPLICATE_REFUND=0;
  // Retire removed skins without deleting any other saved game progress.
  const activeSkinIds=new Set(['default',...catCatalog.map(cat=>cat.id)]);
  save.ownedCats=save.ownedCats.filter(id=>activeSkinIds.has(id));
  if(!save.ownedCats.includes('default'))save.ownedCats.unshift('default');
  if(!activeSkinIds.has(save.equippedCat))save.equippedCat='default';
  persist();

  function gachaPool(){return catCatalog.filter(cat=>rarityConfig[cat.rarity])}
  function gachaTierRates(){
    const pool=gachaPool(),tiers=Object.entries(rarityConfig).filter(([tier])=>pool.some(cat=>cat.rarity===tier));
    const total=tiers.reduce((sum,[,cfg])=>sum+cfg.weight,0);
    return tiers.map(([tier,cfg])=>({tier,label:cfg.label,weight:cfg.weight,percent:cfg.weight/total*100}));
  }
  let gachaAnimating=false,gachaRevealTimer=null,gachaFinishTimer=null,gachaPending=null;
  function gachaClose(){
    clearTimeout(gachaRevealTimer);clearTimeout(gachaFinishTimer);
    $('gachaCinematic').classList.add('hidden');
    $('gachaCinematic').classList.remove('gacha-rare','gacha-epic','gacha-legendary','gacha-common','gacha-show-prize','gacha-revealed');
    gachaAnimating=false;gachaPending=null;
  }
  function gachaReveal(){
    if(!gachaAnimating||!gachaPending)return;
    clearTimeout(gachaRevealTimer);clearTimeout(gachaFinishTimer);
    const {cat,duplicate}=gachaPending;
    const stage=$('gachaCinematic');
    stage.classList.add('gacha-show-prize');
    $('gachaCapsule').classList.add('hidden');
    $('gachaCinematic').classList.add('gacha-revealed');
    $('gachaPrize').classList.remove('hidden');
    $('gachaStageText').textContent=duplicate?'이미 만난 냥이다냥!':'새로운 친구를 만났다냥!';
    $('gachaPrizeImage').src=cat.file;
    $('gachaPrizeImage').alt=cat.name;
    $('gachaPrizeRarity').textContent=rarityConfig[cat.rarity].label+' 등급';
    $('gachaPrizeName').textContent=cat.name;
    $('gachaPrizeMessage').textContent=duplicate?'중복 획득!':'새로운 고양이 획득!';
    $('gachaCinematicButton').textContent='확인';
    gameTone(cat.rarity==='epic'||cat.rarity==='rare'?'win':'cat');
    vibrateGame(cat.rarity==='epic'||cat.rarity==='rare'?'win':'cat');
  }
  function gachaDraw(){
    if(gachaAnimating)return;
    if(save.coins<GACHA_COST){showToast('생선이 부족하다냥!');return}
    const pool=gachaPool(),rates=gachaTierRates();
    if(!pool.length){showToast('뽑을 수 있는 고양이가 없어!');return}
    let roll=Math.random()*100,selected=rates[rates.length-1].tier;
    for(const tier of rates){roll-=tier.percent;if(roll<0){selected=tier.tier;break}}
    const choices=pool.filter(cat=>cat.rarity===selected);
    const cat=choices[Math.floor(Math.random()*choices.length)];
    const duplicate=save.ownedCats.includes(cat.id);
    save.coins-=GACHA_COST;
    if(duplicate)save.coins+=GACHA_DUPLICATE_REFUND;
    else save.ownedCats.push(cat.id);
    // Save rewards immediately, even if the player closes the app mid-animation.
    persist();updateCoins();renderCatShop();renderCatDex();
    const result=$('gachaResult');result.classList.remove('hidden');
    result.innerHTML='';
    const image=document.createElement('img');image.src=cat.file;image.alt=cat.name;image.onerror=()=>{image.onerror=null;image.src='1_1.png'};
    const info=document.createElement('div');
    const label=document.createElement('small');label.textContent=rarityConfig[cat.rarity].label+' 등급';
    const name=document.createElement('strong');name.textContent=cat.name;
    const message=document.createElement('p');message.textContent=duplicate?'중복 획득!':'새로운 고양이 획득!';
    info.append(label,name,message);result.append(image,info);
    gachaPending={cat,duplicate};gachaAnimating=true;
    const stage=$('gachaCinematic');
    stage.className='gacha-cinematic gacha-'+cat.rarity;
    $('gachaPrizeImage').src=cat.file;
    $('gachaCapsule').classList.remove('hidden');
    $('gachaPrize').classList.add('hidden');
    $('gachaStageText').textContent='두근두근... 어떤 냥이가 나올까?';
    $('gachaCinematicButton').textContent='건너뛰기';
    if(!preferences.animation){gachaReveal();return}
    gameTone('hint');vibrateGame('hint');
    gachaRevealTimer=setTimeout(gachaReveal,3300);
  }
  const backgroundCatalog=[];
  const markCatalog=[];
  save.ownedMarks ||= ['default'];save.equippedMark ||= 'default';
  save.equippedBackground='default';
  save.equippedMark='default';
  if(!save.cleanHudDefaultApplied){save.equippedBackground='default';save.cleanHudDefaultApplied=true;persist()}
  function applyBackground(){document.body.classList.remove('has-custom-bg');document.body.style.removeProperty('--custom-game-bg')}
  function drawMark(el){el.innerHTML='';const item=markCatalog.find(x=>x.id===save.equippedMark);if(item){const img=document.createElement('img');img.className='mark-skin';img.src=item.file;img.alt='빈칸 표시';img.draggable=false;img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('span'),{className:'cross',textContent:'×'}))};el.appendChild(img)}else{const x=document.createElement('span');x.className='cross';x.textContent='×';el.appendChild(x)}}
  function renderCosmeticShop(type){const isBg=type==='background',grid=$(isBg?'backgroundShopGrid':'markShopGrid'),catalog=isBg?backgroundCatalog:markCatalog,owned=isBg?save.ownedBackgrounds:save.ownedMarks,equipped=isBg?save.equippedBackground:save.equippedMark;grid.innerHTML='';const all=[{id:'default',name:isBg?'기본 배경':'기본 X',price:0,file:null},...catalog];for(const item of all){const has=owned.includes(item.id),active=equipped===item.id,card=document.createElement('div');card.className='cosmetic-card'+(active?' equipped':'');const visual=document.createElement('div');visual.className='cosmetic-preview '+(isBg?'background-preview':'mark-preview');if(item.file){const img=document.createElement('img');img.src=item.file;img.alt=item.name;img.loading='lazy';visual.appendChild(img)}else visual.textContent=isBg?'기본':'×';const title=document.createElement('strong');title.textContent=item.name;const price=document.createElement('small');price.textContent=has?(active?'장착 중':'보유 중'):`생선 ${item.price}생선`;const btn=document.createElement('button');btn.textContent=active?'장착 완료':has?'장착하기':'구매하기';btn.disabled=active;btn.addEventListener('click',()=>{if(!owned.includes(item.id)){if(save.coins<item.price){showToast('생선이 부족하다냥!');return}if(!confirm(`${item.name}을(를) ${item.price}생선에 구매할까냥?`))return;save.coins-=item.price;owned.push(item.id)}if(isBg){save.equippedBackground=item.id;applyBackground()}else{save.equippedMark=item.id;if(puzzle)cells.forEach((v,i)=>{if(v===1)drawCell(i)})}persist();updateCoins();renderCosmeticShop(type);showToast(`${item.name} 장착 완료다냥!`)});card.append(visual,title,price,btn);grid.appendChild(card)}}
  const selectedCat=()=>catCatalog.find(x=>x.id===save.equippedCat);
  const catImage=()=>selectedCat()?.file||'1_1.png';
  function renderCatShop(){
    const rates=gachaTierRates();
    $('gachaRates').innerHTML=rates.map(tier=>`<span class="gacha-rate rarity-${tier.tier}">${tier.label} ${Number(tier.percent.toFixed(2))}%</span>`).join('');
    $('gachaPullBtn').disabled=save.coins<GACHA_COST;
  }
  let dexFilter='all';
  function renderCatDex(){
    const all=[{id:'default',name:'신사',file:'1_1.png',rarity:'common'},...catCatalog];
    const owned=cat=>save.ownedCats.includes(cat.id);
    const total=all.filter(owned).length;
    $('dexTotal').textContent=`전체 수집 ${total} / ${all.length} · ${Math.round(total/all.length*100)}%`;
    const filters=$('dexFilters');filters.innerHTML='';
    for(const tier of ['all','common','rare','epic']){
      const members=tier==='all'?all:all.filter(cat=>cat.rarity===tier);
      const count=members.filter(owned).length;
      const btn=document.createElement('button');
      btn.type='button';btn.className='dex-filter'+(tier===dexFilter?' active':'')+' rarity-'+tier;
      btn.textContent=`${tier==='all'?'전체':rarityConfig[tier].label} ${count}/${members.length}`;
      btn.setAttribute('aria-pressed',String(tier===dexFilter));
      btn.addEventListener('click',()=>{dexFilter=tier;renderCatDex()});
      filters.appendChild(btn);
    }
    const selected=all.filter(cat=>dexFilter==='all'||cat.rarity===dexFilter);
    const heading=$('dexSectionHeading');
    heading.textContent=dexFilter==='all'?'전체 도감':rarityConfig[dexFilter].label+' 등급';
    const grid=$('dexGrid');grid.innerHTML='';
    if(!selected.length){
      const empty=document.createElement('p');empty.className='dex-empty';empty.textContent='아직 이 등급의 스킨이 없어!';grid.appendChild(empty);return;
    }
    for(const cat of selected){
      const unlocked=owned(cat),equipped=save.equippedCat===cat.id;
      const card=document.createElement('div');
      card.className='dex-card rarity-'+cat.rarity+(unlocked?' unlocked':' locked');
      const image=document.createElement('img');image.src=cat.file;image.alt=unlocked?cat.name:'미획득 스킨';
      image.loading='lazy';image.onerror=()=>{image.onerror=null;image.src='1_1.png'};
      const tag=document.createElement('span');tag.className='dex-rarity';tag.textContent=rarityConfig[cat.rarity].label;
      const name=document.createElement('strong');name.textContent=unlocked?cat.name:'???';
      const status=document.createElement('small');status.textContent=equipped?'장착 중':unlocked?'획득 완료':'미획득';
      card.append(image,tag,name,status);
      if(unlocked&&!equipped){
        const btn=document.createElement('button');btn.type='button';btn.textContent='장착하기';
        btn.addEventListener('click',()=>{save.equippedCat=cat.id;persist();renderCatDex();renderCatShop();renderCatAppearance();showToast(`${cat.name} 장착 완료다냥!`)});
        card.appendChild(btn);
      }
      grid.appendChild(card);
    }
  }
  function renderCatAppearance(){document.querySelectorAll('.cell.cat img, .cat-chip img, #gameModalCat, #profileCatAvatar, .shop-dialog > img').forEach(img=>{img.src=catImage()})}
  // Mission rewards are claimed manually and never grant hints.
  let missionTab='daily',runHints=0;
  function weekKey(date){const d=new Date(date+'T12:00:00Z'),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10)}
  const missionDefs={
    daily:[{id:'play',name:'퍼즐 1판 클리어',target:1,coins:30},{id:'three',name:'퍼즐 3판 클리어',target:3,coins:60},{id:'clean',name:'실수 없이 1판 클리어',target:1,coins:40}],
    weekly:[{id:'five',name:'퍼즐 5판 클리어',target:5,coins:120},{id:'twenty',name:'퍼즐 20판 클리어',target:20,coins:300},{id:'daily',name:'데일리 챌린지 3일 클리어',target:3,coins:180}]
  };
  function missionBucket(type){const key=type==='daily'?seoulTodayKey():weekKey(seoulTodayKey());save.missions[type] ||= {};save.missions[type][key] ||= {counts:{},claimed:[]};return save.missions[type][key]}
  function recordMissionWin(isDaily,firstDaily,clean){const day=missionBucket('daily'),week=missionBucket('weekly');day.counts.play=(day.counts.play||0)+1;day.counts.three=(day.counts.three||0)+1;if(clean)day.counts.clean=(day.counts.clean||0)+1;week.counts.five=(week.counts.five||0)+1;week.counts.twenty=(week.counts.twenty||0)+1;if(isDaily&&firstDaily&&dailyDateKey===seoulTodayKey())week.counts.daily=(week.counts.daily||0)+1;persist();if(day.counts.play===1||day.counts.three===3||week.counts.five===5)showToast('미션 보상을 확인하라냥!')}
  function renderMissions(){const today=seoulTodayKey(),att=save.attendance,claimed=!!att.claimed[today];$('attendanceStatus').textContent=claimed?'오늘 출석 완료다냥!':'오늘 출석하면 생선을 받는다냥!';$('attendanceClaim').disabled=claimed;$('attendanceClaim').textContent=claimed?'오늘 출석 완료':'출석하고 생선 받기';$('missionStreak').textContent=`연속 출석 ${att.streak||0}일 · 다음 보상 ${Math.min(7,(att.streak||0)+1)*20}생선`;$('dailyMissionTab').classList.toggle('active',missionTab==='daily');$('weeklyMissionTab').classList.toggle('active',missionTab==='weekly');const bucket=missionBucket(missionTab),list=$('missionList');list.innerHTML='';for(const def of missionDefs[missionTab]){const count=Math.min(def.target,bucket.counts[def.id]||0),claimed=bucket.claimed.includes(def.id),row=document.createElement('div');row.className='mission-item';const label=document.createElement('div');label.innerHTML=`<strong>${def.name}</strong><small>${count}/${def.target} · <img class="fish-icon" src="Fish.png" alt=""> ${def.coins}생선</small>`;const btn=document.createElement('button');btn.textContent=claimed?'수령 완료':count>=def.target?'받기':'진행 중';btn.disabled=claimed||count<def.target;btn.addEventListener('click',()=>{if(bucket.claimed.includes(def.id)||(bucket.counts[def.id]||0)<def.target)return;bucket.claimed.push(def.id);save.coins+=def.coins;persist();updateCoins();renderMissions();showToast(`${def.coins}생선을 받았다냥!`)});row.append(label,btn);list.appendChild(row)}}
  function claimAttendance(){const today=seoulTodayKey(),att=save.attendance;if(att.claimed[today])return;const yesterday=shiftDate(today,-1);att.streak=att.last===yesterday?(att.streak||0)+1:1;att.last=today;att.claimed[today]=true;const reward=Math.min(7,att.streak)*20;save.coins+=reward;persist();updateCoins();renderMissions();showToast(`출석 보상 ${reward}생선을 받았다냥!`)}
  function openMissions(){runPause();missionTab='daily';renderMissions();$('missionModal').classList.remove('hidden')}
  function updateCoins(){$('coins').textContent=save.coins;$('shopCoins').textContent=save.coins}
  function seededRandom(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
  function stageHash(text){let a=0x811c9dc5,b=0x9e3779b9;for(let i=0;i<text.length;i++){const ch=text.charCodeAt(i);a=Math.imul(a^ch,0x01000193);b=Math.imul(b^ch,0x85ebca6b)}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')}
  function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function solveRows(n,rng){const cols=[];function dfs(r){if(r===n)return true;for(const c of shuffle(Array.from({length:n},(_,i)=>i),rng)){if(cols.includes(c)||(r&&Math.abs(cols[r-1]-c)<=1))continue;cols[r]=c;if(dfs(r+1))return true;cols.pop()}return false}return dfs(0)?cols.slice():null}
  function countSolutions(n,regions,fixedCats){const fixed=Array(n).fill(-1),usedColumns=Array(n).fill(false),usedRegions=Array(n).fill(false),chosen=[];fixedCats.forEach(([r,c])=>fixed[r]=c);let found=0;function visit(r){if(found>1)return;if(r===n){found++;return}const candidates=fixed[r]>=0?[fixed[r]]:Array.from({length:n},(_,c)=>c);for(const c of candidates){const region=regions[r*n+c];if(usedColumns[c]||usedRegions[region]||(r&&Math.abs(chosen[r-1]-c)<=1))continue;usedColumns[c]=true;usedRegions[region]=true;chosen[r]=c;visit(r+1);usedColumns[c]=false;usedRegions[region]=false;if(found>1)return}}visit(0);return found}
  function makeCandidate(n,clueCount,seed){const rng=seededRandom(seed),solution=solveRows(n,rng);if(!solution)return null;const cats=solution.map((c,r)=>[r,c]),biases=Array.from({length:n},()=>rng()*2.8-1.4),regions=Array.from({length:n*n},(_,idx)=>{const r=Math.floor(idx/n),c=idx%n;let best=Infinity,chosen=0;for(let i=0;i<n;i++){const d=(cats[i][0]-r)**2+(cats[i][1]-c)**2+biases[i];if(d<best){best=d;chosen=i}}return chosen});cats.forEach(([r,c],i)=>regions[r*n+c]=i);const palette=shuffle(Array.from({length:n},(_,i)=>i),rng),coloredRegions=regions.map(x=>palette[x]),rows=shuffle(Array.from({length:n},(_,i)=>i),rng).slice(0,clueCount).sort((a,b)=>a-b),fixedCats=rows.map(r=>[r,solution[r]]);if(countSolutions(n,coloredRegions,fixedCats)!==1)return null;return {n,solution,regions:coloredRegions,cats,fixedCats}}
  // Evaluate region balance and whether players can make forced deductions without guessing.
  function puzzleQuality(p){
    const n=p.n,regions=p.regions,counts=Array(n).fill(0),edges=Array(n).fill(0);
    for(let i=0;i<n*n;i++){
      const k=regions[i];counts[k]++;
      const row=Math.floor(i/n),col=i%n;
      if(row===0||regions[i-n]!==k)edges[k]++;
      if(row===n-1||regions[i+n]!==k)edges[k]++;
      if(col===0||regions[i-1]!==k)edges[k]++;
      if(col===n-1||regions[i+1]!==k)edges[k]++;
    }
    const area=n,imbalance=counts.reduce((v,c)=>v+Math.abs(c-area),0)/n;
    const perimeter=edges.reduce((v,e)=>v+e,0)/(n*n);
    const chosen=new Map(p.fixedCats.map(([row,col])=>[row,col]));
    let steps=0;
    for(let turn=0;turn<n;turn++){
      const options=Array.from({length:n},()=>[]);
      const usedCols=new Set(chosen.values()),usedRegions=new Set([...chosen].map(([row,col])=>regions[row*n+col]));
      for(let row=0;row<n;row++){
        if(chosen.has(row))continue;
        for(let col=0;col<n;col++){
          const region=regions[row*n+col];
          if(usedCols.has(col)||usedRegions.has(region))continue;
          if(chosen.has(row-1)&&Math.abs(chosen.get(row-1)-col)<=1)continue;
          if(chosen.has(row+1)&&Math.abs(chosen.get(row+1)-col)<=1)continue;
          options[row].push(col);
        }
      }
      let forced=null;
      for(let row=0;row<n;row++)if(!chosen.has(row)&&options[row].length===1){forced=[row,options[row][0]];break}
      if(!forced){
        for(let col=0;col<n&&!forced;col++){
          if(usedCols.has(col))continue;
          const cells=[];for(let row=0;row<n;row++)if(options[row].includes(col))cells.push([row,col]);
          if(cells.length===1)forced=cells[0];
        }
      }
      if(!forced){
        for(let region=0;region<n&&!forced;region++){
          if(usedRegions.has(region))continue;
          const cells=[];for(let row=0;row<n;row++)for(const col of options[row])if(regions[row*n+col]===region)cells.push([row,col]);
          if(cells.length===1)forced=cells[0];
        }
      }
      if(!forced)break;
      chosen.set(forced[0],forced[1]);steps++;
    }
    return {steps,solved:chosen.size===n,score:steps*6-imbalance*2-perimeter*3};
  }
  function sameSolution(a,b){return !!a&&!!b&&a.n===b.n&&a.solution.every((v,i)=>v===b.solution[i])}
  function makePuzzle(level){
    if(validPuzzle(save.stageCache[level]))return save.stageCache[level];
    delete save.stageCache[level];
    const n=levelSize(level),used=new Set(save.seenStageKeys),previous=save.stageCache[level-1];
    const clueCount=stageClues(level);
    let best=null,accepted=0;
    for(let attempt=0;attempt<512;attempt++){
      const seed=(Math.imul(level,0x9E3779B1)^Math.imul(attempt+1,0x85EBCA77))>>>0;
      const candidate=makeCandidate(n,clueCount,seed);
      if(!candidate||sameSolution(candidate,previous))continue;
      const key=stageHash(`${n}|${candidate.solution.join('')}|${candidate.regions.join('')}|${candidate.fixedCats.map(([r,c])=>r*n+c).join('.')}`);
      if(used.has(key))continue;
      const quality=puzzleQuality(candidate);
      if(!best||quality.score>best.quality.score)best={candidate,attempt,key,quality};
      if(++accepted>=16||quality.solved&&accepted>=5)break;
    }
    if(best){storeStage(level,best.attempt,best.key,best.candidate);return best.candidate}
    // Preserve playability if the intended clue count is too difficult to generate.
    for(let clues=clueCount+1;clues<=n;clues++){
      for(let attempt=0;attempt<512;attempt++){
        const seed=(Math.imul(level,0x9E3779B1)^Math.imul(attempt+1,0x85EBCA77))>>>0;
        const candidate=makeCandidate(n,clues,seed);
        if(!candidate)continue;
        const key=stageHash(`recovery-v8|${level}|${clues}|${attempt}`);
        storeStage(level,attempt,key,candidate);return candidate;
      }
    }
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
    let best=null,accepted=0;
    for(let attempt=0;attempt<512;attempt++){
      const seed=(seedBase+Math.imul(attempt+1,0x9E3779B1))>>>0;
      const candidate=makeCandidate(n,clueCount,seed);
      if(!candidate||sameSolution(candidate,previous))continue;
      const key=stageHash(`daily|${n}|${candidate.solution.join('')}|${candidate.regions.join('')}|${candidate.fixedCats.map(([r,c])=>r*n+c).join('.')}`);
      if(used.has(key))continue;
      const quality=puzzleQuality(candidate);
      if(!best||quality.score>best.quality.score)best={candidate,key,quality};
      if(++accepted>=12||quality.solved&&accepted>=4)break;
    }
    if(best){
      save.dailyPuzzles[dateKey]={puzzle:best.candidate,tier,key:best.key};
      save.seenStageKeys.push(best.key);persist();return best.candidate;
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
  function render(){applySettings();closePause();$('switchModeBtn').style.display=gameMode==='daily'?'block':'none';$('pauseSwitchBtn').style.display=gameMode==='daily'?'block':'none';clearTimeout(clearTimer);clearPending=false;const isDaily=gameMode==='daily';puzzle=isDaily?dailyPuzzle(dailyDateKey):makePuzzle(save.level);cells=Array.from({length:puzzle.n*puzzle.n},()=>0);mistakes=isDaily?(save.dailyProgress[dailyDateKey]?.mistakes||0):(save.stageMistakes[save.level]||0);stageFailed=false;$('screenHeading').textContent=isDaily?'데일리 챌린지':`레벨 ${save.level}`;$('score').textContent=save.score;$('hints').textContent=save.hints;$('levelInfo').textContent=isDaily?`${dateLabel(dailyDateKey)} · ${puzzle.n} × ${puzzle.n} · 데일리 챌린지`:`${puzzle.n} × ${puzzle.n} · 힌트 고양이 ${puzzle.fixedCats.length}마리`;updateHearts();
    const board=$('board');board.innerHTML='';board.style.gridTemplateColumns=`repeat(${puzzle.n},minmax(0,1fr))`;board.style.gridTemplateRows=`repeat(${puzzle.n},minmax(0,1fr))`;board.style.gap=puzzle.n>=8?'3px':'5px';
    for(let i=0;i<puzzle.n*puzzle.n;i++){const r=Math.floor(i/puzzle.n),c=i%puzzle.n,el=document.createElement('button');el.className=`cell ${regionColor[puzzle.regions[i]%colors]}`;el.setAttribute('role','gridcell');el.setAttribute('aria-label',`행 ${r+1}, 열 ${c+1}`);el.dataset.i=i;el.dataset.region=puzzle.regions[i]+1;board.appendChild(el)}
    puzzle.fixedCats.forEach(([r,c])=>{const i=r*puzzle.n+c;cells[i]=2;drawCell(i);$('board').children[i].classList.add('locked');$('board').children[i].setAttribute('aria-label',`행 ${r+1}, 열 ${c+1}, 고정 힌트 고양이`)});
    undoHistory=[];runReset();const progress=save.boardProgress?.[progressKey()];if(progress?.signature===puzzleSignature(puzzle)&&Array.isArray(progress.cells)&&progress.cells.length===cells.length){const locked=new Set(puzzle.fixedCats.map(([r,c])=>r*puzzle.n+c));if(progress.cells.every((v,i)=>(v===0||v===1||v===2)&&(!locked.has(i)||v===2))){cells=progress.cells.slice();undoHistory=Array.isArray(progress.undo)?progress.undo.filter(x=>Number.isInteger(x.i)&&x.i>=0&&x.i<cells.length&&!locked.has(x.i)&&[0,1,2].includes(x.previous)&&[0,1,2].includes(x.value)).slice(-150):[];cells.forEach((_,i)=>drawCell(i));runElapsed=Math.max(0,Number(progress.runElapsed)||0);runHintUsed=!!progress.runHintUsed;runTimerDraw()}}else if(progress){delete save.boardProgress[progressKey()]}
    requestAnimationFrame(()=>{board.style.height=`${board.clientWidth}px`});renderCatAppearance();$('caption').textContent='한 번 터치 X · 두 번 터치 고양이 · 드래그 X다냥!';persist();if(!save.tutorialDone)showTutorial();if(mistakes>=3)failStage();}
  function isFixed(i){return puzzle.fixedCats.some(([r,c])=>r*puzzle.n+c===i)}
  function activateCell(i){if(stageFailed||isManuallyPaused())return;if(isFixed(i)){showToast('이 고양이는 퍼즐에 있는 힌트야');return}const now=Date.now();if(lastTap&&lastTap.i===i&&now-lastTap.time<360){lastTap=null;setCell(i,2);return}lastTap={i,time:now};setCell(i,cells[i]===1?0:1)}
  function paintCross(i){if(isManuallyPaused()||i<0||isFixed(i)||cells[i]===2||cells[i]===1)return;setCell(i,1,false)}
  function showWrongMove(i){
    const cell=$('board').children[i];
    if(!cell)return;
    if(!preferences.errors)return;
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
    if(now-lastXSoundAt<90)return;
    lastXSoundAt=now;
    gameTone('x');
    vibrateGame('x');
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
    if(!preferences.sound||preferences.volume<=0)return;
    const now=performance.now();
    if(now-lastGameSoundAt<48&&kind!=='wrong'&&kind!=='win')return;
    lastGameSoundAt=now;
    try{
      const AudioContextType=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextType)return;
      if(!xAudioContext)xAudioContext=new AudioContextType();
      if(xAudioContext.state==='suspended')xAudioContext.resume().catch(()=>{});
      const ctx=xAudioContext,t=ctx.currentTime,master=preferences.volume/100;
      // Soft, percussive synth notes with exponential decay instead of long beeps.
      const notes={
        x:[[680,410,0,.052,.018,'sine']],
        cat:[[490,730,0,.105,.068,'sine'],[790,1030,.055,.12,.038,'sine']],
        wrong:[[310,190,0,.17,.07,'triangle'],[215,135,.09,.19,.048,'triangle']],
        undo:[[460,320,0,.085,.037,'sine']],
        hint:[[740,970,0,.13,.038,'sine'],[990,1340,.095,.17,.04,'sine']],
        win:[[523,523,0,.17,.055,'sine'],[659,659,.12,.18,.055,'sine'],[784,784,.24,.19,.058,'sine'],[1047,1047,.38,.38,.065,'sine']]
      };
      for(const [from,to,delay,duration,volume,type] of notes[kind]||[]){
        const osc=ctx.createOscillator(),gain=ctx.createGain(),at=t+delay;
        osc.type=type;
        osc.frequency.setValueAtTime(from,at);
        if(from!==to)osc.frequency.exponentialRampToValueAtTime(to,at+duration*.72);
        gain.gain.setValueAtTime(.0001,at);
        gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*master),at+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start(at);osc.stop(at+duration+.015);
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
    if(stageFailed||clearPending||isManuallyPaused()||mistakes>=3||isFixed(i))return;
    runStart();
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
      gameTone('wrong');vibrateGame('wrong');
      if(preferences.errors){$('caption').textContent=mistakes>=3?'틀렸어! 기회가 모두 끝났어.':`틀렸어! 빨간 X · 남은 기회 ${3-mistakes}번`;showToast(mistakes>=3?'틀렸어! 마지막 기회를 사용했어':`틀렸어! 남은 기회 ${3-mistakes}번`)}
      if(mistakes>=3)setTimeout(()=>{if(!stageFailed)failStage()},900);
      return;
    }
    undoHistory.push({i,previous,value});
    if(undoHistory.length>150)undoHistory.shift();
    cells[i]=value;
    drawCell(i);
    if(value===1||previous===1)animateXMark(i,value===1);
    if(value===2){gameCellFeedback(i,'cat');gameTone('cat');vibrateGame('cat')}
    saveBoard();
    if(check)validate();
  }
  function updateHearts(){$('hearts').classList.remove('heart-pulse');void $('hearts').offsetWidth;$('hearts').classList.add('heart-pulse');$('hearts').textContent='♥ '.repeat(Math.max(0,3-mistakes))+'♡ '.repeat(Math.min(3,mistakes)).trim();$('hearts').setAttribute('aria-label',`남은 실수 기회 ${Math.max(0,3-mistakes)}회`)}
  function failStage(){runPause();stageFailed=true;if(gameMode==='daily')save.dailyResults[dailyDateKey]={completed:false,mistakes,failed:true};$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modalTitle').textContent='기회가 끝났다냥!';$('modalText').textContent='세 번 실수했다냥. 같은 퍼즐에 다시 도전하라냥!';$('modalButton').textContent='다시 도전하냥';persist();$('modal').classList.remove('hidden')}
  function restartStage(){runReset();clearTimeout(clearTimer);clearPending=false;clearBoard();undoHistory=[];if(gameMode==='daily'){save.dailyProgress[dailyDateKey]={mistakes:0};delete save.dailyResults[dailyDateKey]}else save.stageMistakes[save.level]=0;persist();$('modal').classList.add('hidden');render();showToast('같은 퍼즐을 다시 시작했어')}
  function cellAtPoint(x,y){const el=document.elementFromPoint(x,y)?.closest('.cell');return el&&$('board').contains(el)?Number(el.dataset.i):-1}
  function boardPointerDown(e){const el=e.target.closest('.cell');if(!el||pointerPath||stageFailed||isManuallyPaused())return;e.preventDefault();const i=Number(el.dataset.i);pointerPath={id:e.pointerId,start:i,last:i,dragged:false};try{$('board').setPointerCapture(e.pointerId)}catch{}}
  function boardPointerMove(e){if(!pointerPath||stageFailed||pointerPath.id!==e.pointerId)return;const i=cellAtPoint(e.clientX,e.clientY);if(i<0||i===pointerPath.last)return;pointerPath.dragged=true;lastTap=null;paintCross(pointerPath.start);paintCross(pointerPath.last);paintCross(i);pointerPath.last=i}
  function boardPointerUp(e){if(!pointerPath||pointerPath.id!==e.pointerId)return;const state=pointerPath,i=cellAtPoint(e.clientX,e.clientY);pointerPath=null;if(state.dragged){paintCross(state.start);paintCross(state.last);if(i>=0)paintCross(i)}else activateCell(i>=0?i:state.start)}
  function drawCell(i){const el=$('board').children[i];el.innerHTML='';el.classList.remove('cat','error');if(cells[i]===1){drawMark(el)}else if(cells[i]===2){const img=document.createElement('img');img.src=catImage();img.alt='고양이';el.appendChild(img);el.classList.add('cat')}}
  function validate(){const placed=[];cells.forEach((v,i)=>{if(v===2)placed.push([Math.floor(i/puzzle.n),i%puzzle.n,i])});$('board').querySelectorAll('.cell').forEach(el=>el.classList.remove('error'));let bad=new Set();for(let a=0;a<placed.length;a++){const [r,c,i]=placed[a];for(let b=a+1;b<placed.length;b++){const [rr,cc,j]=placed[b];if(r===rr||c===cc||puzzle.regions[i]===puzzle.regions[j]||(Math.abs(r-rr)<=1&&Math.abs(c-cc)<=1)){bad.add(i);bad.add(j)}}if(placed.length===puzzle.n&&!validPlacement(placed))bad.add(i)}
    bad.forEach(i=>$('board').children[i].classList.add('error'));if(bad.size){showToast('이 배치로는 답이 안 맞아. 빨간 칸을 다시 확인해봐');$('caption').textContent='정답이 아니거나 규칙이 겹친 칸을 살펴봐';return}
    if(placed.length===puzzle.n&&validPlacement(placed))finish()}
  function celebrate(){if(!preferences.animation)return;document.querySelectorAll('.cell.cat').forEach((el,i)=>{el.classList.remove('celebrate-cat');el.style.setProperty('--celebrate-delay',`${i*45}ms`);void el.offsetWidth;el.classList.add('celebrate-cat')});const layer=document.createElement('div');layer.className='confetti-layer';layer.setAttribute('aria-hidden','true');const palette=['#f3be4f','#eaa7c6','#67b3db','#a9d48e','#b4a6df','#fff'];for(let i=0;i<70;i++){const piece=document.createElement('i');piece.style.setProperty('--x',`${Math.random()*100}vw`);piece.style.setProperty('--delay',`${Math.random()*220}ms`);piece.style.setProperty('--duration',`${1.4+Math.random()*.9}s`);piece.style.setProperty('--spin',`${Math.floor(Math.random()*900-450)}deg`);piece.style.setProperty('--piece-color',palette[i%palette.length]);layer.appendChild(piece)}document.body.appendChild(layer);setTimeout(()=>layer.remove(),3500);$('modal').classList.add('celebration-modal');setTimeout(()=>$('modal').classList.remove('celebration-modal'),900)}
  function finish(){if(!clearPending){const result=recordResult();runPause();clearPending=true;gameTone('win');vibrateGame('win');clearBoard();const wasDaily=gameMode==='daily',alreadyWon=wasDaily&&save.dailyResults[dailyDateKey]?.completed;if(!wasDaily)save.solved++;else if(!alreadyWon){save.dailyWins=(save.dailyWins||0)+1;save.dailyResults[dailyDateKey]={completed:true,mistakes};save.dailyProgress[dailyDateKey]={mistakes,completed:true}}const coinReward=(!wasDaily||!alreadyWon)?puzzle.n*10:0;if(coinReward)recordMissionWin(wasDaily,!alreadyWon,mistakes===0);if(coinReward){save.score+=puzzle.n*100;save.coins+=coinReward}persist();$('score').textContent=save.score;$('hints').textContent=save.hints;updateCoins();$('caption').textContent=wasDaily?'챌린지를 완료했다냥!':'완벽하다냥!';$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modalTitle').textContent=wasDaily?'챌린지 완료다냥!':'참 잘했다냥!';$('modalText').textContent=wasDaily?`${dateLabel(dailyDateKey)} 완료! <img class="fish-icon" src="Fish.png" alt=""> ${coinReward}생선을 얻었다냥!`:`레벨 ${save.level} 클리어! <img class="fish-icon" src="Fish.png" alt=""> ${coinReward}생선을 얻었다냥!`;$('modalButton').textContent=wasDaily?'달력으로':'다음 레벨 →';const recordEl=$('recordResult');recordEl.classList.remove('hidden');recordEl.textContent=(result.isBest?'🏆 NEW RECORD! · ':'클리어 기록 · ')+runTimeText(result.ms)+(result.clean?' · 힌트 없이':' · 힌트 사용')+(result.perfect?' · 퍼펙트!':'');celebrate();clearTimer=setTimeout(()=>{$('modal').classList.remove('hidden');$('modal').classList.add('reward-pop');setTimeout(()=>$('modal').classList.remove('reward-pop'),850)},1000)}}
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
    $('dailySelectedLabel').textContent=`${Number(selectedDateKey.slice(5,7))}/${Number(selectedDateKey.slice(8,10))}/${selectedDateKey.slice(2,4)}`;$('dailyDifficulty').textContent=`오늘의 도전 · ${save.dailyPuzzles[selectedDateKey]?.puzzle?.n||dailySize(selectedDateKey)}×${save.dailyPuzzles[selectedDateKey]?.puzzle?.n||dailySize(selectedDateKey)}`;$('dailyContinue').disabled=selectedDateKey>today;const dailyDone=!!save.dailyResults[selectedDateKey]?.completed;const dailyProgress=save.boardProgress?.['daily:'+selectedDateKey];const dailyPuzzleSaved=save.dailyPuzzles[selectedDateKey]?.puzzle;const fixedPositions=new Set((dailyPuzzleSaved?.fixedCats||[]).map(([r,c])=>r*dailyPuzzleSaved.n+c));const hasDailyWork=!dailyDone&&!!dailyProgress&&Array.isArray(dailyProgress.cells)&&dailyProgress.cells.some((v,i)=>v!==0&&!fixedPositions.has(i));$('dailyContinue').textContent=dailyDone?'완료 · 다시 도전':hasDailyWork?'▶ 이어하기':'새 도전 시작';$('dailyDifficulty').textContent+=(hasDailyWork?' · 진행 중':'');$('dailySelectedLabel').textContent+=save.dailyResults[selectedDateKey]?.completed?'  ✓ 완료':'';}
  function openDailyCalendar(){runPause();const today=seoulTodayKey();if(selectedDateKey>today)selectedDateKey=today;if(dailyMonthKey>today.slice(0,7))dailyMonthKey=today.slice(0,7);$('dailyScreen').classList.remove('hidden');renderDailyCalendar()}
  function leaveCalendar(){runPause(); $('dailyScreen').classList.add('hidden');gameMode='stage';dailyDateKey=null;render() }
  function goDailyCalendar(){runPause(); $('modal').classList.add('hidden');gameMode='stage';dailyDateKey=null;openDailyCalendar();render() }
  function startDaily(){if(selectedDateKey>seoulTodayKey())return;runPause();dailyDateKey=selectedDateKey;gameMode='daily';$('dailyScreen').classList.add('hidden');$('modal').classList.add('hidden');render()}
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
  function showTutorial(){runPause();tutorialStep=0;updateTutorial();$('modal').classList.remove('hidden')}
  function updateTutorial(){const page=tutorialPages[tutorialStep];$('modalTitle').textContent=page.title;$('modalText').innerHTML=page.body;$('modalButton').textContent=tutorialStep===tutorialPages.length-1?'퍼즐 시작하냥!':'다음 설명이다냥 →';$('tutorialCounter').classList.remove('hidden');$('tutorialCounter').textContent=`${tutorialStep+1} / ${tutorialPages.length}`;const demo=$('tutorialDemo');demo.classList.remove('hidden');demo.innerHTML='';const regions=[0,0,1,1,0,2,2,1,3,2,2,1,3,3,3,1];for(let i=0;i<16;i++){const r=Math.floor(i/4),col=i%4,cat=i===1,el=document.createElement('div');el.className='demo-cell region-'+regions[i];let mark='';if(cat)mark='🐱';else if(page.demo==='row'&&r===0)mark='×';else if(page.demo==='col'&&col===1)mark='×';else if(page.demo==='color'&&regions[i]===0)mark='×';else if(page.demo==='neighbor'&&[0,2,4,5,6].includes(i))mark='×';else if(page.demo==='reason'&&[0,2,4,5,6,8,9,10,12,13,14].includes(i))mark='×';else if(page.demo==='reason'&&i===11){mark='?';el.classList.add('candidate')}else if(page.demo==='controls'&&[4,8,12].includes(i))mark='×';el.textContent=mark;demo.appendChild(el)}}
  function advanceModal(){if(stageFailed){restartStage();return}if(tutorialStep>=0){tutorialStep++;if(tutorialStep<tutorialPages.length){updateTutorial();return}tutorialStep=-1;save.tutorialDone=true;persist();$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modal').classList.add('hidden');return}if(clearPending){next();return}$('modal').classList.add('hidden')}
  let adFree=false;
  let rewardBusy=false;
  const rewardKey=()=>gameMode==='daily'?'daily:'+dailyDateKey:'stage:'+save.level;
  window.onAdFreeStatus=owned=>{adFree=!!owned;updateShop()};
  window.onBillingMessage=message=>showToast(message);
  function updateShop(){const label=$('purchaseAdsBtn');if(label)label.textContent=adFree?'광고 제거 구매 완료':'광고 제거 영구 구매 · ₩3,900';const reward=$('rewardHintBtn');if(reward)reward.textContent=adFree?'무료 힌트 +2 (한 판 1회)':'광고 보고 힌트 +2'}
  let shopTab='cats';
  function selectShopTab(tab){shopTab=tab;const ids={cats:'Cats',dex:'Dex',extras:'Extras'};for(const [key,suffix] of Object.entries(ids)){const active=key===tab;$('shopTab'+suffix).classList.toggle('active',active);$('shopTab'+suffix).setAttribute('aria-selected',String(active));$('shopPanel'+suffix).classList.toggle('hidden',!active)}$('shopScrollTop')?.scrollTo?.({top:0,behavior:'instant'});const scroll=document.querySelector('.shop-scroll');if(scroll)scroll.scrollTop=0}
  function showShop(){runPause();updateCoins();renderCatAppearance();$('shopModal').classList.remove('hidden');renderCatShop();renderCatDex();updateShop();selectShopTab(shopTab);window.NyangdokuAds?.isAdFree?.()}
  function rewardHints(){if(rewardBusy)return;if(adFree){if(save.freeHintClaimed?.[rewardKey()]){showToast('이번 판 무료 힌트는 이미 받았어');return}save.freeHintClaimed ||= {};save.freeHintClaimed[rewardKey()]=true;save.hints+=2;persist();$('hints').textContent=save.hints;showToast('무료 힌트 2개 획득!');return}if(!window.NyangdokuAds?.showRewardedAd){showToast('Android 앱에서 이용할 수 있어');return}rewardBusy=true;window.NyangdokuAds.showRewardedAd('hint')}
  function getHint(){if(stageFailed||clearPending||isManuallyPaused())return;const options=puzzle.cats.map(([r,c])=>r*puzzle.n+c).filter(i=>cells[i]!==2);if(!options.length){showToast('이미 모든 고양이를 찾았다냥!');return}if(save.hints>0){runStart();runHintUsed=true;save.hints--;persist();$('hints').textContent=save.hints;revealHint();return}showToast('힌트가 없다냥! 상점에서 광고를 보고 충전하라냥!');showShop()}
  function revealHint(){runHintUsed=true;runStart();const options=puzzle.cats.map(([r,c])=>r*puzzle.n+c).filter(i=>cells[i]!==2);if(!options.length){showToast('모든 고양이를 이미 찾았어!');return}const i=options[0];setCell(i,2);gameTone('hint');vibrateGame('hint');$('board').children[i]?.classList.add('hint-glow');setTimeout(()=>$('board').children[i]?.classList.remove('hint-glow'),1400);$('caption').textContent='빛나는 칸에 힌트 고양이가 나타났다냥!';showToast('힌트 고양이 발견!')}
  window.onRewardedAd=kind=>{rewardBusy=false;if(kind==='hint'){save.hints+=2;persist();$('hints').textContent=save.hints;showToast('힌트 2개 획득!')}else if(kind==='double'){save.score+=puzzle.n*100;persist();$('score').textContent=save.score;showToast('점수 두 배 보상을 받았어!')}};
  window.onAdUnavailable=()=>{rewardBusy=false;showToast('광고가 아직 준비되지 않았어. 잠시 후 다시 눌러줘')};
  $('pauseBtn').addEventListener('click',()=>isManuallyPaused()?closePause():openPause());
  $('resumeBtn').addEventListener('click',closePause);
  $('switchModeBtn').addEventListener('click',switchToStage);
  $('pauseSwitchBtn').addEventListener('click',switchToStage);
  $('profileBtn').addEventListener('click',()=>{runPause();renderProfile();$('profileModal').classList.remove('hidden')});$('profileClose').addEventListener('click',()=>{$('profileModal').classList.add('hidden');runTimerDraw()});
  $('gachaPullBtn').addEventListener('click',gachaDraw);
  $('gachaCinematicButton').addEventListener('click',()=>{if(!gachaAnimating)return;if(!$('gachaCinematic').classList.contains('gacha-show-prize'))gachaReveal();else gachaClose()});
  $('missionBtn').addEventListener('click',openMissions);$('missionCloseX').addEventListener('click',()=> $('missionModal').classList.add('hidden'));$('attendanceClaim').addEventListener('click',claimAttendance);$('dailyMissionTab').addEventListener('click',()=>{missionTab='daily';renderMissions()});$('weeklyMissionTab').addEventListener('click',()=>{missionTab='weekly';renderMissions()});for(const [tab,suffix] of Object.entries({cats:'Cats',dex:'Dex',extras:'Extras'}))$('shopTab'+suffix).addEventListener('click',()=>selectShopTab(tab));$('shopBtn').addEventListener('click',showShop);const closeShop=()=> $('shopModal').classList.add('hidden');$('closeShopBtn').addEventListener('click',closeShop);$('shopCloseX').addEventListener('click',closeShop);$('purchaseAdsBtn').addEventListener('click',()=>window.NyangdokuAds?.buyRemoveAds?.());$('restoreAdsBtn').addEventListener('click',()=>window.NyangdokuAds?.restorePurchases?.());$('rewardHintBtn').addEventListener('click',rewardHints);window.NyangdokuAds?.isAdFree?.();
  $('hintBtn').addEventListener('click',getHint);$('undoBtn').addEventListener('click',()=>{if(stageFailed||clearPending)return;runStart();const move=undoHistory.pop();if(!move){showToast('되돌릴 기록이 없다냥!');return}cells[move.i]=move.previous;drawCell(move.i);gameCellFeedback(move.i,'undo');gameTone('undo');saveBoard();validate();$('caption').textContent='마지막 입력을 되돌렸다냥!'});$('modalButton').addEventListener('click',advanceModal);$('gameCloseX').addEventListener('click',()=>{if(tutorialStep>=0){tutorialStep=-1;save.tutorialDone=true;persist();$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modal').classList.add('hidden');return}advanceModal()});$('settingsBtn').addEventListener('click',openSettings);
  $('settingsClose').addEventListener('click',closeSettings);
  const settingsControls={Sound:'sound',Vibration:'vibration',Animation:'animation',Timer:'timer',Errors:'errors',Accessible:'accessible',Dark:'dark'};
  Object.entries(settingsControls).forEach(([id,key])=>$('setting'+id).addEventListener('change',e=>{preferences[key]=e.target.checked;saveSettings()}));
  $('settingVolume').addEventListener('input',e=>{preferences.volume=Math.max(0,Math.min(100,Number(e.target.value)));saveSettings()});
  $('settingsRules').addEventListener('click',()=>{closeSettings();showTutorial()});
  $('dailyBtn').addEventListener('click',()=>{if(isManuallyPaused())closePause();openDailyCalendar()});$('dailyBack').addEventListener('click',leaveCalendar);$('dailyContinue').addEventListener('click',startDaily);$('dailyInfo').addEventListener('click',dailyInfo);$('monthlyTrophyBtn').addEventListener('click',dailyInfo);$('prevMonth').addEventListener('click',()=>shiftMonth(-1));$('nextMonth').addEventListener('click',()=>shiftMonth(1));
  const boardElement=$('board');boardElement.addEventListener('pointerdown',boardPointerDown);boardElement.addEventListener('pointermove',boardPointerMove);boardElement.addEventListener('pointerup',boardPointerUp);boardElement.addEventListener('pointercancel',()=>{pointerPath=null});
  const studioSplash=$('studioSplash');if(studioSplash){setTimeout(()=>{studioSplash.classList.add('studio-splash-out');setTimeout(()=>studioSplash.remove(),650)},1350)}
  setInterval(()=>{if(runActive)runTimerDraw()},250);document.addEventListener('visibilitychange',()=>{if(document.hidden)runPause()});window.addEventListener('pagehide',runPause);
  applyBackground();window.addEventListener('resize',()=>{const board=$('board');if(board.clientWidth)board.style.height=`${board.clientWidth}px`});render();
})();
