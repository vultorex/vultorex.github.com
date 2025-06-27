// --- setup ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const $ = (s) => document.querySelector(s);

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
const joystickKnob = $("#joystick-knob");

// Map constants
const MAP_WIDTH = 4000;
const MAP_HEIGHT = 4000;
const FPS = 60;
const BOOST_DURATION = 8 * FPS;
const COOLDOWN_DURATION = 10 * FPS;

// Game state
let player = null;
let currentMode = null;
let level = 1;
let playerName = "";
let cam = { x: 0, y: 0 };
let animationFrameId = 0;
let boostActive = false;
let boostTimeLeft = BOOST_DURATION;
let cooldownTimeLeft = 0;

// Entities
let snakes = [], food = [], targets = [], bombs = [], tanks = [], tankShots = [], playerShots = [];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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

// Menu logic
$("#startBtn").onclick = () => {
  toggle(menu, false);
  toggle(usernameSection, true);
};

$("#continueBtn").onclick = () => {
  let val = $("#usernameInput").value.trim();
  if (!val) return alert("Enter your username");
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

function exitGame() {
  cancelAnimationFrame(animationFrameId);
  toggle(gameContainer, false);
  toggle(modeSection, true);
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
    const blueCount = 2 + level;
    const yellowCount = 8 + level * 3;
    spawnSnakes(blueCount + yellowCount);
    targets = snakes.slice(0, blueCount);
    targets.forEach(s => s.blue = true);
  } else if (currentMode === "classical") {
    spawnSnakes(25 + level * 4);
  } else if (currentMode === "explosion") {
    spawnBombs(8 + level * 2);
    spawnTanks(5 + level);
  }
  lvlCounter.textContent = `Level ${level}`;
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

const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

let joyVec = { x: 0, y: 0 }, joyActive = false, joyStart = null;
joystick.addEventListener("touchstart", e => {
  e.preventDefault();
  joyActive = true;
  const t = e.touches[0];
  joyStart = { x: t.clientX, y: t.clientY };
});
joystick.addEventListener("touchmove", e => {
  if (!joyActive) return;
  e.preventDefault();
  const t = e.touches[0];
  let dx = t.clientX - joyStart.x;
  let dy = t.clientY - joyStart.y;
  let dist = Math.min(Math.hypot(dx, dy), 40);
  let angle = Math.atan2(dy, dx);
  joyVec.x = Math.cos(angle);
  joyVec.y = Math.sin(angle);
  joystickKnob.style.transform = `translate(calc(-50% + ${dist * joyVec.x}px), calc(-50% + ${dist * joyVec.y}px))`;
});
joystick.addEventListener("touchend", () => {
  joyActive = false;
  joyVec = { x: 0, y: 0 };
  joystickKnob.style.transform = "translate(-50%, -50%)";
});

function mainLoop() {
  updateGame();
  drawGame();
  animationFrameId = requestAnimationFrame(mainLoop);
}

function updateGame() {
  let inputX = 0, inputY = 0;
  if (joyActive) {
    inputX = joyVec.x;
    inputY = joyVec.y;
  } else {
    if (keys["w"] || keys["arrowup"]) inputY -= 1;
    if (keys["s"] || keys["arrowdown"]) inputY += 1;
    if (keys["a"] || keys["arrowleft"]) inputX -= 1;
    if (keys["d"] || keys["arrowright"]) inputX += 1;
  }
  if (inputX !== 0 || inputY !== 0) {
    player.dir = normalizeVec(inputX, inputY);
  }

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
    if (boostTimeLeft < BOOST_DURATION && cooldownTimeLeft === 0) boostTimeLeft++;
  }
  if (cooldownTimeLeft > 0) cooldownTimeLeft--;
  nitroFill.style.width = `${(boostTimeLeft / BOOST_DURATION) * 100}%`;

  let spd = boostActive ? player.speed * 2.1 : player.speed;
  player.x += player.dir.x * spd;
  player.y += player.dir.y * spd;

  const centerX = MAP_WIDTH / 2, centerY = MAP_HEIGHT / 2, maxRadius = MAP_WIDTH / 2 - 20;
  if (dist(player, { x: centerX, y: centerY }) > maxRadius) {
    let dirBack = normalizeVec(centerX - player.x, centerY - player.y);
    player.x = centerX - dirBack.x * maxRadius;
    player.y = centerY - dirBack.y * maxRadius;
  }

  player.body.unshift({ x: player.x, y: player.y });
  while (player.body.length > player.len * 5) player.body.pop();
  cam.x = player.x - canvas.width / 2;
  cam.y = player.y - canvas.height / 2;

  snakes.forEach(s => {
    if (Math.random() < 0.02) s.dir = normalizeVec(Math.random() - 0.5, Math.random() - 0.5);
    s.body[0].x += s.dir.x * 2;
    s.body[0].y += s.dir.y * 2;
    s.body.unshift({ x: s.body[0].x, y: s.body[0].y });
    while (s.body.length > s.len * 5) s.body.pop();
  });
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#555";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(MAP_WIDTH / 2 - cam.x, MAP_HEIGHT / 2 - cam.y, MAP_WIDTH / 2 - 10, 0, Math.PI * 2);
  ctx.stroke();

  food.forEach(f => drawCircle(f, "red", 6));
  bombs.forEach(b => drawCircle(b, "orange", b.r));
  tanks.forEach(t => ctx.fillRect(t.x - cam.x - 15, t.y - cam.y - 15, 30, 30));
  snakes.forEach(s => s.body.forEach((p, i) => drawCircle(p, s.blue ? "blue" : "yellow", 5 - i * 0.05)));
  player.body.forEach((p, i) => drawCircle(p, "white", 6 - i * 0.08));

  instructionTxt.textContent =
    currentMode === "assassin" ? "Destroy all blue snakes"
    : currentMode === "classical" ? "Eat food and survive"
    : currentMode === "explosion" ? "Avoid bombs and tanks"
    : "";
  toggle(instructionTxt, true);
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

function updateInstructions() {}

function init() {
  toggle(menu, true);
  toggle(usernameSection, false);
  toggle(modeSection, false);
  toggle(gameContainer, false);
  toggle(joystick, window.matchMedia("(pointer: coarse)").matches);
}

init();
