const SIZE = 9
const BOX_SIZE = 3
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function cloneGrid(grid) {
  return grid.map((row) => row.slice())
}

function createEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function isValidGrid(grid) {
  return (
    Array.isArray(grid) &&
    grid.length === SIZE &&
    grid.every(
      (row) =>
        Array.isArray(row) &&
        row.length === SIZE &&
        row.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 9),
    )
  )
}

function normalizePosition(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('position must be an object')
  }

  const row = input.row ?? input.y
  const col = input.col ?? input.x

  if (!Number.isInteger(row) || row < 0 || row >= SIZE) {
    throw new RangeError('position.row must be an integer from 0 to 8')
  }
  if (!Number.isInteger(col) || col < 0 || col >= SIZE) {
    throw new RangeError('position.col must be an integer from 0 to 8')
  }

  return { row, col }
}

function normalizeMove(move) {
  if (!move || typeof move !== 'object') {
    throw new TypeError('move must be an object')
  }

  const { row, col } = normalizePosition(move)
  const value = move.value

  if (!Number.isInteger(value) || value < 0 || value > 9) {
    throw new RangeError('move.value must be an integer from 0 to 9')
  }

  return { row, col, value }
}

function collectInvalidCells(grid) {
  const invalid = new Set()

  const markGroup = (cells) => {
    const seen = new Map()

    for (const [row, col] of cells) {
      const value = grid[row][col]
      if (value === 0) continue
      const positions = seen.get(value) || []
      positions.push([row, col])
      seen.set(value, positions)
    }

    for (const positions of seen.values()) {
      if (positions.length > 1) {
        for (const [row, col] of positions) {
          invalid.add(`${row},${col}`)
        }
      }
    }
  }

  for (let row = 0; row < SIZE; row += 1) {
    markGroup(Array.from({ length: SIZE }, (_, col) => [row, col]))
  }

  for (let col = 0; col < SIZE; col += 1) {
    markGroup(Array.from({ length: SIZE }, (_, row) => [row, col]))
  }

  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX_SIZE) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += BOX_SIZE) {
      const cells = []
      for (let row = boxRow; row < boxRow + BOX_SIZE; row += 1) {
        for (let col = boxCol; col < boxCol + BOX_SIZE; col += 1) {
          cells.push([row, col])
        }
      }
      markGroup(cells)
    }
  }

  return [...invalid].map((key) => {
    const [row, col] = key.split(',').map(Number)
    return { row, col }
  })
}

function boardKey(grid) {
  return grid.map((row) => row.join('')).join('')
}

function formatGrid(grid) {
  const lines = []
  for (let row = 0; row < SIZE; row += 1) {
    const rendered = []
    for (let col = 0; col < SIZE; col += 1) {
      rendered.push(grid[row][col] === 0 ? '.' : String(grid[row][col]))
      if (col === 2 || col === 5) rendered.push('|')
    }
    lines.push(rendered.join(' '))
    if (row === 2 || row === 5) lines.push('------+-------+------')
  }
  return lines.join('\n')
}

function candidatesForGrid(grid, row, col) {
  if (grid[row][col] !== 0) return []

  const used = new Set()

  for (let i = 0; i < SIZE; i += 1) {
    used.add(grid[row][i])
    used.add(grid[i][col])
  }

  const startRow = Math.floor(row / BOX_SIZE) * BOX_SIZE
  const startCol = Math.floor(col / BOX_SIZE) * BOX_SIZE
  for (let r = startRow; r < startRow + BOX_SIZE; r += 1) {
    for (let c = startCol; c < startCol + BOX_SIZE; c += 1) {
      used.add(grid[r][c])
    }
  }

  return VALUES.filter((value) => !used.has(value))
}

function buildCandidateEntries(grid) {
  const entries = []

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (grid[row][col] === 0) {
        entries.push({
          row,
          col,
          candidates: candidatesForGrid(grid, row, col),
        })
      }
    }
  }

  return entries
}

