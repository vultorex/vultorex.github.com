// --- setup stuff ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const grab = sel => document.querySelector(sel);

// menus
const menu = grab("#menu");
const userInputBox = grab("#usernameSection");
const modePicker = grab("#modeSection");
const gameUI = grab("#gameContainer");

const assText = grab("#assassinText");
const instructions = grab("#instructionText");
const levelDisplay = grab("#levelCounter");

const nitroBar = grab("#nitroContainer");
const nitroFill = grab("#nitroFill");

// consts
const MAP_W = 4000, MAP_H = 4000;
const FPS = 60;
const BOOST_TIME = 8 * FPS;
const COOLDOWN_TIME = 10 * FPS;

// state
let currentMode = null;
let player = null;
let level = 1;
let name = "";
let cam = { x: 0, y: 0 };
let loop = 0;
let showMap = true;
let boostOn = false;
let boostLeft = 0;
let cooldownLeft = 0;

// game stuff
let snakes = [], food = [], targets = [];
let bombs = [], tanks = [], tankShots = [], playerShots = [];

// utils
const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
const distance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
const normalize = (dx, dy) => {
  let len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
};
const drawCircle = (pos, color, r) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pos.x - cam.x, pos.y - cam.y, r, 0, Math.PI * 2);
  ctx.fill();
};
const toggle = (el, visible) => el.classList.toggle("hidden", !visible);

// start menu logic
grab("#startBtn").onclick = () => {
  toggle(menu, false);
  toggle(userInputBox, true);
};

grab("#continueBtn").onclick = () => {
  const val = grab("#usernameInput").value.trim();
  if (!val) return alert("enter a name");
  name = val;
  toggle(userInputBox, false);
  toggle(modePicker, true);
};

grab("#backToUsername").onclick = () => {
  toggle(modePicker, false);
  toggle(userInputBox, true);
};

grab("#assassinMode").onclick = () => startGame("assassin");
grab("#classicalMode").onclick = () => startGame("classical");
grab("#explosionMode").onclick = () => startGame("explosion");
grab("#backToMenu").onclick = () => quitGame();
function startGame(mode) {
  currentMode = mode;
  level = 1;
  resetAll();

  toggle(modePicker, false);
  toggle(gameUI, true);
  toggle(assText, mode === "assassin");
  toggle(nitroBar, true);

  updateInstructions();
  loadLevel();
  placePlayer();

  loop = requestAnimationFrame(gameLoop);
}

function resetAll(clearPlayer = true) {
  snakes = [];
  food = [];
  targets = [];
  bombs = [];
  tanks = [];
  tankShots = [];
  playerShots = [];
  if (clearPlayer) player = null;
}

function loadLevel() {
  resetAll(false);
  for (let i = 0; i < 60; i++) food.push({ x: Math.random() * MAP_W, y: Math.random() * MAP_H });

  if (currentMode === "assassin") {
    let blueCount = 2 + level;
    let yellowCount = 8 + level * 3;
    spawnSnakes(blueCount + yellowCount);
    targets = snakes.slice(0, blueCount);
    targets.forEach(s => s.blue = true);
  } else if (currentMode === "classical") {
    spawnSnakes(25 + level * 4);
  } else if (currentMode === "explosion") {
    spawnBombs(8 + level * 2);
    spawnTanks(5 + level);
  }

  levelDisplay.textContent = `Level ${level}`;
}

function quitGame() {
  cancelAnimationFrame(loop);
  toggle(gameUI, false);
  toggle(modePicker, true);
}

function spawnSnakes(count) {
  for (let i = 0; i < count; i++) {
    snakes.push({
      body: [{ x: Math.random() * MAP_W, y: Math.random() * MAP_H }],
      dir: normalize(Math.random() - 0.5, Math.random() - 0.5),
      len: 6,
      alive: true,
      blue: false
    });
  }
}

function spawnBombs(count) {
  for (let i = 0; i < count; i++) bombs.push({ x: Math.random() * MAP_W, y: Math.random() * MAP_H, r: 8 });
}

