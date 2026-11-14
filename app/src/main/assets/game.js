(() => {
  const $ = id => document.getElementById(id), colors = 9, saveKey = 'nyangdoku-save-v1';
  let save = loadSave(), puzzle, cells = [], toastTimer, tutorialStep = -1, lastTap = null, pointerPath = null, mistakes = 0, stageFailed = false, clearPending = false, clearTimer = null, undoHistory = [];
  const levelBands=[{start:1,end:10,size:4},{start:11,end:25,size:5},{start:26,end:45,size:6},{start:46,end:70,size:7},{start:71,end:100,size:8},{start:101,end:Infinity,size:9}];
  const levelBand = level => levelBands.find(b=>level>=b.start&&level<=b.end)||levelBands[levelBands.length-1];
  const levelSize = level => levelBand(level).size;
  function stageClues(level){if(level===1)return 2;const band=levelBand(level),size=band.size,span=Number.isFinite(band.end)?band.end-band.start+1:50,progress=Math.min(1,(level-band.start)/Math.max(1,span)),base=Math.min(5,Math.max(2,Math.floor((size+1)/2))),drop=progress>=.72?2:progress>=.38?1:0;return Math.max(2,base-drop)}
  const regionColor = ['region-0','region-1','region-2','region-3','region-4','region-5','region-6','region-7','region-8'];
  let gameMode='stage',dailyDateKey=null,selectedDateKey=seoulTodayKey(),dailyMonthKey=selectedDateKey.slice(0,7);
  function loadSave(){try{const s=Object.assign({level:1,score:0,hints:2,solved:0,stageCache:{},stageAttempts:{},stageMistakes:{},seenStageKeys:[],dailyPuzzles:{},dailyResults:{},dailyProgress:{},dailyWins:0},JSON.parse(localStorage.getItem(saveKey)||'{}'));if(s.puzzleVersion!==6){s.stageCache={};s.stageAttempts={};s.stageMistakes={};s.seenStageKeys=[];s.puzzleVersion=6}s.stageCache ||= {};s.stageAttempts ||= {};s.stageMistakes ||= {};s.seenStageKeys ||= [];s.dailyPuzzles ||= {};s.dailyResults ||= {};s.dailyProgress ||= {};s.boardProgress ||= {};s.missions ||= {daily:{},weekly:{}};s.attendance ||= {claimed:{},streak:0,last:null};return s}catch{return {level:1,score:0,hints:2,solved:0,stageCache:{},stageAttempts:{},stageMistakes:{},seenStageKeys:[],dailyPuzzles:{},dailyResults:{},dailyProgress:{},dailyWins:0,puzzleVersion:6}}}
  function persist(){localStorage.setItem(saveKey,JSON.stringify(save))}
  function progressKey(){return gameMode==='daily'?'daily:'+dailyDateKey:'stage:'+save.level}
  function puzzleSignature(p){return stageHash(`${p.n}|${p.regions.join(',')}|${p.fixedCats.map(x=>x.join(',')).join(';')}`)}
  function saveBoard(){if(!puzzle)return;save.boardProgress ||= {};save.boardProgress[progressKey()]={signature:puzzleSignature(puzzle),cells:cells.slice(),undo:undoHistory.slice(-150)};persist()}
  function clearBoard(){if(save.boardProgress)delete save.boardProgress[progressKey()];persist()}
  function validPuzzle(p){if(!p||!Number.isInteger(p.n)||p.n<4||p.n>9||!Array.isArray(p.regions)||p.regions.length!==p.n*p.n||!Array.isArray(p.fixedCats)||!Array.isArray(p.solution)||p.solution.length!==p.n)return false;const n=p.n,regions=new Set(p.regions);if(regions.size!==n||p.regions.some(x=>!Number.isInteger(x)||x<0||x>=n))return false;const fixedRows=new Set();const solutionCells=p.solution.map((col,row)=>[row,col,row*n+col]);if(p.solution.some(col=>!Number.isInteger(col)||col<0||col>=n)||!((()=>{const cols=new Set(),regs=new Set();for(const [row,col,i] of solutionCells){if(cols.has(col)||regs.has(p.regions[i])||(row&&Math.abs(p.solution[row-1]-col)<=1))return false;cols.add(col);regs.add(p.regions[i])}return true})()))return false;for(const pair of p.fixedCats){if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||!Number.isInteger(pair[1])||pair[0]<0||pair[0]>=n||pair[1]<0||pair[1]>=n||fixedRows.has(pair[0])||p.solution[pair[0]]!==pair[1])return false;fixedRows.add(pair[0])}return countSolutions(n,p.regions,p.fixedCats)===1}
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
  // The deleted background and mark assets are intentionally no longer referenced.
  // Preserve historical save fields for compatibility, but always use the classic white theme.
  save.equippedBackground='default';
  save.equippedMark='default';
  function applyBackground(){
    document.body.classList.remove('has-custom-bg');
    document.body.style.removeProperty('--custom-game-bg');
  }
  function drawMark(el){
    el.innerHTML='';
    const x=document.createElement('span');
    x.className='cross';
    x.textContent='×';
    el.appendChild(x);
  }
  let shopTab='cats';
  function selectShopTab(tab){shopTab=tab;const ids={cats:'Cats',extras:'Extras'};for(const [key,suffix] of Object.entries(ids)){const active=key===tab;$('shopTab'+suffix).classList.toggle('active',active);$('shopTab'+suffix).setAttribute('aria-selected',String(active));$('shopPanel'+suffix).classList.toggle('hidden',!active)}$('shopScrollTop')?.scrollTo?.({top:0,behavior:'instant'});const scroll=document.querySelector('.shop-scroll');if(scroll)scroll.scrollTop=0}
  function showShop(){updateCoins();renderCatAppearance();$('shopModal').classList.remove('hidden');renderCatShop();updateShop();selectShopTab(shopTab);window.NyangdokuAds?.isAdFree?.()}
  function rewardHints(){if(rewardBusy)return;if(adFree){if(save.freeHintClaimed?.[rewardKey()]){showToast('이번 판 무료 힌트는 이미 받았어');return}save.freeHintClaimed ||= {};save.freeHintClaimed[rewardKey()]=true;save.hints+=2;persist();$('hints').textContent=save.hints;showToast('무료 힌트 2개 획득!');return}if(!window.NyangdokuAds?.showRewardedAd){showToast('Android 앱에서 이용할 수 있어');return}rewardBusy=true;window.NyangdokuAds.showRewardedAd('hint')}
  function getHint(){if(stageFailed||clearPending)return;const options=puzzle.cats.map(([r,c])=>r*puzzle.n+c).filter(i=>cells[i]!==2);if(!options.length){showToast('이미 모든 고양이를 찾았다냥!');return}if(save.hints>0){save.hints--;persist();$('hints').textContent=save.hints;revealHint();return}showToast('힌트가 없다냥! 상점에서 광고를 보고 충전하라냥!');showShop()}
  function revealHint(){const options=puzzle.cats.map(([r,c])=>r*puzzle.n+c).filter(i=>cells[i]!==2);if(!options.length){showToast('모든 고양이를 이미 찾았어!');return}const i=options[0];setCell(i,2);$('board').children[i]?.classList.add('hint-glow');setTimeout(()=>$('board').children[i]?.classList.remove('hint-glow'),1400);$('caption').textContent='빛나는 칸에 힌트 고양이가 나타났다냥!';showToast('힌트 고양이 발견!')}
  window.onRewardedAd=kind=>{rewardBusy=false;if(kind==='hint'){save.hints+=2;persist();$('hints').textContent=save.hints;showToast('힌트 2개 획득!')}else if(kind==='double'){save.score+=puzzle.n*100;persist();$('score').textContent=save.score;showToast('점수 두 배 보상을 받았어!')}};
  window.onAdUnavailable=()=>{rewardBusy=false;showToast('광고가 아직 준비되지 않았어. 잠시 후 다시 눌러줘')};
  $('missionBtn').addEventListener('click',openMissions);$('missionCloseX').addEventListener('click',()=> $('missionModal').classList.add('hidden'));$('attendanceClaim').addEventListener('click',claimAttendance);$('dailyMissionTab').addEventListener('click',()=>{missionTab='daily';renderMissions()});$('weeklyMissionTab').addEventListener('click',()=>{missionTab='weekly';renderMissions()});for(const [tab,suffix] of Object.entries({cats:'Cats',extras:'Extras'}))$('shopTab'+suffix).addEventListener('click',()=>selectShopTab(tab));$('shopBtn').addEventListener('click',showShop);const closeShop=()=> $('shopModal').classList.add('hidden');$('closeShopBtn').addEventListener('click',closeShop);$('shopCloseX').addEventListener('click',closeShop);$('purchaseAdsBtn').addEventListener('click',()=>window.NyangdokuAds?.buyRemoveAds?.());$('restoreAdsBtn').addEventListener('click',()=>window.NyangdokuAds?.restorePurchases?.());$('rewardHintBtn').addEventListener('click',rewardHints);window.NyangdokuAds?.isAdFree?.();
  $('hintBtn').addEventListener('click',getHint);$('undoBtn').addEventListener('click',()=>{if(stageFailed||clearPending)return;const move=undoHistory.pop();if(!move){showToast('되돌릴 기록이 없다냥!');return}cells[move.i]=move.previous;drawCell(move.i);saveBoard();validate();$('caption').textContent='마지막 입력을 되돌렸다냥!'});$('modalButton').addEventListener('click',advanceModal);$('gameCloseX').addEventListener('click',()=>{if(tutorialStep>=0){tutorialStep=-1;save.tutorialDone=true;persist();$('tutorialDemo').classList.add('hidden');$('tutorialCounter').classList.add('hidden');$('modal').classList.add('hidden');return}advanceModal()});$('settingsBtn').addEventListener('click',()=>showToast('진행 상황은 이 기기에 자동 저장돼'));
  $('dailyBtn').addEventListener('click',openDailyCalendar);$('dailyBack').addEventListener('click',leaveCalendar);$('dailyContinue').addEventListener('click',startDaily);$('dailyInfo').addEventListener('click',dailyInfo);$('monthlyTrophyBtn').addEventListener('click',dailyInfo);$('prevMonth').addEventListener('click',()=>shiftMonth(-1));$('nextMonth').addEventListener('click',()=>shiftMonth(1));
  const boardElement=$('board');boardElement.addEventListener('pointerdown',boardPointerDown);boardElement.addEventListener('pointermove',boardPointerMove);boardElement.addEventListener('pointerup',boardPointerUp);boardElement.addEventListener('pointercancel',()=>{pointerPath=null});
  applyBackground();window.addEventListener('resize',()=>{const board=$('board');if(board.clientWidth)board.style.height=`${board.clientWidth}px`});render();
})();