function cloneSudokuValue(sudokuLike) {
  if (sudokuLike && typeof sudokuLike.clone === 'function') {
    return sudokuLike.clone()
  }
  if (sudokuLike && typeof sudokuLike.getGrid === 'function') {
    return createSudoku(sudokuLike.getGrid())
  }
  return createSudoku(createEmptyGrid())
}

function cloneSudokuStack(stack) {
  return stack.map(cloneSudokuValue)
}

function normalizeSudokuSnapshot(snapshot) {
  if (!snapshot) return null
  if (typeof snapshot.clone === 'function') return snapshot.clone()
  if (typeof snapshot.getGrid === 'function') return createSudoku(snapshot.getGrid())
  if (isValidGrid(snapshot.grid)) return createSudoku(snapshot.grid)
  return null
}

export function createSudoku(input) {
  if (!isValidGrid(input)) {
    throw new TypeError('createSudoku expects a 9x9 numeric grid')
  }

  let grid = cloneGrid(input)

  return {
    getGrid() {
      return cloneGrid(grid)
    },

    guess(move) {
      const { row, col, value } = normalizeMove(move)
      grid[row][col] = value
      return this
    },

    getCandidates(position) {
      const { row, col } = normalizePosition(position)
      return candidatesForGrid(grid, row, col)
    },

    getAllCandidates() {
      const result = {}
      for (const entry of buildCandidateEntries(grid)) {
        result[`${entry.row},${entry.col}`] = entry.candidates.slice()
      }
      return result
    },

    getNextHint() {
      const entries = buildCandidateEntries(grid)
      if (entries.length === 0) {
        return {
          type: 'complete',
          row: null,
          col: null,
          value: null,
          candidates: [],
          reason: 'The board has no empty cell.',
        }
      }

      const single = entries.find((entry) => entry.candidates.length === 1)
      if (single) {
        return {
          type: 'naked-single',
          row: single.row,
          col: single.col,
          value: single.candidates[0],
          candidates: single.candidates.slice(),
          reason: 'This cell has only one legal candidate under row, column, and box constraints.',
        }
      }

      const fallback = entries
        .filter((entry) => entry.candidates.length > 0)
        .sort((a, b) => a.candidates.length - b.candidates.length)[0]

      if (!fallback) {
        return {
          type: 'conflict',
          row: null,
          col: null,
          value: null,
          candidates: [],
          reason: 'At least one empty cell has no legal candidate, so the current board is inconsistent.',
        }
      }

      return {
        type: 'candidate',
        row: fallback.row,
        col: fallback.col,
        value: null,
        candidates: fallback.candidates.slice(),
        reason: 'No forced move was found. This empty cell has the fewest legal candidates.',
      }
    },

    validate() {
      return collectInvalidCells(grid)
    },

    hasConflict() {
      if (collectInvalidCells(grid).length > 0) return true
      return buildCandidateEntries(grid).some((entry) => entry.candidates.length === 0)
    },

    isComplete() {
      return grid.every((row) => row.every((cell) => cell !== 0))
    },

    clone() {
      return createSudoku(grid)
    },

    toJSON() {
      return {
        type: 'Sudoku',
        grid: cloneGrid(grid),
      }
    },

    toString() {
      return formatGrid(grid)
    },
  }
}

export function createSudokuFromJSON(json) {
  if (!json || typeof json !== 'object' || !isValidGrid(json.grid)) {
    throw new TypeError('createSudokuFromJSON expects an object with a 9x9 grid')
  }

  return createSudoku(json.grid)
}

