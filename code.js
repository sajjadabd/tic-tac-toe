(() => {
  'use strict';

  const WIN_COMBOS = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  // Game State
  let board = Array(9).fill(null);
  let currentPlayer = 'X';
  let gameActive = true;
  let mode = 'pvp'; // 'pvp' | 'ai'
  let difficulty = 'impossible'; // 'casual' | 'impossible'
  let isAiThinking = false;
  let aiTimeoutId = null;
  let soundEnabled = true;
  let winningCombo = null;
  const scores = { X: 0, O: 0, ties: 0 };

  // DOM Elements
  const boardEl = document.getElementById('board');
  const boardWrapper = document.getElementById('board-wrapper');
  const cells = Array.from(document.querySelectorAll('.cell'));
  const winLine = document.getElementById('win-line');
  const statusBanner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const scoreXEl = document.getElementById('score-x');
  const scoreOEl = document.getElementById('score-o');
  const scoreTiesEl = document.getElementById('score-ties');
  const cardX = document.getElementById('card-x');
  const cardO = document.getElementById('card-o');
  const labelO = document.getElementById('label-o');
  const difficultyWrap = document.getElementById('difficulty-wrap');
  const modeBtns = document.querySelectorAll('[data-mode]');
  const diffBtns = document.querySelectorAll('[data-diff]');
  const newRoundBtn = document.getElementById('new-round-btn');
  const resetScoresBtn = document.getElementById('reset-scores-btn');
  const soundToggleBtn = document.getElementById('sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const confettiCanvas = document.getElementById('confetti-canvas');
  const ctx = confettiCanvas.getContext('2d');

  // --- Synthesized Web Audio Effects ---
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', volume = 0.08, delay = 0) {
    if (!soundEnabled) return;
    const ac = getAudioCtx();
    if (!ac) return;

    const now = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playPlaceSound(player) {
    if (player === 'X') {
      playTone(520, 0.11, 'triangle', 0.09);
      playTone(760, 0.09, 'sine', 0.06, 0.03);
    } else {
      playTone(390, 0.12, 'triangle', 0.09);
      playTone(290, 0.1, 'sine', 0.06, 0.03);
    }
  }

  function playWinSound() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      playTone(freq, 0.22, 'triangle', 0.09, i * 0.08);
    });
  }

  function playTieSound() {
    playTone(330, 0.16, 'sine', 0.07, 0);
    playTone(293.66, 0.24, 'sine', 0.07, 0.12);
  }

  // --- SVG Mark Creation ---
  function createMarkSVG(player) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.classList.add('mark-svg', player === 'X' ? 'mark-x' : 'mark-o');

    if (player === 'X') {
      const l1 = document.createElementNS(svgNS, 'line');
      l1.setAttribute('x1', '24');
      l1.setAttribute('y1', '24');
      l1.setAttribute('x2', '76');
      l1.setAttribute('y2', '76');

      const l2 = document.createElementNS(svgNS, 'line');
      l2.setAttribute('x1', '76');
      l2.setAttribute('y1', '24');
      l2.setAttribute('x2', '24');
      l2.setAttribute('y2', '76');

      svg.append(l1, l2);
    } else {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '50');
      circle.setAttribute('cy', '50');
      circle.setAttribute('r', '32');
      svg.appendChild(circle);
    }

    return svg;
  }

  // --- Win Line Drawing ---
  function drawWinLine(combo, winner) {
    const [a, , c] = combo;
    const wrapRect = boardWrapper.getBoundingClientRect();
    const rectA = cells[a].getBoundingClientRect();
    const rectC = cells[c].getBoundingClientRect();

    let x1 = rectA.left - wrapRect.left + rectA.width / 2;
    let y1 = rectA.top - wrapRect.top + rectA.height / 2;
    let x2 = rectC.left - wrapRect.left + rectC.width / 2;
    let y2 = rectC.top - wrapRect.top + rectC.height / 2;

    // Extend slightly beyond cell centers for a sharper look
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const pad = 18;
    x1 -= (dx / len) * pad;
    y1 -= (dy / len) * pad;
    x2 += (dx / len) * pad;
    y2 += (dy / len) * pad;

    const totalLen = Math.hypot(x2 - x1, y2 - y1);

    winLine.setAttribute('x1', x1);
    winLine.setAttribute('y1', y1);
    winLine.setAttribute('x2', x2);
    winLine.setAttribute('y2', y2);
    winLine.style.strokeDasharray = totalLen;
    winLine.style.strokeDashoffset = totalLen;
    winLine.className.baseVal = winner === 'X' ? 'show-x' : 'show-o';

    // Force reflow so transition plays cleanly
    winLine.getBoundingClientRect();
    winLine.style.strokeDashoffset = '0';
  }

  function clearWinLine() {
    winLine.className.baseVal = '';
    winLine.style.strokeDasharray = '0';
    winLine.style.strokeDashoffset = '0';
  }

  // --- Particle Confetti ---
  let particles = [];
  let animFrameId = null;

  function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }

  function launchParticles(winner) {
    resizeCanvas();
    const color = winner === 'X' ? '#00f0ff' : '#ff2e88';
    const altColor = '#ffffff';
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight / 2;

    particles = Array.from({ length: 55 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 4,
        alpha: 1,
        color: Math.random() > 0.25 ? color : altColor,
      };
    });

    if (animFrameId) cancelAnimationFrame(animFrameId);
    animateParticles();
  }

  function animateParticles() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.alpha -= 0.018;

      if (p.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    particles = particles.filter((p) => p.alpha > 0);
    if (particles.length > 0) {
      animFrameId = requestAnimationFrame(animateParticles);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  // --- Core Game Logic ---
  function checkWinner(state) {
    for (const combo of WIN_COMBOS) {
      const [a, b, c] = combo;
      if (state[a] && state[a] === state[b] && state[a] === state[c]) {
        return { winner: state[a], combo };
      }
    }
    if (state.every((cell) => cell !== null)) {
      return { winner: 'tie', combo: null };
    }
    return null;
  }

  function updateUIState() {
    boardEl.dataset.turn = gameActive ? currentPlayer : '';
    boardEl.classList.toggle('locked', !gameActive || isAiThinking);

    cardX.classList.toggle('active-turn', gameActive && currentPlayer === 'X');
    cardO.classList.toggle('active-turn', gameActive && currentPlayer === 'O');

    statusBanner.classList.remove('turn-o', 'tie');
    if (gameActive) {
      if (currentPlayer === 'O') statusBanner.classList.add('turn-o');
      if (mode === 'ai' && currentPlayer === 'O') {
        statusText.textContent = 'AI is thinking...';
      } else {
        statusText.textContent = `Player ${currentPlayer}'s Turn`;
      }
    }
  }

  function makeMove(index, player) {
    board[index] = player;
    const cell = cells[index];
    cell.classList.add('taken');
    cell.appendChild(createMarkSVG(player));
    playPlaceSound(player);

    const result = checkWinner(board);
    if (result) {
      handleGameEnd(result);
      return;
    }

    currentPlayer = player === 'X' ? 'O' : 'X';
    updateUIState();

    if (mode === 'ai' && currentPlayer === 'O' && gameActive) {
      triggerAiMove();
    }
  }

  function handleGameEnd({ winner, combo }) {
    gameActive = false;
    winningCombo = combo;
    boardEl.classList.add('locked');
    cardX.classList.remove('active-turn');
    cardO.classList.remove('active-turn');

    if (winner === 'tie') {
      scores.ties += 1;
      scoreTiesEl.textContent = scores.ties;
      statusBanner.classList.add('tie');
      statusText.textContent = "It's a Draw!";
      playTieSound();
    } else {
      scores[winner] += 1;
      if (winner === 'X') {
        scoreXEl.textContent = scores.X;
      } else {
        scoreOEl.textContent = scores.O;
      }
      if (winner === 'O') statusBanner.classList.add('turn-o');
      const winLabel = mode === 'ai' && winner === 'O' ? 'AI Wins!' : `Player ${winner} Wins!`;
      statusText.textContent = winLabel;

      combo.forEach((idx) => cells[idx].classList.add('win-cell'));
      drawWinLine(combo, winner);
      launchParticles(winner);
      playWinSound();
    }
  }

  // --- AI Engine (Casual & Unbeatable Minimax) ---
  function triggerAiMove() {
    isAiThinking = true;
    updateUIState();

    aiTimeoutId = setTimeout(() => {
      if (!gameActive) return;
      const moveIndex = difficulty === 'impossible' ? getBestMove() : getCasualMove();
      isAiThinking = false;
      makeMove(moveIndex, 'O');
    }, 360);
  }

  function getAvailableIndices(state) {
    return state.reduce((acc, val, idx) => (val === null ? [...acc, idx] : acc), []);
  }

  function getCasualMove() {
    const empty = getAvailableIndices(board);
    if (Math.random() < 0.5) {
      return getBestMove();
    }
    return empty[Math.floor(Math.random() * empty.length)];
  }

  function getBestMove() {
    const empty = getAvailableIndices(board);
    // Slight variety on completely empty/first AI move if center/corner is optimal
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const idx of empty) {
      board[idx] = 'O';
      const score = minimax(board, 0, false);
      board[idx] = null;

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [idx];
      } else if (score === bestScore) {
        bestMoves.push(idx);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  function minimax(state, depth, isMaximizing) {
    const result = checkWinner(state);
    if (result) {
      if (result.winner === 'O') return 10 - depth;
      if (result.winner === 'X') return depth - 10;
      return 0;
    }

    const empty = getAvailableIndices(state);
    if (isMaximizing) {
      let best = -Infinity;
      for (const idx of empty) {
        state[idx] = 'O';
        best = Math.max(best, minimax(state, depth + 1, false));
        state[idx] = null;
      }
      return best;
    } else {
      let best = Infinity;
      for (const idx of empty) {
        state[idx] = 'X';
        best = Math.min(best, minimax(state, depth + 1, true));
        state[idx] = null;
      }
      return best;
    }
  }

  // --- Controls & Reset ---
  function startNewRound() {
    clearTimeout(aiTimeoutId);
    isAiThinking = false;
    board = Array(9).fill(null);
    currentPlayer = 'X';
    gameActive = true;
    winningCombo = null;

    cells.forEach((cell) => {
      cell.innerHTML = '';
      cell.classList.remove('taken', 'win-cell');
    });

    clearWinLine();
    updateUIState();
  }

  function resetScores() {
    scores.X = 0;
    scores.O = 0;
    scores.ties = 0;
    scoreXEl.textContent = '0';
    scoreOEl.textContent = '0';
    scoreTiesEl.textContent = '0';
    startNewRound();
  }

  // --- Event Listeners ---
  cells.forEach((cell) => {
    cell.addEventListener('click', () => {
      const idx = Number(cell.dataset.index);
      if (!gameActive || isAiThinking || board[idx] !== null) return;
      makeMove(idx, currentPlayer);
    });
  });

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selected = btn.dataset.mode;
      if (selected === mode) return;
      mode = selected;

      modeBtns.forEach((b) => b.classList.toggle('active', b === btn));
      difficultyWrap.classList.toggle('hidden', mode !== 'ai');
      labelO.textContent = mode === 'ai' ? 'AI (O)' : 'PLAYER O';
      resetScores();
    });
  });

  diffBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      difficulty = btn.dataset.diff;
      diffBtns.forEach((b) => b.classList.toggle('active', b === btn));
      startNewRound();
    });
  });

  newRoundBtn.addEventListener('click', startNewRound);
  resetScoresBtn.addEventListener('click', resetScores);

  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  });

  // Keyboard Support (1-9 to play, R for New Round)
  document.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '9') {
      const idx = Number(e.key) - 1;
      if (gameActive && !isAiThinking && board[idx] === null) {
        makeMove(idx, currentPlayer);
      }
    } else if (e.key.toLowerCase() === 'r') {
      startNewRound();
    }
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (winningCombo && !gameActive) {
      drawWinLine(winningCombo, board[winningCombo[0]]);
    }
  });

  // Initialize
  resizeCanvas();
  updateUIState();
})();