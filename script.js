/* ===============================================================
   CONSTANTS & DOM
================================================================ */
const MAP_W = 4000, MAP_H = 4000;
const FPS          = 60;
const BOOST_SECS   = 8;                        // nitro duration
const CD_SECS      = 10;                       // cooldown duration
const BOOST_TICKS  = BOOST_SECS*FPS;
const CD_TICKS     = CD_SECS*FPS;

const cv   = document.getElementById("gameCanvas");
const ctx  = cv.getContext("2d");
cv.width   = innerWidth;
cv.height  = innerHeight;

const qs  = s=>document.querySelector(s);
/* menus */
const menuBox   = qs("#menu");
const userBox   = qs("#usernameSection");
const modeBox   = qs("#modeSection");
const gameBox   = qs("#gameContainer");
/* HUD */
const assassinTxt = qs("#assassinText");
const instrTxt    = qs("#instructionText");
const lvlTxt      = qs("#levelCounter");
const nitroBox    = qs("#nitroContainer");
const nitroFill   = qs("#nitroFill");

/* ===============================================================
   GLOBAL STATE
================================================================ */
let playerName  = "";
let mode        = null;          // "assassin" | "classical" | "explosion"
let level       = 1;
let loopID      = 0;
let camera      = {x:0,y:0};

/* entities */
let player, food, snakes, targets, bombs, tanks, tankShots, plyShots;

/* minimap */
let mapOn = true;

/* nitro */
let boostActive = false;
let boostTime   = 0;     // remaining ticks
let coolTime    = 0;     // remaining ticks

/* ===============================================================
   HELPERS
================================================================ */
const rand = n=>Math.random()*n;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist =(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
const norm =(dx,dy)=>{const l=Math.hypot(dx,dy)||1;return{x:dx/l,y:dy/l}};
const dot =(o,c,r)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(o.x-camera.x,o.y-camera.y,r,0,6.283);ctx.fill();};
const toggle=(el,on)=>el.classList.toggle("hidden",!on);

/* ===============================================================
   MENU LOGIC
================================================================ */
qs("#startBtn").onclick = ()=>{toggle(menuBox,false); toggle(userBox,true)};
qs("#continueBtn").onclick=()=>{
  const v=qs("#usernameInput").value.trim();
  if(!v) return alert("Enter a username");
  playerName=v; toggle(userBox,false); toggle(modeBox,true);
};
qs("#backToUsername").onclick=()=>{toggle(modeBox,false); toggle(userBox,true)};
qs("#assassinMode").onclick =()=>initMode("assassin");
qs("#classicalMode").onclick=()=>initMode("classical");
qs("#explosionMode").onclick=()=>initMode("explosion");
qs("#backToMenu").onclick   =()=>exitGame();

/* ===============================================================
   INITIALISERS
================================================================ */
function initMode(m){
  mode=m; level=1; resetArrays();
  toggle(modeBox,false); toggle(gameBox,true);
  toggle(assassinTxt,mode==="assassin");
  toggle(nitroBox,true);
  updateInstructions();
  newLevel();
  spawnPlayer();
  loopID=requestAnimationFrame(loop);
}

function newLevel(){
  resetArrays(false);
  spawnFood(60);

  if(mode==="assassin"){
    const blue=2+level, yellow=8+level*3;
    spawnSnakes(blue+yellow);
    targets = snakes.slice(0,blue);
    targets.forEach(s=>s.blue=true);
  }
  else if(mode==="classical"){
    spawnSnakes(25+level*4);
  }
  else if(mode==="explosion"){
    spawnBombs(8+level*2);
    spawnTanks(5+level);
  }
  lvlTxt.textContent=`Level ${level}`;
}

function exitGame(){
  cancelAnimationFrame(loopID);
  toggle(gameBox,false); toggle(modeBox,true);
}