function createGameState({
  sudoku,
  initialGrid,
  solutionGrid,
  undoStack = [],
  redoStack = [],
  explore = null,
  failedExploreKeys = [],
} = {}) {
  if (!sudoku || typeof sudoku.getGrid !== 'function' || typeof sudoku.guess !== 'function') {
    throw new TypeError('createGame expects a sudoku-like object')
  }

  const immutableInitialGrid = cloneGrid(initialGrid || sudoku.getGrid())
  const immutableSolutionGrid = isValidGrid(solutionGrid) ? cloneGrid(solutionGrid) : null

  let currentSudoku = cloneSudokuValue(sudoku)
  let undo = cloneSudokuStack(undoStack)
  let redo = cloneSudokuStack(redoStack)

  let exploreState = null
  if (explore && explore.active) {
    exploreState = {
      base: normalizeSudokuSnapshot(explore.base) || currentSudoku.clone(),
      undo: Array.isArray(explore.undo) ? cloneSudokuStack(explore.undo) : [],
      redo: Array.isArray(explore.redo) ? cloneSudokuStack(explore.redo) : [],
    }
  }

  const failedPaths = new Set(failedExploreKeys)

  function isFixedCell(row, col) {
    return immutableInitialGrid[row][col] !== 0
  }

  function activeUndoStack() {
    return exploreState ? exploreState.undo : undo
  }

  function activeRedoStack() {
    return exploreState ? exploreState.redo : redo
  }

  function setActiveRedoStack(nextRedo) {
    if (exploreState) {
      exploreState.redo = nextRedo
    } else {
      redo = nextRedo
    }
  }

  function markFailedIfNeeded() {
    if (!exploreState) return
    if (currentSudoku.hasConflict()) {
      failedPaths.add(boardKey(currentSudoku.getGrid()))
    }
  }

  function getExploreStatus() {
    const key = boardKey(currentSudoku.getGrid())
    return {
      active: Boolean(exploreState),
      conflict: currentSudoku.hasConflict(),
      repeatedFailure: failedPaths.has(key),
      failedPathCount: failedPaths.size,
    }
  }

  function buildHint(position = null) {
    if (position) {
      const { row, col } = normalizePosition(position)
      const candidates = currentSudoku.getCandidates({ row, col })
      const value = immutableSolutionGrid && currentSudoku.getGrid()[row][col] === 0
        ? immutableSolutionGrid[row][col]
        : (candidates.length === 1 ? candidates[0] : null)

      return {
        type: value ? 'next-value' : 'candidate',
        row,
        col,
        value,
        candidates,
        reason: value
          ? 'The hint value is derived from the solved board when available, otherwise from a single legal candidate.'
          : 'This is the current candidate set of the selected cell.',
      }
    }

    const localHint = currentSudoku.getNextHint()
    if (localHint.value || !immutableSolutionGrid) return localHint

    const currentGrid = currentSudoku.getGrid()
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (currentGrid[row][col] === 0) {
          return {
            type: 'solution-hint',
            row,
            col,
            value: immutableSolutionGrid[row][col],
            candidates: currentSudoku.getCandidates({ row, col }),
            reason: 'No forced move was found, so the game uses the solved board to provide the next playable hint.',
          }
        }
      }
    }

    return localHint
  }

  const game = {
    getSudoku() {
      return currentSudoku
    },

    getInitialGrid() {
      return cloneGrid(immutableInitialGrid)
    },

    getSolutionGrid() {
      return immutableSolutionGrid ? cloneGrid(immutableSolutionGrid) : null
    },

    isFixedCell(row, col) {
      return isFixedCell(row, col)
    },

    validate() {
      return currentSudoku.validate()
    },

    hasConflict() {
      return currentSudoku.hasConflict()
    },

    isWon() {
      return currentSudoku.isComplete() && currentSudoku.validate().length === 0
    },

    getCandidateHint(position) {
      return buildHint(position)
    },

    getNextHint() {
      return buildHint()
    },

    applyHint(position = null) {
      const hint = buildHint(position)
      if (!hint || !Number.isInteger(hint.row) || !Number.isInteger(hint.col) || !hint.value) {
        return false
      }
      return this.guess({ row: hint.row, col: hint.col, value: hint.value })
    },

    guess(move) {
      const normalizedMove = normalizeMove(move)
      if (isFixedCell(normalizedMove.row, normalizedMove.col)) {
        return false
      }

      const stack = activeUndoStack()
      stack.push(currentSudoku.clone())
      setActiveRedoStack([])
      currentSudoku.guess(normalizedMove)
      markFailedIfNeeded()
      return true
    },

    undo() {
      const stack = activeUndoStack()
      if (stack.length === 0) return false

      const redoStack = activeRedoStack()
      redoStack.push(currentSudoku.clone())
      currentSudoku = stack.pop()
      return true
    },

    redo() {
      const redoStack = activeRedoStack()
      if (redoStack.length === 0) return false

      const stack = activeUndoStack()
      stack.push(currentSudoku.clone())
      currentSudoku = redoStack.pop()
      markFailedIfNeeded()
      return true
    },

    canUndo() {
      return activeUndoStack().length > 0
    },

    canRedo() {
      return activeRedoStack().length > 0
    },

    startExplore() {
      if (exploreState) return false

      exploreState = {
        base: currentSudoku.clone(),
        undo: [],
        redo: [],
      }
      return true
    },

    isExploring() {
      return Boolean(exploreState)
    },

    getExploreStatus,

    commitExplore() {
      if (!exploreState) return false

      undo.push(exploreState.base.clone())
      redo = []
      exploreState = null
      markFailedIfNeeded()
      return true
    },

    abandonExplore() {
      if (!exploreState) return false

      if (currentSudoku.hasConflict()) {
        failedPaths.add(boardKey(currentSudoku.getGrid()))
      }
      currentSudoku = exploreState.base.clone()
      exploreState = null
      return true
    },

    markExploreFailed() {
      failedPaths.add(boardKey(currentSudoku.getGrid()))
      return true
    },

    hasSeenFailedExplorePath() {
      return failedPaths.has(boardKey(currentSudoku.getGrid()))
    },

    getFailedExplorePathCount() {
      return failedPaths.size
    },

    toJSON() {
      return {
        type: 'Game',
        initialGrid: cloneGrid(immutableInitialGrid),
        solutionGrid: immutableSolutionGrid ? cloneGrid(immutableSolutionGrid) : null,
        sudoku: currentSudoku.toJSON(),
        history: {
          undo: undo.map((snapshot) => snapshot.toJSON()),
          redo: redo.map((snapshot) => snapshot.toJSON()),
        },
        explore: exploreState
          ? {
              active: true,
              base: exploreState.base.toJSON(),
              undo: exploreState.undo.map((snapshot) => snapshot.toJSON()),
              redo: exploreState.redo.map((snapshot) => snapshot.toJSON()),
            }
          : { active: false },
        failedExploreKeys: [...failedPaths],
      }
    },

    toString() {
      const exploreStatus = getExploreStatus()
      return [
        'Game {',
        `  canUndo: ${this.canUndo()},`,
        `  canRedo: ${this.canRedo()},`,
        `  exploring: ${exploreStatus.active},`,
        `  conflict: ${exploreStatus.conflict},`,
        `  repeatedFailure: ${exploreStatus.repeatedFailure},`,
        '  sudoku:',
        currentSudoku
          .toString()
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n'),
        '}',
      ].join('\n')
    },
  }

  return game
}