function spawnTanks(count) {
  let spacing = MAP_W / count;
  for (let i = 0; i < count; i++) {
    let x = spacing * i + spacing / 2;
    let y = i % 2 ? MAP_H : 0;
    tanks.push({ x, y, r: 22, hp: 4, cd: 0, dead: false });
  }
}

function placePlayer() {
  let placed = false;
  while (!placed) {
    let x = Math.random() * MAP_W;
    let y = Math.random() * MAP_H;
    placed = snakes.every(s => distance({ x, y }, s.body[0]) > 150);
    if (placed) {
      player = { name, body: [{ x, y }], dir: { x: 1, y: 0 }, len: 6, alive: true };
    }
  }
}


// keyboard
document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();

  // minimap toggle
  if (k === "m") showMap = !showMap;

  if (!player || !player.alive) return;

  // basic movement
  if (k === "w" || k === "arrowup")    player.dir = { x: 0,  y: -1 };
  if (k === "s" || k === "arrowdown")  player.dir = { x: 0,  y:  1 };
  if (k === "a" || k === "arrowleft")  player.dir = { x: -1, y:  0 };
  if (k === "d" || k === "arrowright") player.dir = { x: 1,  y:  0 };

  // nitro (space)
  if (k === " ") {
    if (boostOn) {                      // turn it off early
      boostOn = false;
      cooldownLeft = COOLDOWN_TIME;
    } else if (cooldownLeft === 0) {    // fire it up
      boostOn = true;
      boostLeft = BOOST_TIME;
    }
  }

  // shooting – only in explosion mode, J key
  if (k === "j" && currentMode === "explosion") {
    const head = player.body[0];
    if (player.dir.x || player.dir.y) {
      playerShots.push({
        x: head.x,
        y: head.y,
        dir: { ...player.dir },
        speed: 3.5,
        r: 5
      });
    }
  }
});

// --------------------------------------------------
// Game Loop
// --------------------------------------------------
function gameLoop () {
  update();
  render();
  loop = requestAnimationFrame(gameLoop);
}

function update () {
  if (!player?.alive) return;        // dead players don’t move

  // --- nitro timers ---
  if (boostOn) {
    boostLeft--;
    if (boostLeft <= 0) {
      boostOn = false;
      cooldownLeft = COOLDOWN_TIME;
    }
  } else if (cooldownLeft > 0) {
    cooldownLeft--;
  }

  // nitro bar width & colour
  let pct = boostOn ? boostLeft / BOOST_TIME
                    : 1 - cooldownLeft / COOLDOWN_TIME;
  nitroFill.style.width = Math.round(pct * 100) + "%";
  nitroFill.style.background = boostOn ? "#19f"
                          : (cooldownLeft ? "#777" : "#3f3");

  // --- player move & eat ---
  let speedBase = currentMode === "explosion" ? 1.3 : 1.8;
  let speed = boostOn ? speedBase * 1.8 : speedBase;

  let head = player.body[0];
  let nx = clamp(head.x + player.dir.x * speed, 0, MAP_W);
  let ny = clamp(head.y + player.dir.y * speed, 0, MAP_H);

  player.body.unshift({ x: nx, y: ny });
  if (player.body.length > player.len) player.body.pop();

  // munch food
  food = food.filter(f => {
    if (distance(f, player.body[0]) < 10) {
      player.len++;
      return false;
    }
    return true;
  });

  // update according to current mode
  if (currentMode === "explosion") {
    updateExplosionMode();
  } else {
    updateSnakeAI();
  }

  // basic collisions between player & snakes
  handleSnakeCollisions();

  // assassination complete check
  if (currentMode === "assassin" && targets.every(t => !t.alive)) {
    missionAccomplished();
  }

  // follow cam
  cam.x = clamp(player.body[0].x - canvas.width / 2,  0, MAP_W - canvas.width);
  cam.y = clamp(player.body[0].y - canvas.height / 2, 0, MAP_H - canvas.height);
}

