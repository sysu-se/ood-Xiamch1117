# EVOLUTION

## 1. 如何实现提示功能？

本次在 Homework 1.1 的 `Sudoku` / `Game` 结构上继续演进，没有把提示逻辑写回 UI 组件中。

### 1.1 候选提示

候选提示由 `Sudoku` 提供底层计算能力：

- `Sudoku.getCandidates(position)`
- `Sudoku.getAllCandidates()`

`getCandidates` 会根据当前棋盘的行、列、九宫格约束，计算某个空格还能填哪些数字。它只依赖当前局面本身，因此放在 `Sudoku` 中比较自然。

### 1.2 下一步提示

下一步提示由 `Game` 统一对外提供：

- `Game.getCandidateHint(position)`
- `Game.getNextHint()`
- `Game.applyHint(position)`

其中 `Game.getNextHint()` 会优先查找只有一个候选数的格子。如果没有唯一候选数，并且当前游戏保存了解题结果，则返回一个可填写的提示值。这样既保留了 `Sudoku` 对候选数的判断，也让 `Game` 能结合整局游戏的信息提供可操作的提示。

在 Svelte 层中，提示不再直接由组件修改二维数组，而是通过：

```js
userGrid.applyHint($cursor)
```

进入 `domainGame.js`，再调用领域对象中的 `Game.applyHint()`。

---

## 2. 提示功能更属于 `Sudoku` 还是 `Game`？为什么？

我认为提示功能分成两层更合理：

1. **候选数计算属于 `Sudoku`**
   - 因为候选数只依赖当前棋盘状态
   - `Sudoku` 本身最清楚当前行、列、九宫格中有哪些数字
   - 所以 `getCandidates()` 放在 `Sudoku` 中

2. **“给用户下一步怎么做”的提示属于 `Game`**
   - 因为它和用户交互、提示次数、是否直接填写、是否结合答案等会话信息有关
   - `Game` 比 `Sudoku` 更适合负责“当前游戏该给什么提示”

因此本次设计不是简单地说提示只属于某一个对象，而是：

> `Sudoku` 负责局面级推导，`Game` 负责会话级提示。

---

## 3. 如何实现探索模式？

本次探索模式采用“`Game` 进入一种临时探索状态”的方案。

新增的主要接口包括：

- `Game.startExplore()`
- `Game.commitExplore()`
- `Game.abandonExplore()`
- `Game.isExploring()`
- `Game.getExploreStatus()`
- `Game.markExploreFailed()`
- `Game.hasSeenFailedExplorePath()`

### 状态流

1. 用户点击 Start Explore
2. `Game` 保存当前局面的快照作为探索起点
3. 后续填写进入探索局面
4. 如果探索正确，可以 `commitExplore()`
5. 如果探索失败，可以 `abandonExplore()` 回到起点
6. 如果当前探索局面冲突，则记录为失败路径

在 UI 层中，`Actions.svelte` 增加了：

- Start Explore / Commit Explore
- Abandon Explore
- Conflict / Known failed path 状态提示

但这些按钮只是调用领域对象接口，真正的探索状态仍然保存在 `Game` 中。

---

## 4. 主局面与探索局面的关系是什么？

主局面和探索局面不是共享同一个可变对象，而是通过快照隔离。

进入探索时：

```js
exploreState = {
  base: currentSudoku.clone(),
  undo: [],
  redo: [],
}
```

也就是说：

- `base` 是探索起点的深拷贝
- 探索过程中的修改作用在当前 `Sudoku`
- 放弃探索时，用 `base.clone()` 恢复
- 提交探索时，把 `base` 作为主 history 的一个快照压入 undo 栈

这样可以避免主局面和探索局面共享二维数组引用，也可以避免放弃探索时污染主历史。

### 提交时如何合并？

提交探索时：

1. 把探索起点 `base` 压入主 `undo` 栈
2. 保留当前探索后的 `currentSudoku`
3. 清空主 `redo`
4. 退出探索状态

这样探索结果就进入主游戏流程。

### 放弃时如何回滚？

放弃探索时：

1. 如果当前探索局面有冲突，则记录该局面为失败路径
2. 用探索起点 `base.clone()` 恢复当前局面
3. 清空探索状态

---

## 5. history 结构在本次作业中是否发生变化？

发生了变化，但没有直接改成复杂的树状 DAG。

Homework 1.1 中的 history 是线性的：

- `undoStack`
- `redoStack`

Homework 2 中保留了主线性 history，同时在探索模式中增加了一个临时 history：

```js
exploreState = {
  base,
  undo,
  redo,
}
```

也就是说：

- 普通模式使用主 `undo/redo`
- 探索模式使用探索自己的 `undo/redo`
- 提交探索后，探索分支合并回主 history
- 放弃探索后，回滚到探索起点

本次没有实现完整树状分支，因为作业不要求 DAG 合并，也不要求多层嵌套探索。当前结构更像“主线 history + 临时分支”。

---

## 6. Homework 1 中哪些设计暴露出了局限？

### 6.1 `Game` 的职责开始变重

在 HW1 中，`Game` 管理当前棋盘和 Undo/Redo 已经足够。但到了 HW2，`Game` 又要处理：

- hint
- explore
- failed path
- explore history
- commit / abandon

这说明如果继续扩展，可能需要进一步拆出：

- `Move`
- `History`
- `ExploreSession`
- `HintService`

### 6.2 Snapshot history 简单但不够表达分支

HW1 中 snapshot history 很适合 Undo/Redo，但探索模式天然带有分支含义。当前实现通过 `exploreState` 暂时解决，但如果以后要支持多条探索分支、分支命名、分支回看，就需要树状 history。

### 6.3 UI 适配层仍然承担较多兼容责任

为了兼容原项目的 `grid` / `userGrid` / `invalidCells` 结构，`domainGame.js` 需要把领域对象转换成原 UI 能消费的数据。这说明 HW1 如果一开始就明确“领域层 + 适配层”的边界，后面接 UI 会更自然。

---

## 7. 如果重做一次 Homework 1，会如何修改原设计？

如果重新做 Homework 1，我会从一开始就预留下面几个对象或接口：

### 7.1 拆出 `History`

把 Undo/Redo 从 `Game` 中拆出来，形成专门的 history 管理对象。这样 HW2 的探索模式就可以拥有独立 `History`，不用在 `Game` 中手写两套 stack。

### 7.2 拆出 `Move` 和 `Position`

目前很多接口直接使用普通对象：

```js
{ row, col, value }
```

如果一开始就定义 `Move` 和 `Position` 的规范，后面做提示和探索时接口会更统一。

### 7.3 提前设计 `ExploreSession`

HW1 中只考虑线性 Undo/Redo，但 HW2 说明数独游戏还会出现“临时尝试”的需求。如果从 HW1 就预留 `ExploreSession`，这次就不用在 `Game` 内部额外扩展太多状态。

### 7.4 保持领域层与 Svelte 解耦

这次我仍然保持 `src/domain/index.js` 不依赖 Svelte。未来即使 UI 框架变化，`Sudoku` / `Game` / Hint / Explore 的核心逻辑仍然可以复用。这个方向是应该继续保留的。
