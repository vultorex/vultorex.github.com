// canvas and context setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const $ = (sel) => document.querySelector(sel);

// UI elements
const menu = $("#menu");
const usernameSection = $("#usernameSection");
const modeSection = $("#modeSection");
const gameContainer = $("#gameContainer");

const assassinTxt = $("#assassinText");
const instructionTxt = $("#instructionText");
const lvlCounter = $("#levelCounter");

const nitroBar = $("#nitroContainer");
const nitroFill = $("#nitroFill");

const joystick = $("#joystick");
const joystickBase = $("#joystick-base");
const joystickKnob = $("#joystick-knob");

// map stuff
const MAP_WIDTH = 4000;
const MAP_HEIGHT = 4000;
const FPS = 60;
const BOOST_DURATION = 8 * FPS;
const COOLDOWN_DURATION = 10 * FPS;

// game state
let currentMode = null;
let player = null;
let level = 1;
let playerName = "";
let cam = { x: 0, y: 0 };
let animationFrameId = 0;
let showMinimap = true;
let boostActive = false;
let boostTimeLeft = 0;
let cooldownTimeLeft = 0;

// entities
let snakes = [];
let food = [];
let targets = [];
let bombs = [];
let tanks = [];
let tankShots = [];
let playerShots = [];

// helpers
function clamp(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

function dist(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function normalizeVec(x, y) {
  let len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function drawCircle(pos, color, radius) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pos.x - cam.x, pos.y - cam.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function toggle(el, show) {
  el.classList.toggle("hidden", !show);
}

// buttons and menus logic
$("#startBtn").onclick = () => {
  toggle(menu, false);
  toggle(usernameSection, true);
};

$("#continueBtn").onclick = () => {
  const val = $("#usernameInput").value.trim();
  if (!val) {
    alert("Please enter your username");
    return;
  }
  playerName = val;
  toggle(usernameSection, false);
  toggle(modeSection, true);
};

$("#backToUsername").onclick = () => {
  toggle(modeSection, false);
  toggle(usernameSection, true);
};

$("#assassinMode").onclick = () => startGame("assassin");
$("#classicalMode").onclick = () => startGame("classical");
$("#explosionMode").onclick = () => startGame("explosion");
$("#backToMenu").onclick = () => exitGame();

function startGame(mode) {
  currentMode = mode;
  level = 1;
  resetAll();

  toggle(modeSection, false);
  toggle(gameContainer, true);
  toggle(assassinTxt, mode === "assassin");
  toggle(nitroBar, true);

  updateInstructions();
  loadLevel();
  spawnPlayer();

  animationFrameId = requestAnimationFrame(mainLoop);
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
  for (let i = 0; i < 60; i++) {
    food.push({ x: Math.random() * MAP_WIDTH, y: Math.random() * MAP_HEIGHT });
  }

  if (currentMode === "assassin") {
    const blueSnakesCount = 2 + level;
    const yellowSnakesCount = 8 + level * 3;
    spawnSnakes(blueSnakesCount + yellowSnakesCount);
    targets = snakes.slice(0, blueSnakesCount);
    targets.forEach(s => s.blue = true);
  } else if (currentMode === "classical") {
    spawnSnakes(25 + level * 4);
  } else if (currentMode === "explosion") {
    spawnBombs(8 + level * 2);
    spawnTanks(5 + level);
  }

  lvlCounter.textContent = `Level ${level}`;
}

function exitGame() {
  cancelAnimationFrame(animationFrameId);
  toggle(gameContainer, false);
  toggle(modeSection, true);
}

function spawnSnakes(count) {
  for (let i = 0; i < count; i++) {
    snakes.push({
      body: [{ x: Math.random() * MAP_WIDTH, y: Math.random() * MAP_HEIGHT }],
      dir: normalizeVec(Math.random() - 0.5, Math.random() - 0.5),
      len: 6,
      alive: true,
      blue: false,
    });
  }
}

function spawnBombs(count) {
  for (let i = 0; i < count; i++) {
    bombs.push({ x: Math.random() * MAP_WIDTH, y: Math.random() * MAP_HEIGHT, r: 8 });
  }
}

function spawnTanks(count) {
  let spacing = MAP_WIDTH / count;
  for (let i = 0; i < count; i++) {
    let x = spacing * i + spacing / 2;
    let y = i % 2 ? MAP_HEIGHT : 0;
    tanks.push({ x, y, angle: 0 });
  }
}

function spawnPlayer() {
  player = {
    x: MAP_WIDTH / 2,
    y: MAP_HEIGHT / 2,
    dir: { x: 0, y: -1 },
    speed: 6,
    len: 6,
    body: [],
    alive: true,
    blue: false,
  };

  for (let i = 0; i < player.len; i++) {
    player.body.push({ x: player.x, y: player.y + i * 10 });
  }

  cam.x = player.x - canvas.width / 2;
  cam.y = player.y - canvas.height / 2;
}

// controls stuff
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

// joystick stuff
let joystickActive = false;
let joyStartPos = null;
let joyCurrentPos = null;
let joyVec = { x: 0, y: 0 };

joystick.addEventListener("touchstart", e => {
  e.preventDefault();
  joystickActive = true;
  const t = e.touches[0];
  const rect = joystick.getBoundingClientRect();
  joyStartPos = { x: t.clientX, y: t.clientY };
  joyCurrentPos = { x: t.clientX, y: t.clientY };
  moveKnob();
});
joystick.addEventListener("touchmove", e => {
  if (!joystickActive) return;
  e.preventDefault();
  const t = e.touches[0];
  joyCurrentPos = { x: t.clientX, y: t.clientY };
  moveKnob();
});
joystick.addEventListener("touchend", e => {
  e.preventDefault();
  joystickActive = false;
  joyVec = { x: 0, y: 0 };
  joystickKnob.style.transform = "translate(-50%, -50%)";
});

function moveKnob() {
  const rect = joystick.getBoundingClientRect();
  let dx = joyCurrentPos.x - (rect.left + rect.width / 2);
  let dy = joyCurrentPos.y - (rect.top + rect.height / 2);
  let dist = Math.min(Math.hypot(dx, dy), rect.width / 2);
  let angle = Math.atan2(dy, dx);
  let knobX = dist * Math.cos(angle);
  let knobY = dist * Math.sin(angle);
  joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

  joyVec.x = knobX / (rect.width / 2);
  joyVec.y = knobY / (rect.height / 2);
}

// main loop
function mainLoop() {
  updateGame();
  drawGame();
  animationFrameId = requestAnimationFrame(mainLoop);
}

function updateGame() {
  // get input dir from keyboard or joystick
  let inputX = 0;
  let inputY = 0;

  if (joystickActive) {
    inputX = joyVec.x;
    inputY = joyVec.y;
  } else {
    if (keys["arrowup"] || keys["w"]) inputY -= 1;
    if (keys["arrowdown"] || keys["s"]) inputY += 1;
    if (keys["arrowleft"] || keys["a"]) inputX -= 1;
    if (keys["arrowright"] || keys["d"]) inputX += 1;
  }

  if (inputX !== 0 || inputY !== 0) {
    const norm = normalizeVec(inputX, inputY);
    player.dir = norm;
  }

  // nitro boost handling
  if (keys[" "]) {
    if (boostTimeLeft > 0) {
      boostActive = true;
      boostTimeLeft--;
    } else {
      boostActive = false;
      if (cooldownTimeLeft === 0) cooldownTimeLeft = COOLDOWN_DURATION;
    }
  } else {
    boostActive = false;
    if (boostTimeLeft < BOOST_DURATION && cooldownTimeLeft === 0) {
      boostTimeLeft++;
    }
  }

  if (cooldownTimeLeft > 0) cooldownTimeLeft--;

  // update nitro bar UI
  nitroFill.style.width = `${(boostTimeLeft / BOOST_DURATION) * 100}%`;

  // move player
  let spd = boostActive ? player.speed * 2.1 : player.speed;
  player.x += player.dir.x * spd;
  player.y += player.dir.y * spd;

  // keep inside circular map bounds
  const centerX = MAP_WIDTH / 2;
  const centerY = MAP_HEIGHT / 2;
  const maxRadius = MAP_WIDTH / 2 - 20;
  let distToCenter = dist(player, { x: centerX, y: centerY });
  if (distToCenter > maxRadius) {
    let dirToCenter = normalizeVec(centerX - player.x, centerY - player.y);
    player.x = centerX - dirToCenter.x * maxRadius;
    player.y = centerY - dirToCenter.y * maxRadius;
  }

  // update player body
  player.body.unshift({ x: player.x, y: player.y });
  while (player.body.length > player.len * 5) player.body.pop();

  cam.x = player.x - canvas.width / 2;
  cam.y = player.y - canvas.height / 2;

  // simple AI snake wandering
  snakes.forEach(s => {
    if (Math.random() < 0.02) {
      s.dir = normalizeVec(Math.random() - 0.5, Math.random() - 0.5);
    }
    s.body[0].x += s.dir.x * 2;
    s.body[0].y += s.dir.y * 2;

    s.body.unshift({ x: s.body[0].x, y: s.body[0].y });
    while (s.body.length > s.len * 5) s.body.pop();
  });
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // map circle border
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(MAP_WIDTH / 2 - cam.x, MAP_HEIGHT / 2 - cam.y, MAP_WIDTH / 2 - 10, 0, Math.PI * 2);
  ctx.stroke();

  // draw food
  food.forEach(f => drawCircle(f, "red", 6));

  // bombs
  bombs.forEach(b => {
    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // tanks
  tanks.forEach(t => {
    ctx.fillStyle = "gray";
    ctx.fillRect(t.x - cam.x - 15, t.y - cam.y - 15, 30, 30);
  });

  // snakes (blue or yellow)
  snakes.forEach(s => {
    const color = s.blue ? "blue" : "yellow";
    s.body.forEach((p, i) => {
      drawCircle(p, color, 5 - i * 0.05);
    });
  });

  // player snake
  player.body.forEach((p, i) => {
    drawCircle(p, "white", 6 - i * 0.08);
  });

  // instructions text
  instructionTxt.textContent = currentMode === "assassin"
    ? "Destroy all blue snakes"
    : currentMode === "classical"
      ? "Eat food and survive"
      : currentMode === "explosion"
        ? "Avoid bombs and tanks"
        : "";
  toggle(instructionTxt, true);
}

// resize canvas when window size changes
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

function updateInstructions() {
  // could add more instruction updates here
}

// init on page load
function init() {
  toggle(menu, true);
  toggle(usernameSection, false);
  toggle(modeSection, false);
  toggle(gameContainer, false);
  toggle(joystick, window.matchMedia("(pointer: coarse)").matches);
}

init();
