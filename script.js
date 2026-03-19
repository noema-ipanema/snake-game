import {
  GRID_SIZE,
  createInitialState,
  pauseGame,
  positionsEqual,
  queueDirection,
  restartGame,
  serializePosition,
  startGame,
  tickGame,
} from "./game.js";

const TICK_MS = 140;

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const highScoreElement = document.querySelector("#high-score");
const statusElement = document.querySelector("#status");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const leaderboardListElement = document.querySelector("#leaderboard-list");
const summaryScoreElement = document.querySelector("#summary-score");
const summaryHighScoreElement = document.querySelector("#summary-high-score");
const movesMadeElement = document.querySelector("#moves-made");
const survivalTimeElement = document.querySelector("#survival-time");
const averageIntervalElement = document.querySelector("#average-interval");
const performanceLabelElement = document.querySelector("#performance-label");
const bestRunSummaryElement = document.querySelector("#best-run-summary");
const controlButtons = document.querySelectorAll("[data-direction]");

const HIGH_SCORE_KEY = "snakeHighScore";
const LEADERBOARD_KEY = "snakeLeaderboard";
const BEST_RUN_KEY = "snakeBestRunStats";
const MAX_LEADERBOARD_ENTRIES = 5;

let state = createInitialState();
let highScore = loadHighScore();
let leaderboard = loadLeaderboard();
let hasRecordedCurrentGame = false;
let runMetrics = createRunMetrics();
let bestRunStats = loadBestRunStats();

const directionMap = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

function buildBoard() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < GRID_SIZE * GRID_SIZE; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.position = `${index % GRID_SIZE},${Math.floor(index / GRID_SIZE)}`;
    cell.setAttribute("role", "gridcell");
    fragment.appendChild(cell);
  }

  boardElement.replaceChildren(fragment);
}

function createRunMetrics() {
  return {
    runStartTime: null,
    pausedAt: null,
    totalPausedDurationMs: 0,
    survivalTimeMs: 0,
    movesMade: 0,
    directionChangeCount: 0,
    directionChangeTimestamps: [],
    averageDirectionIntervalMs: 0,
  };
}

