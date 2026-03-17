# MemOS AI Movie 记忆接入 — Writing Plan（实现计划）

**设计文档**: [2026-03-17-memos-ai-movie-memory-design.md](./2026-03-17-memos-ai-movie-memory-design.md)  
**状态**: 实现已完成，待端到端验证

---

## 1. 实现顺序与依赖

```
Phase 1: 基础设施（无依赖）
    └── Step 1.1: lib/memos/types.ts
    └── Step 1.2: lib/memos/client.ts

Phase 2: 类型扩展（依赖 Phase 1）
    └── Step 2.1: lib/types.ts 添加 MovieContext
    └── Step 2.2: RoundExecutionOptions / ExecuteAgentTurnOptions 扩展 movieContext

Phase 3: 集成（依赖 Phase 2）
    └── Step 3.1: executor.ts — search_memory 注入
    └── Step 3.2: orchestrator.ts — add_message 调用
    └── Step 3.3: scene-executor.ts — 构建并传入 movieContext

Phase 4: 配置与文档（可并行）
    └── Step 4.1: MemOS 部署（参见 MemOS 仓库）
    └── Step 4.2: .env.example 补充 MEMOS_*
    └── Step 4.3: README 更新
```

---

## 2. 分步实现说明

### Step 1.1 — lib/memos/types.ts

- 定义 `MemosAddMessageRequest`、`MemosSearchRequest`、`MemosSearchResponse`、`MemosMemoryItem`
- 使用 `readable_cube_ids`、`writable_cube_ids`（MemOS 新 API）

### Step 1.2 — lib/memos/client.ts

- `addMessage(characterId, movieId, messages)`：POST /product/add，失败静默
- `searchMemory(characterId, movieId, query)`：POST /product/search，失败返回 []
- `formatMemoriesForPrompt(items)`：截断至 1500 字
- `buildSearchQuery(sceneContext, prevRoundSummary)`：按 spec 构造 query
- `buildAddMessageUserContent(sceneContext, otherLines)`：按 spec 构造 user content
- 检查 `MEMOS_ENABLED`，未配置时跳过

### Step 2.1 — lib/types.ts

- 新增 `MovieContext` 接口

### Step 2.2 — orchestrator.ts / executor.ts

- `RoundExecutionOptions` 增加 `movieContext?: MovieContext`
- `ExecuteAgentTurnOptions` 增加 `movieContext?: MovieContext`
- `executeRound` 将 `movieContext` 传给 `executeAgentTurn`

### Step 3.1 — executor.ts

- 在 `buildAgentSystemPrompt` 之后、LLM 调用之前
- 若 `movieContext?.sceneContext` 存在，取 `characterId`，调用 `searchMemory`
- 用 `buildSearchQuery` 构造 query（上一轮摘要来自 `previousMessages.slice(-agentCount)`）
- 若有检索结果，追加到 systemPrompt：`# 角色记忆\n<memories>\n...\n</memories>`

### Step 3.2 — orchestrator.ts

- 每轮每个 agent 生成完成后
- 若 `movieContext` 存在且 `content` 非空
- 用 `buildAddMessageUserContent` 构造 user content，调用 `addMessage`
- 无 characterId 时记录 warn，不中断

### Step 3.3 — scene-executor.ts

- 构建 `characterIdByAgentId`：`agent.name === character.name` 映射
- 构建 `movieContext`：movieId、characterIdByAgentId、sceneContext
- 调用 `executeRound` 时传入 `movieContext`

### Step 4.1 — MemOS 部署

- MemOS 在独立仓库部署，参见 MemOS 仓库说明
- round-table 通过 `MEMOS_BASE_URL` 连接（默认 `http://localhost:9005`）

### Step 4.2 — .env.example

- `MEMOS_BASE_URL`、`MEMOS_API_KEY`、`MEMOS_ENABLED`

### Step 4.3 — README

- 增加「AI Movie & MemOS」小节，说明部署与配置

---

## 3. 验证步骤

| 阶段 | 验证方式 |
|------|----------|
| Phase 1 | 单元测试或手动调用 `addMessage`、`searchMemory`（需 MemOS 运行） |
| Phase 2 | TypeScript 编译通过 |
| Phase 3 | `npm run test:ai-movie` 通过 |
| Phase 4 | 文档可读 |
| 端到端 | MemOS 运行后执行 AI Movie 场景，检查 add/search 日志 |

---

## 4. 回滚策略

- `MEMOS_ENABLED=false`：不调用 MemOS，行为与改造前一致
- 移除 `movieContext` 传参：orchestrator/executor 自动跳过 MemOS 逻辑
- 删除 `lib/memos/`：需同步移除 executor、orchestrator、scene-executor 中的 MemOS 引用

---

## 5. 完成状态

- [x] Phase 1–4 已实现
- [x] `npm run test:ai-movie` 通过
- [x] MemOS API 已对照源码确认（readable_cube_ids / writable_cube_ids）
- [ ] 端到端验证：MemOS 运行后执行场景
