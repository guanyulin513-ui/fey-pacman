const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const scoreEl=document.getElementById('score');
const highEl=document.getElementById('highScore');
const livesEl=document.getElementById('lives');
const statusEl=document.getElementById('status');
const startScreen=document.getElementById('startScreen');
const gameOver=document.getElementById('gameOver');
const readyText=document.getElementById('readyText');
const easterHint=document.getElementById('easterHint');
const finalScoreEl=document.getElementById('finalScore');
const W=28,H=36,S=16;

// 經典街機「小精靈」式的 28×36 格迷宮結構；牆體與像素角色均為本專案自行繪製。
const baseMap=[
'1111111111111111111111111111','1000000000000110000000000001','1011110111110110111111011101','1011110111110110111111011101',
'1000000000000000000000000001','1011110110111111110110111101','1011110110000110000110111101','1000000111110101111101100001',
'1111110100000000000010111111','0000010101111001111010100000','0000010101000000010010100000','0000010101011111010010100000',
'1111110101010001010010111111','0000000001010001010000000000','1111110101010001010010111111','0000010101010001010010100000',
'0000010101010001010010100000','0000010101000000010010100000','0000010101111111111010100000','0000010100000000000010100000',
'1111110101111111111010111111','1000000001000110001000000001','1011110111010110101110111101','1000010000000000000001000001',
'1101010110111111110110101011','1001010110000110000110101001','1011111111100101111111111101','1000000000000100000000000001',
'1011110111110110111111011101','1000000100000000000010000001','1011110110111111110110111101','1000000000000110000000000001',
'1011111111110110111111111101','1000000000000000000000000001','1000000000000000000000000001','1111111111111111111111111111'
];
const googleMap=baseMap.map((row,y)=>row.split('').map((c,x)=>c==='1'?c:((x*3+y)%11===0?'2':c)).join(''));
let map=baseMap.slice(),mode='normal',typed='';
let pellets=[],powers=[];
let score=0,high=Number(localStorage.getItem('feyPacmanHigh')||0),lives=2,level=1,running=false,dead=false,paused=false;
let last=0,acc=0;
let player={x:14,y:26,dir:{x:0,y:-1},next:{x:0,y:-1}};
const ghostColors=['#ff4040','#ff9bd2','#42e3e3','#ffb347'];
let ghosts=[];