/* ===============================================================
   ARRAYS & SPAWN
================================================================ */
function resetArrays(clearPlayer=true){
  food=[]; snakes=[]; targets=[]; bombs=[]; tanks=[]; tankShots=[]; plyShots=[];
  if(clearPlayer) player=null;
}
function spawnObj(arr,obj){arr.push(obj);}
function spawnFood(n){while(n--) spawnObj(food,{x:rand(MAP_W),y:rand(MAP_H)})}
function spawnSnakes(n){
  while(n--)
    spawnObj(snakes,{
      body:[{x:rand(MAP_W),y:rand(MAP_H)}],
      dir:norm(rand(1)-.5,rand(1)-.5),
      len:6,alive:true,blue:false
    });
}
function spawnBombs(n){while(n--) spawnObj(bombs,{x:rand(MAP_W),y:rand(MAP_H),r:8})}
function spawnTanks(count){
  const step=MAP_W/count;
  for(let i=0;i<count;i++){
    const x=step*i+step/2, y=i%2?MAP_H:0;
    spawnObj(tanks,{x,y,r:22,hp:4,cd:0,dead:false});
  }
}
function spawnPlayer(){
  let ok=false;
  while(!ok){
    const x=rand(MAP_W),y=rand(MAP_H);
    ok=snakes.every(s=>dist({x,y},s.body[0])>150);
    if(ok) player={name:playerName,body:[{x,y}],dir:{x:1,y:0},len:6,alive:true};
  }
}
/* shots */
function fire(arr,x,y,dir,speed,r){arr.push({x,y,dir,speed,r})}

/* ===============================================================
   INPUT
================================================================ */
document.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(k==="m")            mapOn=!mapOn;
  if(!player?.alive)     return;

  if(["w","arrowup"].includes(k))    player.dir={x:0,y:-1};
  if(["s","arrowdown"].includes(k))  player.dir={x:0,y:1};
  if(["a","arrowleft"].includes(k))  player.dir={x:-1,y:0};
  if(["d","arrowright"].includes(k)) player.dir={x:1,y:0};

  /* nitro toggle */
  if(k===" "){
    if(boostActive){        // turn OFF early
      boostActive=false; coolTime=CD_TICKS;
    }else if(coolTime===0){ // turn ON
      boostActive=true;  boostTime=BOOST_TICKS;
    }
  }

  /* shoot (explosion) */
  if(k==="j" && mode==="explosion"){
    const h=player.body[0];
    if(player.dir.x||player.dir.y) fire(plyShots,h.x,h.y,{...player.dir},3.5,5);
  }
});

/* ===============================================================
   GAME LOOP
================================================================ */
function loop(){
  update();
  draw();
  loopID=requestAnimationFrame(loop);
}

/* ------------------- UPDATE ----------------------------------- */
function update(){
  if(!player.alive) return;

  /* ----- nitro timers ----- */
  if(boostActive){
    if(--boostTime<=0){ boostActive=false; coolTime=CD_TICKS; }
  }else if(coolTime>0){ --coolTime; }

  /* update nitro bar */
  const pct=boostActive?boostTime/BOOST_TICKS : 1-coolTime/CD_TICKS;
  nitroFill.style.width=Math.round(pct*100)+"%";
  nitroFill.style.background=boostActive?"#19f":"#3f3";   // blue active / green ready
  if(!boostActive && coolTime>0){ nitroFill.style.background="#777"; }

  /* player speed */
  const base=mode==="explosion"?1.3:1.8;
  const speed=boostActive?base*1.8:base;

  /* move player */
  const h=player.body[0];
  const nx=clamp(h.x+player.dir.x*speed,0,MAP_W);
  const ny=clamp(h.y+player.dir.y*speed,0,MAP_H);
  player.body.unshift({x:nx,y:ny});
  if(player.body.length>player.len) player.body.pop();

  /* eat food */
  food=food.filter(f=>dist(f,player.body[0])>10 || !++player.len);

  /* snakes ----------------------------------------------------- */
  if(mode!=="explosion") updateSnakes();
  else                    updateExplosion();

  /* COLLISIONS player & snakes:
     Player dies if hits snake body (not head).
     Snake dies if snake head hits player head.
     Snake dies if player head hits snake head.
  ------------------------------------------------------------ */
  for(const s of snakes){
    if(!s.alive) continue;

    const snakeHead = s.body[0];
    // Check player head vs snake head collision
    if(dist(player.body[0],snakeHead)<10){
      s.alive = false; // snake dies
      continue;
    }

    // Check player head hitting snake body segments (except head)
    for(let i=1; i<s.body.length; i++){
      if(dist(player.body[0], s.body[i])<8){
        playerDies();
        break;
      }
    }

    // Check snake head hitting player body segments except head
    for(let i=1; i<player.body.length; i++){
      if(dist(snakeHead, player.body[i])<8){
        s.alive = false; // snake dies if hits player's body (not head)
        break;
      }
    }
  }

  /* assassination win */
  if(mode==="assassin" && targets.every(t=>!t.alive)){
    showMissionComplete();
  }

  /* camera follow */
  camera.x=clamp(player.body[0].x-cv.width/2,0,MAP_W-cv.width);
  camera.y=clamp(player.body[0].y-cv.height/2,0,MAP_H-cv.height);

}