function loadHighScore() {
  const rawValue = window.localStorage.getItem(HIGH_SCORE_KEY);
  const parsedValue = Number.parseInt(rawValue ?? "0", 10);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function loadLeaderboard() {
  try {
    const rawValue = window.localStorage.getItem(LEADERBOARD_KEY);
    const parsedValue = JSON.parse(rawValue ?? "[]");
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((left, right) => right - left)
      .slice(0, MAX_LEADERBOARD_ENTRIES);
  } catch {
    return [];
  }
}

function loadBestRunStats() {
  try {
    const rawValue = window.localStorage.getItem(BEST_RUN_KEY);
    const parsedValue = JSON.parse(rawValue ?? "null");

    if (!parsedValue || typeof parsedValue !== "object") {
      return null;
    }

    return {
      score: Number.parseInt(parsedValue.score, 10) || 0,
      movesMade: Number.parseInt(parsedValue.movesMade, 10) || 0,
      survivalTimeMs: Number.parseInt(parsedValue.survivalTimeMs, 10) || 0,
      averageDirectionIntervalMs: Number.parseInt(parsedValue.averageDirectionIntervalMs, 10) || 0,
      performanceLabel: parsedValue.performanceLabel || "Beginner",
    };
  } catch {
    return null;
  }
}

function saveScores() {
  window.localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
}

function saveBestRunStats() {
  if (!bestRunStats) {
    return;
  }

  window.localStorage.setItem(BEST_RUN_KEY, JSON.stringify(bestRunStats));
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatInterval(intervalMs) {
  return `${Math.round(intervalMs)} ms`;
}

function calculateAverageInterval(timestamps) {
  if (timestamps.length < 2) {
    return 0;
  }

  let totalInterval = 0;
  for (let index = 1; index < timestamps.length; index += 1) {
    totalInterval += timestamps[index] - timestamps[index - 1];
  }

  return totalInterval / (timestamps.length - 1);
}

function getPerformanceLabel(metrics, score) {
  const survivalSeconds = metrics.survivalTimeMs / 1000;
  const averageInterval = metrics.averageDirectionIntervalMs;

  if (score >= 10 && survivalSeconds >= 45 && averageInterval > 0 && averageInterval <= 350) {
    return "Elite";
  }

  if (score >= 7 && survivalSeconds >= 28 && averageInterval > 0 && averageInterval <= 550) {
    return "Sharp";
  }

  if (score >= 3 && survivalSeconds >= 12) {
    return "Focused";
  }

  return "Beginner";
}

function updateSurvivalTime() {
  if (
    runMetrics.runStartTime === null ||
    state.isPaused ||
    state.isGameOver ||
    !state.hasStarted
  ) {
    return;
  }

  runMetrics.survivalTimeMs =
    performance.now() - runMetrics.runStartTime - runMetrics.totalPausedDurationMs;
}

function renderBestRunSummary() {
  if (!bestRunStats) {
    bestRunSummaryElement.textContent = "No saved run";
    return;
  }

  bestRunSummaryElement.textContent =
    `${bestRunStats.performanceLabel} · ${bestRunStats.score} pts · ${formatDuration(bestRunStats.survivalTimeMs)}`;
}

function recordCompletedGame(score) {
  if (score < 0) {
    return;
  }

  leaderboard = [...leaderboard, score]
    .sort((left, right) => right - left)
    .slice(0, MAX_LEADERBOARD_ENTRIES);
  highScore = Math.max(highScore, score);
  saveScores();
}

function finalizeRunMetrics() {
  updateSurvivalTime();

  const summary = {
    score: state.score,
    movesMade: runMetrics.movesMade,
    survivalTimeMs: Math.round(runMetrics.survivalTimeMs),
    averageDirectionIntervalMs: Math.round(runMetrics.averageDirectionIntervalMs),
    performanceLabel: getPerformanceLabel(runMetrics, state.score),
  };

  if (!bestRunStats || summary.score > bestRunStats.score) {
    bestRunStats = summary;
    saveBestRunStats();
  }
}

function renderLeaderboard() {
  if (leaderboard.length === 0) {
    leaderboardListElement.innerHTML =
      '<li class="leaderboard__empty">No scores yet. Finish a game to set the board.</li>';
    return;
  }

  leaderboardListElement.innerHTML = leaderboard
    .map(
      (score, index) => `
        <li>
          <div class="leaderboard__entry">
            <span>Run ${index + 1}</span>
            <span>${score}</span>
          </div>
        </li>`,
    )
    .join("");
}

function render() {
  updateSurvivalTime();

  const snakePositions = new Set(state.snake.map((segment) => serializePosition(segment)));
  const head = state.snake[0];

  for (const cell of boardElement.children) {
    const position = cell.dataset.position;
    cell.classList.toggle("cell--snake", snakePositions.has(position));
    cell.classList.toggle("cell--head", position === serializePosition(head));
    cell.classList.toggle(
      "cell--food",
      state.food ? position === serializePosition(state.food) : false,
    );
  }

  scoreElement.textContent = String(state.score);
  highScoreElement.textContent = String(highScore);
  summaryScoreElement.textContent = String(state.score);
  summaryHighScoreElement.textContent = String(highScore);
  movesMadeElement.textContent = String(runMetrics.movesMade);
  survivalTimeElement.textContent = formatDuration(runMetrics.survivalTimeMs);
  averageIntervalElement.textContent = formatInterval(runMetrics.averageDirectionIntervalMs);
  performanceLabelElement.textContent = getPerformanceLabel(runMetrics, state.score);
  pauseButton.textContent = state.isPaused && state.hasStarted && !state.isGameOver ? "Resume" : "Pause";
  renderLeaderboard();
  renderBestRunSummary();

  if (state.isGameOver) {
    statusElement.textContent = "Game over. Press Restart or Start to play again.";
  } else if (!state.hasStarted) {
    statusElement.textContent = "Press Start to play.";
  } else if (state.isPaused) {
    statusElement.textContent = "Paused.";
  } else if (state.food && positionsEqual(state.snake[0], state.food)) {
    statusElement.textContent = "Nice catch.";
  } else {
    statusElement.textContent = "Steer with arrow keys, WASD, or the on-screen buttons.";
  }
}

function applyState(nextState) {
  const previousState = state;
  state = nextState;

  if (!state.hasStarted || !state.isGameOver) {
    hasRecordedCurrentGame = false;
  }

  // Measure only active play time by excluding paused spans from survival calculations.
  if (!previousState.isPaused && state.isPaused && state.hasStarted && !state.isGameOver) {
    runMetrics.pausedAt = performance.now();
  }

  if (previousState.isPaused && !state.isPaused && state.hasStarted && runMetrics.pausedAt !== null) {
    runMetrics.totalPausedDurationMs += performance.now() - runMetrics.pausedAt;
    runMetrics.pausedAt = null;
  }

  if (state.score > highScore) {
    highScore = state.score;
    saveScores();
  }

  if (state.isGameOver && !hasRecordedCurrentGame) {
    finalizeRunMetrics();
    recordCompletedGame(state.score);
    hasRecordedCurrentGame = true;
  }
  render();
}

function resetRunMetrics() {
  runMetrics = createRunMetrics();
}

function startRunMetrics() {
  if (runMetrics.runStartTime === null) {
    runMetrics.runStartTime = performance.now();
    runMetrics.pausedAt = null;
    runMetrics.totalPausedDurationMs = 0;
  }
}

function recordDirectionChange(direction) {
  const queuedState = queueDirection(state, direction);
  if (queuedState === state) {
    return;
  }

  const timestamp = performance.now();
  runMetrics.directionChangeCount += 1;
  runMetrics.directionChangeTimestamps.push(timestamp);
  runMetrics.averageDirectionIntervalMs = calculateAverageInterval(runMetrics.directionChangeTimestamps);
  applyState(queuedState);
}

function handleDirection(direction) {
  if (!state.hasStarted) {
    resetRunMetrics();
    applyState(startGame(state));
    startRunMetrics();
  }

  recordDirectionChange(direction);
  boardElement.focus();
}

function handleKeydown(event) {
  if (event.code === "Space") {
    event.preventDefault();
    applyState(pauseGame(state));
    return;
  }

  const direction = directionMap[event.key];
  if (!direction) {
    return;
  }

  event.preventDefault();
  handleDirection(direction);
}

function gameLoop() {
  updateSurvivalTime();
  const nextState = tickGame(state);
  if (nextState !== state) {
    runMetrics.movesMade += 1;
    applyState(nextState);
  } else if (state.hasStarted) {
    render();
  }
}

startButton.addEventListener("click", () => {
  if (!state.hasStarted || state.isGameOver) {
    resetRunMetrics();
  }
  applyState(startGame(state));
  startRunMetrics();
  boardElement.focus();
});

pauseButton.addEventListener("click", () => {
  applyState(pauseGame(state));
  boardElement.focus();
});

restartButton.addEventListener("click", () => {
  resetRunMetrics();
  applyState(restartGame());
  boardElement.focus();
});

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    handleDirection(button.dataset.direction);
  });
}

document.addEventListener("keydown", handleKeydown);

buildBoard();
render();
boardElement.focus();
window.setInterval(gameLoop, TICK_MS);