function pad(n){return String(n).padStart(2,'0')}
function ui(){scoreEl.textContent=pad(score);highEl.textContent=pad(high);livesEl.textContent=String(lives)}
function openCell(x,y){return x>=0&&x<W&&y>=0&&y<H&&map[y][x]!=='1'}
function wrapX(x){return x<0?W-1:x>=W?0:x}
function buildDots(){
  pellets=[];powers=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(openCell(x,y)&&!(x>=12&&x<=15&&y>=13&&y<=20))pellets.push({x,y});
  for(const [x,y] of [[1,3],[26,3],[1,32],[26,32]]){
    if(openCell(x,y)){powers.push({x,y});pellets=pellets.filter(p=>p.x!==x||p.y!==y)}
  }
}
function resetActors(){
  player={x:14,y:26,dir:{x:0,y:0},next:{x:0,y:0}};
  ghosts=ghostColors.map((color,i)=>({x:13+(i%2),y:17+Math.floor(i/2),dir:{x:i%2?1:-1,y:0},color,fright:0}));
}
function resetGame(){score=0;lives=2;level=1;dead=false;paused=false;map=(mode==='google'?googleMap:baseMap).slice();buildDots();resetActors();ui();statusEl.textContent='吃完所有豆子即可過關';draw()}
function start(){startScreen.classList.add('hidden');gameOver.classList.add('hidden');resetGame();running=true;last=performance.now();requestAnimationFrame(loop)}
function finish(){running=false;dead=true;finalScoreEl.textContent=pad(score);gameOver.classList.remove('hidden');statusEl.textContent='遊戲結束'}
function loseLife(){
  lives--;ui();
  if(lives<0){finish();return}
  resetActors();statusEl.textContent='小精靈失去一條命！';
}
function addScore(n){score+=n;if(score>high){high=score;localStorage.setItem('feyPacmanHigh',String(high))}ui()}
function reverse(a,b){return a.x===-b.x&&a.y===-b.y}
function keyDir(k){
  if(k==='ArrowUp'||k==='w'||k==='W')return{x:0,y:-1};
  if(k==='ArrowDown'||k==='s'||k==='S')return{x:0,y:1};
  if(k==='ArrowLeft'||k==='a'||k==='A')return{x:-1,y:0};
  if(k==='ArrowRight'||k==='d'||k==='D')return{x:1,y:0};
  return null
}
function setDirection(k){if(!running||dead)return;const d=keyDir(k);if(d&&!reverse(d,player.dir))player.next=d}
function toggleGoogle(){
  mode=mode==='google'?'normal':'google';
  map=(mode==='google'?googleMap:baseMap).slice();buildDots();resetActors();
  readyText.textContent=mode==='google'?'GOOGLE!':'READY!';
  easterHint.textContent=mode==='google'?'紀念地圖已啟用，再輸入 Google 可解除':'開始畫面輸入 Google（不分大小寫）切換紀念地圖；再輸入一次解除';
  draw();
}
function testSecret(input){
  const lower=input.toLowerCase();
  if(lower.endsWith('google')||input.endsWith('ㄕㄟㄟㄕㄠㄍ')){typed='';toggleGoogle();return true}
  return false
}
function moveEntity(e){let nx=wrapX(e.x+e.dir.x),ny=e.y+e.dir.y;if(!openCell(nx,ny))return false;e.x=nx;e.y=ny;return true}
function chooseGhost(g){
  const opts=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].filter(d=>openCell(wrapX(g.x+d.x),g.y+d.y)&&!reverse(d,g.dir));
  if(!opts.length)return;
  opts.sort((a,b)=>{
    const da=Math.abs(wrapX(g.x+a.x)-player.x)+Math.abs(g.y+a.y-player.y);
    const db=Math.abs(wrapX(g.x+b.x)-player.x)+Math.abs(g.y+b.y-player.y);
    return g.fright?db-da:da-db;
  });
  g.dir=opts[0];
}
function eatAtPlayer(){
  const pi=pellets.findIndex(p=>p.x===player.x&&p.y===player.y);
  if(pi>=0){pellets.splice(pi,1);addScore(10)}
  const qi=powers.findIndex(p=>p.x===player.x&&p.y===player.y);
  if(qi>=0){powers.splice(qi,1);addScore(50);ghosts.forEach(g=>g.fright=180)}
}
function ghostCollision(){
  for(const g of ghosts){if(g.x!==player.x||g.y!==player.y)continue;if(g.fright){addScore(200);g.x=13;g.y=17;g.fright=0}else{loseLife();return true}}
  return false
}
function step(){
  if(!running||paused)return;
  if(player.next.x||player.next.y){const tx=wrapX(player.x+player.next.x),ty=player.y+player.next.y;if(openCell(tx,ty)){player.dir=player.next;player.next={x:0,y:0}}}
  moveEntity(player);eatAtPlayer();if(ghostCollision())return;
  for(const g of ghosts){if(g.fright)g.fright--;chooseGhost(g);moveEntity(g);if(ghostCollision())return}
  if(!pellets.length&&!powers.length){level++;map=(mode==='google'?googleMap:baseMap).slice();buildDots();resetActors();statusEl.textContent='過關！下一關更快'}
}
function draw(){
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#163dff';
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(map[y][x]==='1')ctx.fillRect(x*S,y*S,S,S);
  ctx.fillStyle='#fff';pellets.forEach(p=>{ctx.fillRect(p.x*S+7,p.y*S+7,2,2)});
  powers.forEach(p=>{ctx.beginPath();ctx.arc(p.x*S+8,p.y*S+8,4,0,Math.PI*2);ctx.fill()});
  drawPlayer();ghosts.forEach(drawGhost);
}
function drawPlayer(){
  const x=player.x*S+8,y=player.y*S+8;let a=0;
  if(player.dir.x<0)a=Math.PI;else if(player.dir.y<0)a=-Math.PI/2;else if(player.dir.y>0)a=Math.PI/2;
  ctx.fillStyle='#ffe000';ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,7,a+0.32,a+Math.PI*2-0.32);ctx.closePath();ctx.fill();
}
function drawGhost(g){
  const x=g.x*S,y=g.y*S;ctx.fillStyle=g.fright?'#214dff':g.color;
  ctx.beginPath();ctx.arc(x+8,y+8,7,Math.PI,0);ctx.lineTo(x+15,y+15);ctx.lineTo(x+11,y+12);ctx.lineTo(x+8,y+15);ctx.lineTo(x+5,y+12);ctx.lineTo(x+1,y+15);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';ctx.fillRect(x+4,y+6,3,4);ctx.fillRect(x+9,y+6,3,4);ctx.fillStyle='#111';ctx.fillRect(x+5,y+7,2,2);ctx.fillRect(x+10,y+7,2,2)
}
function loop(t){if(!running)return;const dt=t-last;last=t;acc+=dt;const interval=Math.max(75,145-(level-1)*5);if(acc>=interval){acc=0;step()}draw();requestAnimationFrame(loop)}

window.addEventListener('keydown',e=>{
  if(!startScreen.classList.contains('hidden')){
    if(e.key.length===1){typed+=(e.key);typed=typed.slice(-30);testSecret(typed)}
  }else{
    if(e.code==='Space'){paused=!paused;statusEl.textContent=paused?'⏸ 暫停':'▶ 繼續';e.preventDefault()}
    else {setDirection(e.key);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault()}
  }
});
window.addEventListener('blur',()=>{if(running){paused=true;statusEl.textContent='⏸ 已自動暫停'}});
document.querySelectorAll('.controls [data-key]').forEach(b=>b.addEventListener('click',()=>setDirection(b.dataset.key)));
document.getElementById('fullscreen').addEventListener('click',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()});
document.getElementById('startButton').addEventListener('click',start);
document.getElementById('retryButton').addEventListener('click',start);

buildDots();resetActors();ui();draw();