/* ----- snakes logic (assassin / classical) -------------------- */
function updateSnakes(){
  snakes.forEach(s=>{
    if(!s.alive) return;
    if(mode==="assassin" || mode==="classical"){
      if(s.blue){
        // Blue snakes chase the player aggressively in assassin mode
        const trg = player.body[0];
        s.dir = norm(trg.x - s.body[0].x, trg.y - s.body[0].y);
        moveSnake(s, 1.5);
      } else {
        // Yellow snakes also aggressively chase the player
        const trg = player.body[0];
        // Add slight random noise to avoid perfect tracking
        const noiseX = (Math.random() - 0.5) * 0.4;
        const noiseY = (Math.random() - 0.5) * 0.4;
        s.dir = norm(trg.x - s.body[0].x + noiseX, trg.y - s.body[0].y + noiseY);
        moveSnake(s, 1.3);
      }
    }
  });
}
function moveSnake(s,v){
  const h=s.body[0];
  const nx=clamp(h.x+s.dir.x*v,0,MAP_W), ny=clamp(h.y+s.dir.y*v,0,MAP_H);
  s.body.unshift({x:nx,y:ny});
  if(s.body.length>s.len) s.body.pop();
}

/* ----- explosion-mode logic ----------------------------------- */
function updateExplosion(){
  /* tanks move & shoot */
  tanks.forEach(t=>{
    if(t.dead) return;
    const d=norm(player.body[0].x-t.x,player.body[0].y-t.y);
    t.x=clamp(t.x+d.x*0.6,0,MAP_W);
    t.y=clamp(t.y+d.y*0.6,0,MAP_H);
    if(--t.cd<=0){ fire(tankShots,t.x,t.y,d,1.7,6); t.cd=110; }
  });

  /* tank shells */
  tankShots=tankShots.filter(s=>{
    s.x+=s.dir.x*s.speed; s.y+=s.dir.y*s.speed;
    if(dist(s,player.body[0])<s.r+6) return playerDies(),false;
    return s.x>-20&&s.x<MAP_W+20&&s.y>-20&&s.y<MAP_H+20;
  });

  /* player shots */
  plyShots=plyShots.filter(s=>{
    s.x+=s.dir.x*s.speed; s.y+=s.dir.y*s.speed;
    for(const t of tanks){
      if(t.dead) continue;
      if(dist(s,t)<s.r+t.r){
        t.hp--;
        if(t.hp<=0) t.dead=true;
        return false;
      }
    }
    return s.x>-20&&s.x<MAP_W+20&&s.y>-20&&s.y<MAP_H+20;
  });

  /* remove dead tanks & advance level */
  tanks=tanks.filter(t=>!t.dead);
  if(!tanks.length){
    ++level; newLevel(); spawnPlayer();
  }
}

/* ----- death -------------------------------------------------- */
function playerDies(){
  player.alive=false; boostActive=false;
}

/* ----- mission complete screen ---------------------------------- */
function showMissionComplete(){
  cancelAnimationFrame(loopID);
  ctx.fillStyle="rgba(0,0,0,0.75)";
  ctx.fillRect(0,0,cv.width,cv.height);
  ctx.fillStyle="#0f0";
  ctx.font="48px Arial";
  ctx.textAlign="center";
  ctx.fillText("MISSION ACCOMPLISHED", cv.width/2, cv.height/2 - 20);

  // Show "NEXT ASSASSINATION" button
  if(!document.getElementById("nextAssBtn")){
    const btn = document.createElement("button");
    btn.id = "nextAssBtn";
    btn.textContent = "NEXT ASSASSINATION";
    btn.style.position = "absolute";
    btn.style.left = "50%";
    btn.style.top = (cv.height/2 + 20) + "px";
    btn.style.transform = "translateX(-50%)";
    btn.style.padding = "12px 24px";
    btn.style.fontSize = "20px";
    btn.style.zIndex = 1000;
    btn.style.cursor = "pointer";
    gameBox.appendChild(btn);

    btn.onclick = () => {
      btn.remove();
      level++;
      newLevel();
      spawnPlayer();
      loopID = requestAnimationFrame(loop);
    };
  }
}

