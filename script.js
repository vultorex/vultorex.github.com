// Grab elements helper
const $ = (selector) => document.querySelector(selector);

// Canvas & context
const canvas = $("#gameCanvas");
const ctx = canvas.getContext("2d");

// Set canvas size
function setCanvasSize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
setCanvasSize();
window.addEventListener("resize", setCanvasSize);
window.addEventListener("orientationchange", () => {
  setTimeout(setCanvasSize, 300); // slight delay for orientation change
});

// UI elements
const menu = $("#menu");
const usernameSection = $("#usernameSection");
const modeSection = $("#modeSection");
const gameContainer = $("#gameContainer");

const assassinText = $("#assassinText");
const instructionText = $("#instructionText");
const levelDisplay = $("#levelDisplay");

const nitroContainer = $("#nitroContainer");
const nitroFill = $("#nitroFill");

const joystick = $("#joystick");
const joystickBase = $("#joystick-base");
const joystickKnob = $("#joystick-knob");

const backToMenuBtn = $("#backToMenu");

// Constants
const MAP_SIZE = 4000;
const FPS = 60;

const BOOST_MAX = 8 * FPS;
const COOLDOWN_MAX = 10 * FPS;

// Game state
let mode = null;
let player = null;
let level = 1;
let username = "";
let camera = { x: 0, y: 0 };
let animId = 0;

let nitroActive = false;
let nitroTimeLeft = BOOST_MAX;
let nitroCooldown = 0;

let snakes = [];
let food = [];
let targets = [];
let bombs = [];
let tanks = [];
let tankShots = [];
let playerShots = [];

// Utils
function clamp(val, min, max) {
  return Math.max(min, Math.min(val, max));
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}
function drawCircle(pos, color, radius) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pos.x - camera.x, pos.y - camera.y, radius, 0, Math.PI * 2);
  ctx.fill();
}
function toggle(el, show) {
  el.classList.toggle("hidden", !show);
}

// -- UI Buttons --

$("#startBtn").onclick = () => {
  toggle(menu, false);
  toggle(usernameSection, true);
};

$("#continueBtn").onclick = () => {
  const val = $("#usernameInput").value.trim();
  if (!val) {
    alert("Please type a username first!");
    return;
  }
  username = val;
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

backToMenuBtn.onclick = () => {
  cancelAnimationFrame(animId);
  toggle(gameContainer, false);
  toggle(modeSection, true);
  // Reset joystick and keys on back to menu
  joystickActive = false;
  joyVector = { x: 0, y: 0 };
};

// -- Game setup --

function startGame(selectedMode) {
  mode = selectedMode;
  level = 1;
  resetEntities(true);

  toggle(modeSection, false);
  toggle(gameContainer, true);
  toggle(assassinText, mode === "assassin");
  toggle(nitroContainer, true);

  updateInstructionText();
  loadLevelData();
  spawnPlayer();

  animId = requestAnimationFrame(gameLoop);
}

function resetEntities(clearPlayer = true) {
  snakes = [];
  food = [];
  targets = [];
  bombs = [];
  tanks = [];
  tankShots = [];
  playerShots = [];
  if (clearPlayer) player = null;
}

function loadLevelData() {
  resetEntities(false);

  // add food randomly
  for (let i = 0; i < 60; i++) {
    food.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE });
  }

  if (mode === "assassin") {
    let blueCount = 2 + level;
    let yellowCount = 8 + level * 3;
    spawnSnakes(blueCount + yellowCount);
    targets = snakes.slice(0, blueCount);
    targets.forEach(s => s.blue = true);
  } else if (mode === "classical") {
    spawnSnakes(25 + level * 4);
  } else if (mode === "explosion") {
    spawnBombs(8 + level * 2);
    spawnTanks(5 + level);
  }

  levelDisplay.textContent = `Level ${level}`;
}

function spawnSnakes(num) {
  for (let i = 0; i < num; i++) {
    snakes.push({
      body: [{ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE }],
      dir: normalize(Math.random() - 0.5, Math.random() - 0.5),
      len: 6,
      alive: true,
      blue: false,
    });
  }
}

function spawnBombs(num) {
  for (let i = 0; i < num; i++) {
    bombs.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, r: 8 });
  }
}

function spawnTanks(num) {
  const spacing = MAP_SIZE / num;
  for (let i = 0; i < num; i++) {
    let x = spacing * i + spacing / 2;
    let y = (i % 2 === 0) ? MAP_SIZE : 0;
    tanks.push({ x, y, angle: 0 });
  }
}

