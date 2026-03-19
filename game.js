export const GRID_SIZE = 16;
export const INITIAL_DIRECTION = "right";
export const INITIAL_SNAKE = [
  { x: 2, y: 8 },
  { x: 1, y: 8 },
  { x: 0, y: 8 },
];

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITES = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function createInitialState(random = Math.random) {
  const snake = INITIAL_SNAKE.map((segment) => ({ ...segment }));

  return {
    gridSize: GRID_SIZE,
    snake,
    direction: INITIAL_DIRECTION,
    nextDirection: INITIAL_DIRECTION,
    food: pickFoodPosition(snake, GRID_SIZE, random),
    score: 0,
    isGameOver: false,
    isPaused: true,
    hasStarted: false,
  };
}

export function queueDirection(state, requestedDirection) {
  if (!DIRECTION_VECTORS[requestedDirection]) {
    return state;
  }

  if (requestedDirection === state.direction || requestedDirection === state.nextDirection) {
    return state;
  }

  if (OPPOSITES[state.direction] === requestedDirection) {
    return state;
  }

  return {
    ...state,
    nextDirection: requestedDirection,
  };
}

export function startGame(state) {
  if (state.isGameOver) {
    return {
      ...createInitialState(),
      isPaused: false,
      hasStarted: true,
    };
  }

  return {
    ...state,
    isPaused: false,
    hasStarted: true,
  };
}

export function pauseGame(state) {
  if (!state.hasStarted || state.isGameOver) {
    return state;
  }

  return {
    ...state,
    isPaused: !state.isPaused,
  };
}

export function restartGame(random = Math.random) {
  return createInitialState(random);
}

export function tickGame(state, random = Math.random) {
  if (state.isPaused || state.isGameOver || !state.hasStarted) {
    return state;
  }

  const direction = state.nextDirection;
  const movement = DIRECTION_VECTORS[direction];
  const head = state.snake[0];
  const nextHead = {
    x: head.x + movement.x,
    y: head.y + movement.y,
  };

  const willGrow = positionsEqual(nextHead, state.food);
  const bodyToCheck = willGrow ? state.snake : state.snake.slice(0, -1);
  const hitsWall =
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= state.gridSize ||
    nextHead.y >= state.gridSize;
  const hitsSelf = bodyToCheck.some((segment) => positionsEqual(segment, nextHead));

  if (hitsWall || hitsSelf) {
    return {
      ...state,
      direction,
      nextDirection: direction,
      isGameOver: true,
      isPaused: true,
    };
  }

  const snake = [nextHead, ...state.snake];
  if (!willGrow) {
    snake.pop();
  }

  return {
    ...state,
    snake,
    direction,
    nextDirection: direction,
    food: willGrow ? pickFoodPosition(snake, state.gridSize, random) : state.food,
    score: willGrow ? state.score + 1 : state.score,
  };
}

export function pickFoodPosition(snake, gridSize, random = Math.random) {
  const occupied = new Set(snake.map((segment) => serializePosition(segment)));
  const available = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const key = serializePosition({ x, y });
      if (!occupied.has(key)) {
        available.push({ x, y });
      }
    }
  }

  if (available.length === 0) {
    return null;
  }

  const index = Math.floor(random() * available.length);
  return available[index];
}

export function positionsEqual(a, b) {
  return Boolean(a) && Boolean(b) && a.x === b.x && a.y === b.y;
}

export function serializePosition(position) {
  return `${position.x},${position.y}`;
}