/* ===============================================================
   DRAW
================================================================ */
function draw(){
  ctx.clearRect(0,0,cv.width,cv.height);

  /* world border */
  ctx.lineWidth=4; ctx.strokeStyle="#fff";
  ctx.strokeRect(-camera.x,-camera.y,MAP_W,MAP_H);

  food.forEach(f=>dot(f,"red",4));
  bombs.forEach(b=>dot(b,"#111",b.r));
  tanks.forEach(t=>{
    if(t.dead) return;
    dot(t,"gray",t.r);
    drawHealthBar(t);
  });
  tankShots.forEach(s=>dot(s,"orange",s.r*2)); // bigger on minimap, handled in minimap draw
  plyShots.forEach(s=>dot(s,"yellow",s.r));

  snakes.forEach(s=>{
    if(!s.alive) return;
    const c=s.blue?"blue":"yellow";
    s.body.forEach(seg=>dot(seg,c,6));
  });
  player.body.forEach(seg=>dot(seg,"lime",6));

  /* Game-over overlay */
  if(!player.alive){
    ctx.fillStyle="#fff"; ctx.font="40px Arial"; ctx.textAlign="center";
    ctx.fillText("Game Over",cv.width/2,cv.height/2-20);
    showRestart();
  }

  /* minimap */
  if(mapOn) drawMinimap();
}

/* ===============================================================
   HEALTH BAR FOR TANKS
================================================================ */
function drawHealthBar(t){
  const barW=44, barH=6;
  const x= t.x - barW/2 - camera.x;
  const y= t.y - t.r - 12 - camera.y;
  ctx.fillStyle="black";
  ctx.fillRect(x,y,barW,barH);
  ctx.fillStyle="lime";
  ctx.fillRect(x,y,barW*(t.hp/4),barH);
  ctx.strokeStyle="white";
  ctx.lineWidth=1;
  ctx.strokeRect(x,y,barW,barH);
}

/* ===============================================================
   MINIMAP
================================================================ */
function drawMinimap(){
  const SIZE=180, PAD=20, sx=cv.width-SIZE-PAD, sy=cv.height-SIZE-PAD;
  const sc = SIZE/Math.max(MAP_W,MAP_H);

  ctx.save();
  ctx.fillStyle="rgba(0,0,0,.6)";
  ctx.fillRect(sx,sy,SIZE,SIZE);
  ctx.strokeStyle="#fff"; ctx.lineWidth=2;
  ctx.strokeRect(sx,sy,SIZE,SIZE);

  const pnt=(e,c,r=3)=>{ctx.fillStyle=c;ctx.beginPath();
    ctx.arc(sx+e.x*sc,sy+e.y*sc,r,0,6.283);ctx.fill();};

  food.forEach(f=>pnt(f,"red",2));
  bombs.forEach(b=>pnt(b,"#111",2));
  snakes.forEach(s=>s.alive&&pnt(s.body[0],s.blue?"blue":"yellow",3));
  tanks.forEach(t=>pnt(t,"gray",6));
  tankShots.forEach(s=>pnt(s,"orange",4));
  plyShots.forEach(s=>pnt(s,"yellow",2));
  pnt(player.body[0],"lime",4);
  ctx.restore();
}

/* ===============================================================
   RESTART BUTTON
================================================================ */
function showRestart(){
  if(document.getElementById("restartBtn")) return;
  const b=document.createElement("button");
  b.id="restartBtn"; b.textContent="Restart";
  b.onclick=()=>{
    b.remove(); level=1; boostActive=false; boostTime=0; coolTime=0;
    newLevel(); spawnPlayer(); updateInstructions();
  };
  gameBox.appendChild(b);
}

/* ===============================================================
   INSTRUCTION TEXT
================================================================ */
function updateInstructions(){
  const base="WASD/Arrows = Move M = Minimap Space = Toggle Nitro";
  const extra=mode==="explosion"?" J = Shoot":
              mode==="assassin" ?" Goal: Destroy blue snakes": "";
  instrTxt.textContent=base+extra;
  toggle(instrTxt,true);
}