function spawnPlayer() {
  player = {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
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

  camera.x = player.x - canvas.width / 2;
  camera.y = player.y - canvas.height / 2;
}

// -- Controls --

const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  // prevent page scroll on arrows or space
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

// -- Joystick setup --
// For mobile/touch controls

let joystickActive = false;
let joyStartPos = null;
let joyCurrentPos = null;
let joyVector = { x: 0, y: 0 };

joystick.addEventListener("touchstart", e => {
  e.preventDefault();
  joystickActive = true;
  const touch = e.touches[0];
  const rect = joystick.getBoundingClientRect();
  joyStartPos = { x: touch.clientX, y: touch.clientY };
  joyCurrentPos = { x: touch.clientX, y: touch.clientY };
  updateJoystickKnob();
});

joystick.addEventListener("touchmove", e => {
  if (!joystickActive) return;
  e.preventDefault();
  const touch = e.touches[0];
  joyCurrentPos = { x: touch.clientX, y: touch.clientY };
  updateJoystickKnob();
});

joystick.addEventListener("touchend", e => {
  e.preventDefault();
  joystickActive = false;
  joyVector = { x: 0, y: 0 };
  joystickKnob.style.transform = "translate(-50%, -50%)";
});

function updateJoystickKnob() {
  const rect = joystick.getBoundingClientRect();
  let dx = joyCurrentPos.x - (rect.left + rect.width / 2);
  let dy = joyCurrentPos.y - (rect.top + rect.height / 2);

  // limit knob movement to radius of base
  const maxDist = rect.width / 2;
  let dist = Math.min(Math.hypot(dx, dy), maxDist);
  let angle = Math.atan2(dy, dx);

  let knobX = dist * Math.cos(angle);
  let knobY = dist * Math.sin(angle);

  joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

  joyVector.x = knobX / maxDist;
  joyVector.y = knobY / maxDist;
}

// -- Main game loop --

function gameLoop() {
  update();
  draw();
  animId = requestAnimationFrame(gameLoop);
}

function update() {
  if (!player || !player.alive) return;

  // get input vector (joystick or keyboard)
  let inputX = 0;
  let inputY = 0;

  if (joystickActive) {
    inputX = joyVector.x;
    inputY = joyVector.y;
  } else {
    if (keys["arrowup"] || keys["w"]) inputY -= 1;
    if (keys["arrowdown"] || keys["s"]) inputY += 1;
    if (keys["arrowleft"] || keys["a"]) inputX -= 1;
    if (keys["arrowright"] || keys["d"]) inputX += 1;
  }

  if (inputX !== 0 || inputY !== 0) {
    const norm = normalize(inputX, inputY);
    player.dir = norm;
  }

  // nitro boost logic
  if (keys[" "]) {
    if (nitroTimeLeft > 0) {
      nitroActive = true;
      nitroTimeLeft--;
    } else {
      nitroActive = false;
      if (nitroCooldown === 0) nitroCooldown = COOLDOWN_MAX;
    }
  } else {
    nitroActive = false;
    if (nitroTimeLeft < BOOST_MAX && nitroCooldown === 0) {
      nitroTimeLeft++;
    }
  }

  if (nitroCooldown > 0) nitroCooldown--;

  // update nitro bar UI
  nitroFill.style.width = `${(nitroTimeLeft / BOOST_MAX) * 100}%`;

  // move player with speed + boost
  let speed = nitroActive ? player.speed * 2.1 : player.speed;
  player.x += player.dir.x * speed;
  player.y += player.dir.y * speed;

  // keep player inside circular map bounds
  const center = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
  const maxRadius = MAP_SIZE / 2 - 20;
  const distToCenter = distance(player, center);
  if (distToCenter > maxRadius) {
    const dirToCenter = normalize(center.x - player.x, center.y - player.y);
    player.x = center.x - dirToCenter.x * maxRadius;
    player.y = center.y - dirToCenter.y * maxRadius;
  }

  // update player body segments
  player.body.unshift({ x: player.x, y: player.y });
  while (player.body.length > player.len * 5) player.body.pop();

  // camera follows player
  camera.x = player.x - canvas.width / 2;
  camera.y = player.y - canvas.height / 2;

  // update AI snakes - simple wandering
  snakes.forEach(snake => {
    if (Math.random() < 0.02) {
      snake.dir = normalize(Math.random() - 0.5, Math.random() - 0.5);
    }
    snake.body[0].x += snake.dir.x * 2;
    snake.body[0].y += snake.dir.y * 2;

    snake.body.unshift({ x: snake.body[0].x, y: snake.body[0].y });
    while (snake.body.length > snake.len * 5) snake.body.pop();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw circular map boundary
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(MAP_SIZE / 2 - camera.x, MAP_SIZE / 2 - camera.y, MAP_SIZE / 2 - 10, 0, Math.PI * 2);
  ctx.stroke();

  // draw food
  food.forEach(f => drawCircle(f, "red", 6));

  // draw bombs
  bombs.forEach(b => {
    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.arc(b.x - camera.x, b.y - camera.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // draw tanks
  tanks.forEach(t => {
    ctx.fillStyle = "gray";
    ctx.fillRect(t.x - camera.x - 15, t.y - camera.y - 15, 30, 30);
  });

  // draw snakes
  snakes.forEach(snake => {
    const c = snake.blue ? "blue" : "yellow";
    snake.body.forEach((pos, idx) => {
      drawCircle(pos, c, 5 - idx * 0.05);
    });
  });

  // draw player snake in white
  player.body.forEach((pos, idx) => {
    drawCircle(pos, "white", 6 - idx * 0.08);
  });

  // update instruction text depending on mode
  if (mode === "assassin") {
    instructionText.textContent = "Destroy all blue snakes";
  } else if (mode === "classical") {
    instructionText.textContent = "Eat food and survive";
  } else if (mode === "explosion") {
    instructionText.textContent = "Avoid bombs and tanks";
  } else {
    instructionText.textContent = "";
  }
  toggle(instructionText, true);
}

// Show joystick only if device is touch capable
function init() {
  toggle(menu, true);
  toggle(usernameSection, false);
  toggle(modeSection, false);
  toggle(gameContainer, false);

  // Check for touch device
  const isTouchDevice = ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  toggle(joystick, isTouchDevice);
}

init();
