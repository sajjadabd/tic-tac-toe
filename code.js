"use strict";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
const NAMES = { X: "Pink", O: "Blue" };

const boardEl = document.getElementById("board");
const strikeEl = document.getElementById("strike");
const statusEl = document.getElementById("status");
const scoreEls = { X: document.getElementById("score-x"), O: document.getElementById("score-o"), D: document.getElementById("score-d") };
const modeCpu = document.getElementById("mode-cpu");
const modeTwo = document.getElementById("mode-two");

let board, turn, over, vsCpu = true, starter = "X";
const scores = { X: 0, O: 0, D: 0 };

const MARKS = {
  X: '<svg class="x" viewBox="0 0 100 100"><path pathLength="1" d="M18 18 L82 82"/><path pathLength="1" d="M82 18 L18 82"/></svg>',
  O: '<svg class="o" viewBox="0 0 100 100"><circle pathLength="1" cx="50" cy="50" r="33"/></svg>',
};

/* ---------- Game rules ---------- */
function winnerOf(b) {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line };
  }
  return null;
}

/* ---------- Computer: minimax (never loses) ---------- */
function minimax(b, player, me, depth) {
  const w = winnerOf(b);
  if (w) return w.player === me ? 10 - depth : depth - 10;
  if (b.every(Boolean)) return 0;
  const scoresList = [];
  b.forEach((cell, i) => {
    if (cell) return;
    b[i] = player;
    scoresList.push(minimax(b, player === "X" ? "O" : "X", me, depth + 1));
    b[i] = null;
  });
  return player === me ? Math.max(...scoresList) : Math.min(...scoresList);
}

function bestMove(me) {
  const other = me === "X" ? "O" : "X";
  let best = -Infinity, moves = [];
  board.forEach((cell, i) => {
    if (cell) return;
    board[i] = me;
    const s = minimax(board, other, me, 1);
    board[i] = null;
    if (s > best) { best = s; moves = [i]; } else if (s === best) moves.push(i);
  });
  // pick randomly among equally good moves so games feel different
  return moves[Math.floor(Math.random() * moves.length)];
}

/* ---------- Rendering ---------- */
function buildBoard() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, empty`);
    cell.addEventListener("click", () => play(i));
    boardEl.appendChild(cell);
  }
}

function paint(i) {
  const cell = boardEl.children[i];
  cell.innerHTML = MARKS[board[i]];
  cell.disabled = true;
  cell.setAttribute("aria-label", `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, ${NAMES[board[i]]}`);
}

function drawStrike(line) {
  const center = (i) => [(i % 3) * 100 + 50, Math.floor(i / 3) * 100 + 50];
  const [x1, y1] = center(line[0]);
  const [x2, y2] = center(line[2]);
  const dx = (x2 - x1) * 0.18, dy = (y2 - y1) * 0.18; // overshoot a little
  strikeEl.innerHTML = `<line pathLength="1" x1="${x1 - dx}" y1="${y1 - dy}" x2="${x2 + dx}" y2="${y2 + dy}"/>`;
  [...boardEl.children].forEach((c, i) => { if (!line.includes(i)) c.classList.add("dim"); });
}

function setStatus() {
  statusEl.textContent = vsCpu && turn === "O" ? "Blue is thinking…" : `${NAMES[turn]}’s turn.`;
  boardEl.dataset.turn = turn;
}

/* ---------- Flow ---------- */
function play(i) {
  if (over || board[i]) return;
  if (vsCpu && turn === "O") return; // ignore clicks while the computer moves
  place(i);
}

function place(i) {
  board[i] = turn;
  paint(i);
  const win = winnerOf(board);
  if (win) return finish(win);
  if (board.every(Boolean)) return finish(null);
  turn = turn === "X" ? "O" : "X";
  setStatus();
  if (vsCpu && turn === "O") setTimeout(() => { if (!over) place(bestMove("O")); }, 550);
}

function finish(win) {
  over = true;
  [...boardEl.children].forEach((c) => (c.disabled = true));
  if (win) {
    scores[win.player]++;
    drawStrike(win.line);
    statusEl.textContent = `${NAMES[win.player]} wins this round.`;
  } else {
    scores.D++;
    statusEl.textContent = "A draw. Start a new round.";
  }
  scoreEls.X.textContent = scores.X;
  scoreEls.O.textContent = scores.O;
  scoreEls.D.textContent = scores.D;
}

function newRound() {
  board = Array(9).fill(null);
  over = false;
  strikeEl.innerHTML = "";
  buildBoard();
  starter = starter === "X" ? "O" : "X"; // alternate who opens
  turn = starter;
  setStatus();
  if (vsCpu && turn === "O") setTimeout(() => place(bestMove("O")), 550);
}

function setMode(cpu) {
  vsCpu = cpu;
  modeCpu.classList.toggle("is-on", cpu);
  modeTwo.classList.toggle("is-on", !cpu);
  modeCpu.setAttribute("aria-pressed", cpu);
  modeTwo.setAttribute("aria-pressed", !cpu);
  Object.keys(scores).forEach((k) => { scores[k] = 0; scoreEls[k].textContent = 0; });
  starter = "O"; // newRound flips it so Pink opens
  newRound();
}

modeCpu.addEventListener("click", () => setMode(true));
modeTwo.addEventListener("click", () => setMode(false));
document.getElementById("reset").addEventListener("click", newRound);

setMode(true);