// -------------------------------------------
// AI for classical and assassination modes
// -------------------------------------------
function updateSnakeAI () {
  snakes.forEach(s => {
    if (!s.alive) return;

    let tgt = player.body[0];               // always chase player
    let noiseX = (Math.random() - 0.5) * 0.4;
    let noiseY = (Math.random() - 0.5) * 0.4;

    // blue snakes ~ super‑locked; yellows add wiggle
    if (s.blue) {
      s.dir = normalize(tgt.x - s.body[0].x, tgt.y - s.body[0].y);
      moveSnake(s, 1.5);
    } else {
      s.dir = normalize(tgt.x - s.body[0].x + noiseX,
                        tgt.y - s.body[0].y + noiseY);
      moveSnake(s, 1.3);
    }
  });
}

function moveSnake (s, vel) {
  let h = s.body[0];
  let nextX = clamp(h.x + s.dir.x * vel, 0, MAP_W);
  let nextY = clamp(h.y + s.dir.y * vel, 0, MAP_H);
  s.body.unshift({ x: nextX, y: nextY });
  if (s.body.length > s.len) s.body.pop();
}

// -------------------------------------------
// Explosion mode – tanks, bombs, bullets, why did i do this
// -------------------------------------------
function updateExplosionMode () {
  // tanks move + shoot
  tanks.forEach(t => {
    if (t.dead) return;
    let d = normalize(player.body[0].x - t.x, player.body[0].y - t.y);
    t.x = clamp(t.x + d.x * 0.6, 0, MAP_W);
    t.y = clamp(t.y + d.y * 0.6, 0, MAP_H);

    if (--t.cd <= 0) {
      tankShots.push({ x: t.x, y: t.y, dir: d, speed: 1.7, r: 6 });
      t.cd = 110;          // little breather between shots
    }
  });

  // tank bullets
  tankShots = tankShots.filter(b => {
    b.x += b.dir.x * b.speed;
    b.y += b.dir.y * b.speed;

    if (distance(b, player.body[0]) < b.r + 6) {
      playerDies();
      return false;
    }

    return b.x > -20 && b.x < MAP_W + 20 &&
           b.y > -20 && b.y < MAP_H + 20;
  });

  // player bullets
  playerShots = playerShots.filter(b => {
    b.x += b.dir.x * b.speed;
    b.y += b.dir.y * b.speed;

    for (let t of tanks) {
      if (t.dead) continue;
      if (distance(b, t) < b.r + t.r) {
        t.hp--;
        if (t.hp <= 0) t.dead = true;
        return false;        // bullet gone
      }
    }

    return b.x > -20 && b.x < MAP_W + 20 &&
           b.y > -20 && b.y < MAP_H + 20;
  });

  // done? next level
  if (tanks.every(t => t.dead)) {
    level++;
    loadLevel();
    placePlayer();
  }
}

// --------------------------------------------------
// snake  player collisions
// --------------------------------------------------
function handleSnakeCollisions () {
  snakes.forEach(s => {
    if (!s.alive) return;

    const snakeHead = s.body[0];

    // head‑to‑head = snake dies
    if (distance(player.body[0], snakeHead) < 10) {
      s.alive = false;
      return;
    }

    // player bumps snake body → rip
    for (let i = 1; i < s.body.length; i++) {
      if (distance(player.body[0], s.body[i]) < 8) {
        playerDies();
        return;
      }
    }

    // snake head into player body → snake dies
    for (let i = 1; i < player.body.length; i++) {
      if (distance(snakeHead, player.body[i]) < 8) {
        s.alive = false;
        break;
      }
    }
  });
}

// --------------------------------------------------
// death, mission complete, restart bruuuuuh
// --------------------------------------------------
function playerDies () {
  player.alive = false;
  boostOn = false;
}