export function createGame({ sudoku, solutionGrid } = {}) {
  return createGameState({ sudoku, solutionGrid })
}

export function createGameFromJSON(json) {
  if (!json || typeof json !== 'object' || !json.sudoku) {
    throw new TypeError('createGameFromJSON expects a serialized game object')
  }

  const undoStack = Array.isArray(json.history?.undo)
    ? json.history.undo.map(createSudokuFromJSON)
    : []
  const redoStack = Array.isArray(json.history?.redo)
    ? json.history.redo.map(createSudokuFromJSON)
    : []

  return createGameState({
    sudoku: createSudokuFromJSON(json.sudoku),
    initialGrid: isValidGrid(json.initialGrid) ? json.initialGrid : json.sudoku.grid,
    solutionGrid: isValidGrid(json.solutionGrid) ? json.solutionGrid : null,
    undoStack,
    redoStack,
    explore: json.explore && json.explore.active
      ? {
          active: true,
          base: json.explore.base,
          undo: Array.isArray(json.explore.undo)
            ? json.explore.undo.map(createSudokuFromJSON)
            : [],
          redo: Array.isArray(json.explore.redo)
            ? json.explore.redo.map(createSudokuFromJSON)
            : [],
        }
      : null,
    failedExploreKeys: Array.isArray(json.failedExploreKeys) ? json.failedExploreKeys : [],
  })
}
