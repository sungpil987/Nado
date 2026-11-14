(() => {
  const $ = id => document.getElementById(id), colors = 9, saveKey = 'nyangdoku-save-v1';
  let save = loadSave(), puzzle, cells = [], pendingTap = null, toastTimer, tutorialStep = -1;
  const levelSize = n => Math.min(9, 4 + Math.floor((n - 1) / 5));
  const regionColor = ['region-0','region-1','region-2','region-3','region-4','region-5','region-6','region-7','region-8'];
  function loadSave(){try{return Object.assign({level:1,score:0,hints:2,solved:0},JSON.parse(localStorage.getItem(saveKey)||'{}'))}catch{return {level:1,score:0,hints:2,solved:0}}}
  function persist(){localStorage.setItem(saveKey,JSON.stringify(save))}
  function rand(a){return a[Math.floor(Math.random()*a.length)]}
  function solveRows(n){const cols=[],out=[];function dfs(r){if(r===n)return true;const order=Array.from({length:n},(_,i)=>i).sort(()=>Math.random()-.5);for(const c of order){if(cols.includes(c)|| (r&&Math.abs(cols[r-1]-c)<=1))continue;cols[r]=c;if(dfs(r+1))return true}cols.pop();return false}return dfs(0)?cols.slice():null}
  function makePuzzle(level){const n=levelSize(level);let solution=solveRows(n),tries=0;while(!solution&&tries++<40)solution=solveRows(n);if(!solution)solution=Array.from({length:n},(_,r)=>(r*2+1)%n);
    const cats=solution.map((c,r)=>[r,c]);
    const regions=Array.from({length:n*n},(_,idx)=>{const r=Math.floor(idx/n),c=idx%n;let best=Infinity,chosen=0;cats.forEach(([cr,cc],i)=>{let d=Math.abs(cr-r)+Math.abs(cc-c);if(d<best){best=d;chosen=i}});return chosen});
    const clueCount=level<=5?2:(n>=9?3:2);
    return {n,solution,regions,cats,fixedCats:cats.slice(0,clueCount)};}
  function render(){puzzle=makePuzzle(save.level);cells=Array.from({length:puzzle.n*puzzle.n},()=>0);$('level').textContent=save.level;$('score').textContent=save.score;$('hints').textContent=save.hints;$('levelInfo').textContent=`${puzzle.n} × ${puzzle.n} · 고양이 ${puzzle.n}마리`;$('nextBtn').disabled=true;
    const board=$('board');board.innerHTML='';board.style.gridTemplateColumns=`repeat(${puzzle.n},minmax(0,1fr))`;board.style.gridTemplateRows=`repeat(${puzzle.n},minmax(0,1fr))`;board.style.gap=puzzle.n>=8?'3px':'5px';
    for(let i=0;i<puzzle.n*puzzle.n;i++){const r=Math.floor(i/puzzle.n),c=i%puzzle.n,el=document.createElement('button');el.className=`cell ${regionColor[puzzle.regions[i]%colors]}`;el.setAttribute('role','gridcell');el.setAttribute('aria-label',`행 ${r+1}, 열 ${c+1}`);el.dataset.i=i;el.addEventListener('click',()=>tap(i));board.appendChild(el)}
    puzzle.fixedCats.forEach(([r,c])=>{const i=r*puzzle.n+c;cells[i]=2;drawCell(i);$('board').children[i].classList.add('locked');$('board').children[i].setAttribute('aria-label',`행 ${r+1}, 열 ${c+1}, 고정 힌트 고양이`)});
    requestAnimationFrame(()=>{board.style.height=`${board.clientWidth}px`});$('caption').textContent='빈칸은 한 번, 고양이는 빠르게 두 번 눌러 표시해';persist();if(save.level===1&&!save.tutorialDone)showTutorial();}
  function tap(i){if(puzzle.fixedCats.some(([r,c])=>r*puzzle.n+c===i)){showToast('이 고양이는 퍼즐에 있는 힌트야');return}if(pendingTap&&pendingTap.i===i){clearTimeout(pendingTap.timer);pendingTap=null;setCell(i,2);return}if(pendingTap){clearTimeout(pendingTap.timer);const previous=pendingTap.i;pendingTap=null;setCell(previous,cells[previous]===1?0:1)}pendingTap={i,timer:setTimeout(()=>{const tap=pendingTap;pendingTap=null;if(tap)setCell(tap.i,cells[tap.i]===1?0:1)},260)}}
  function setCell(i,value){if(puzzle.fixedCats.some(([r,c])=>r*puzzle.n+c===i))return;if(value===2&&cells[i]===2)value=0;cells[i]=value;drawCell(i);validate();}
  function drawCell(i){const el=$('board').children[i];el.innerHTML='';el.classList.remove('cat','error');if(cells[i]===1){const x=document.createElement('span');x.className='cross';x.textContent='×';el.appendChild(x)}else if(cells[i]===2){const img=document.createElement('img');img.src='cat.png';img.alt='고양이';el.appendChild(img);el.classList.add('cat')}}
  function validate(){const placed=[];cells.forEach((v,i)=>{if(v===2)placed.push([Math.floor(i/puzzle.n),i%puzzle.n,i])});$('board').querySelectorAll('.cell').forEach(el=>el.classList.remove('error'));let bad=new Set();for(let a=0;a<placed.length;a++){const [r,c,i]=placed[a];for(let b=a+1;b<placed.length;b++){const [rr,cc,j]=placed[b];if(r===rr||c===cc||puzzle.regions[i]===puzzle.regions[j]||(Math.abs(r-rr)<=1&&Math.abs(c-cc)<=1)){bad.add(i);bad.add(j)}}if(puzzle.solution[r]!==c)bad.add(i)}
    bad.forEach(i=>$('board').children[i].classList.add('error'));if(bad.size){showToast('규칙을 확인해봐. 고양이는 행·열·색 구역마다 한 마리야');$('caption').textContent='앗, 고양이끼리 겹쳤어. 빨간 칸을 확인해봐';return}
    if(placed.length===puzzle.n){if(placed.every(([r,c])=>puzzle.solution[r]===c)){finish()}else showToast('고양이를 더 찾아봐!')}}
  function finish(){if($('nextBtn').disabled){save.solved++;save.score+=puzzle.n*100;save.hints+=1;persist();$('score').textContent=save.score;$('hints').textContent=save.hints;$('nextBtn').disabled=false;$('caption').textContent='완벽해! 다음 퍼즐도 풀어보자';$('modalTitle').textContent='참 잘했어!';$('modalText').textContent=`레벨 ${save.level} 클리어! 물고기 코인과 힌트 1개를 챙겼어.`;$('modalButton').textContent='계속하기';$('modal').classList.remove('hidden')}}
  function showToast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1900)}
  function next(){if($('nextBtn').disabled)return;save.level++;persist();$('modal').classList.add('hidden');render()}
  const tutorialPages=[
    ['냥도쿠에 온 걸 환영해!','이 퍼즐은 고양이 한 마리를 한 행·열·색 구역마다 놓는 게임이야. 처음 보이는 고양이 2마리는 움직일 수 없는 힌트야.'],
    ['고양이끼리 이웃 금지','가로·세로·대각선으로 바로 붙어 있으면 안 돼. 칸의 색도 그대로 두고 고양이만 표시할 거야.'],
    ['칸을 눌러 표시해','빈칸은 한 번 눌러 X, 같은 칸을 빠르게 두 번 눌러 고양이를 놓아. 힌트 버튼을 누르면 가능한 고양이 위치를 알려줘. 이제 시작하자!']
  ];
  function showTutorial(){tutorialStep=0;updateTutorial();$('modal').classList.remove('hidden')}
  function updateTutorial(){$('modalTitle').textContent=tutorialPages[tutorialStep][0];$('modalText').textContent=tutorialPages[tutorialStep][1];$('modalButton').textContent=tutorialStep===tutorialPages.length-1?'시작하기':'다음';}
  function advanceModal(){if(tutorialStep>=0){tutorialStep++;if(tutorialStep<tutorialPages.length){updateTutorial();return}tutorialStep=-1;save.tutorialDone=true;persist()}$('modal').classList.add('hidden')}
  function getHint(){if(save.hints>0){save.hints--;persist();$('hints').textContent=save.hints;revealHint();return}if(window.NyangdokuAds?.showRewardedAd){window.NyangdokuAds.showRewardedAd('hint')}else showToast('광고 힌트는 Android 앱에서 이용할 수 있어')}
  function revealHint(){const options=puzzle.cats.map(([r,c])=>r*puzzle.n+c).filter(i=>cells[i]!==2);if(!options.length){showToast('모든 고양이를 이미 찾았어!');return}const i=options[0];setCell(i,2);$('caption').textContent='힌트로 고양이 한 마리를 찾았어';showToast('힌트 고양이 발견!')}
  window.onRewardedAd=kind=>{if(kind==='hint')revealHint();else if(kind==='double'){save.score+=puzzle.n*100;persist();$('score').textContent=save.score;showToast('점수 두 배 보상을 받았어!')}};
  window.onAdUnavailable=()=>showToast('광고가 아직 준비되지 않았어. 잠시 후 다시 눌러줘');
  $('hintBtn').addEventListener('click',getHint);$('newBtn').addEventListener('click',()=>{render();showToast('현재 레벨 퍼즐을 새로 만들었어')});$('undoBtn').addEventListener('click',()=>{let i=-1;for(let j=cells.length-1;j>=0;j--)if(cells[j]===2&&!puzzle.fixedCats.some(([r,c])=>r*puzzle.n+c===j)){i=j;break}if(i>=0){setCell(i,0);$('caption').textContent='고양이를 지웠어'}else{const x=cells.lastIndexOf(1);if(x>=0)setCell(x,0)}});$('nextBtn').addEventListener('click',next);$('modalButton').addEventListener('click',advanceModal);$('backBtn').addEventListener('click',()=>{if(save.level>1){save.level--;persist();render()}else showToast('첫 번째 레벨이야')});$('settingsBtn').addEventListener('click',()=>showToast('진행 상황은 이 기기에 자동 저장돼'));
  window.addEventListener('resize',()=>{const board=$('board');if(board.clientWidth)board.style.height=`${board.clientWidth}px`});render();
})();