function missionAccomplished () {
  cancelAnimationFrame(loop);

  // dark overlay
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f0";
  ctx.font = "48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("MISSION COMPLETE", canvas.width / 2, canvas.height / 2 - 20);

  // next button (only add once)
  if (!grab("#nextAssBtn")) {
    const btn = document.createElement("button");
    btn.id = "nextAssBtn";
    btn.textContent = "NEXT ASSASSINATION";
    btn.style.position = "absolute";
    btn.style.left = "50%";
    btn.style.top = (canvas.height / 2 + 20) + "px";
    btn.style.transform = "translateX(-50%)";
    btn.style.padding = "12px 26px";
    btn.style.fontSize = "20px";
    btn.style.zIndex = 1000;
    gameUI.appendChild(btn);

    btn.onclick = () => {
      btn.remove();
      level++;
      loadLevel();
      placePlayer();
      loop = requestAnimationFrame(gameLoop);
    };
  }
}

function showRestartButton () {
  if (grab("#restartBtn")) return;

  const b = document.createElement("button");
  b.id = "restartBtn";
  b.textContent = "Restart";
  gameUI.appendChild(b);

  b.onclick = () => {
    b.remove();
    level = 1;
    boostOn = false;
    boostLeft = 0;
    cooldownLeft = 0;

    loadLevel();
    placePlayer();
    updateInstructions();
  };
}

// --------------------------------------------------
// drawing
// --------------------------------------------------
function render () {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // world border
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(-cam.x, -cam.y, MAP_W, MAP_H);

  // bits & bobs
  food.forEach(f => drawCircle(f, "red", 4));
  bombs.forEach(b => drawCircle(b, "#111", b.r));
  tankShots.forEach(s => drawCircle(s, "orange", s.r * 2));
  playerShots.forEach(s => drawCircle(s, "yellow", s.r));

  snakes.forEach(s => {
    if (!s.alive) return;
    const c = s.blue ? "blue" : "yellow";
    s.body.forEach(seg => drawCircle(seg, c, 6));
  });

  tanks.forEach(t => {
    if (t.dead) return;
    drawCircle(t, "gray", t.r);
    drawTankHP(t);
  });

  player.body.forEach(seg => drawCircle(seg, "lime", 6));

  // dead overlay
  if (!player.alive) {
    ctx.fillStyle = "#fff";
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 20);
    showRestartButton();
  }

  // minimap
  if (showMap) drawMini();
}

function drawTankHP (t) {
  const barW = 44, barH = 6;
  let x = t.x - barW / 2 - cam.x;
  let y = t.y - t.r - 12 - cam.y;

  ctx.fillStyle = "black";
  ctx.fillRect(x, y, barW, barH);

  ctx.fillStyle = "lime";
  ctx.fillRect(x, y, barW * (t.hp / 4), barH);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barW, barH);
}

function drawMini () {
  const SIZE = 180, PAD = 20;
  const mx = canvas.width - SIZE - PAD;
  const my = canvas.height - SIZE - PAD;
  const scale = SIZE / Math.max(MAP_W, MAP_H);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(mx, my, SIZE, SIZE);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, SIZE, SIZE);

  const dot = (e, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + e.x * scale, my + e.y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };

  food.forEach(f => dot(f, "red", 2));
  bombs.forEach(b => dot(b, "#111", 2));
  snakes.forEach(s => s.alive && dot(s.body[0], s.blue ? "blue" : "yellow", 3));
  tanks.forEach(t => !t.dead && dot(t, "gray", 6));
  tankShots.forEach(s => dot(s, "orange", 4));
  playerShots.forEach(s => dot(s, "yellow", 2));

  dot(player.body[0], "lime", 4);
  ctx.restore();
}

// --------------------------------------------------
// instruction stuff bar
// --------------------------------------------------
function updateInstructions () {
  const base = "Move: WASD/Arrows  |  Toggle Map: M  |  Nitro: Space";
  const extra = currentMode === "explosion" ? "  |  Shoot: J"
              : currentMode === "assassin"  ? "  |  Goal: eat blue snakes"
              : "";
  instructions.textContent = base + extra;
  toggle(instructions, true);
}
