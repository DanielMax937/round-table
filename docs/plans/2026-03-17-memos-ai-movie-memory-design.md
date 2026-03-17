# MemOS 接入 AI Movie 角色记忆 — 设计文档

**日期**: 2026-03-17  
**状态**: 已批准设计  
**方案**: A — MemOS 为主记忆层，保留 currentStateJson 做结构化快照

## 1. 概述

为 AI Movie 模块中每个角色 Agent 接入 MemOS 记忆系统，实现：
- **写入**：每句台词生成后写入 MemOS
- **检索**：每次生成前从 MemOS 检索相关记忆并注入 prompt
- **保留**：`settleMemory` 继续更新 `Character.currentStateJson`，供导演和结算使用

**MemOS 仓库**: https://github.com/MemTensor/MemOS  
**部署方式**: Self-hosted（Docker/Python）  
**端口**: 9005

## 2. 架构

### 2.1 组件关系

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI Movie Scene Execution                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Director Summary → Round 1 (A→B→C) → Round 2 (A→B→C) → ... → Synthesize │
│       │                    │                    │                         │
│       │                    ▼                    ▼                         │
│       │            ┌──────────────┐     ┌──────────────┐                  │
│       │            │ Agent A turn │     │ Agent B turn │   ...            │
│       │            │ 1. search    │     │ 1. search    │                  │
│       │            │ 2. generate  │     │ 2. generate  │                  │
│       │            │ 3. add_msg  │     │ 3. add_msg   │                  │
│       │            └──────┬───────┘     └──────┬───────┘                  │
│       │                   │                    │                          │
│       ▼                   ▼                    ▼                          │
│  currentStateJson ◄── settleMemory (unchanged)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   MemOS (Self-hosted)         │
                    │   REST API :9005               │
                    │   user_id = characterId       │
                    │   mem_cube_id = movieId       │
                    └───────────────────────────────┘
```

### 2.2 职责划分

| 组件 | 职责 |
|------|------|
| **MemOS** | 对话级记忆：add_message 写入、search_memory 检索 |
| **currentStateJson** | 每场戏结束后的结构化状态（emotionalState, physicalState, knowledge），由 settleMemory 更新 |
| **Director** | 继续使用 currentStateJson + 角色设定，生成场景概要 |
| **Agent 生成** | 在现有 context 基础上，增加 MemOS 检索结果作为额外上下文 |

### 2.3 数据流

1. **写入**：每句台词生成后 → 调用 MemOS `add_message`（user_id=characterId, mem_cube_id=movieId）
2. **检索**：每次生成前 → 调用 MemOS `search_memory` → 将结果注入该角色的 system prompt
3. **结算**：场景确认后 → `settleMemory` 照旧 → 更新 `Character.currentStateJson`

## 3. MemOS 客户端与配置

### 3.1 新建模块

在 `lib/memos/` 下新增：

| 文件 | 职责 |
|------|------|
| `client.ts` | 封装 MemOS REST 调用（add_message、search_memory） |
| `types.ts` | 请求/响应类型定义 |

### 3.2 环境变量

```env
# MemOS Self-hosted
MEMOS_BASE_URL=http://localhost:9005
MEMOS_API_KEY=          # 若 MemOS 启用鉴权则填写

# 可选：关闭 MemOS 时跳过调用，保持原有行为
MEMOS_ENABLED=true
```

### 3.3 API 映射

依据 MemOS 仓库 README 自托管示例（https://github.com/MemTensor/MemOS）：

- **add_message**：`POST {base}/product/add`
- **search_memory**：`POST {base}/product/search`

请求体（与 MemOS README 示例一致）：

```ts
// add_message
{
  user_id: characterId,
  mem_cube_id: movieId,
  messages: [{ role: 'user'|'assistant', content: string }],
  async_mode?: 'sync'|'async'   // 默认 'sync'，确保写入完成后再继续
}

// search_memory
{
  query: string,
  user_id: characterId,
  mem_cube_id: movieId
}
```

实现前需对照 MemOS 最新文档确认请求/响应格式；若自托管版本 API 有变更，在 `lib/memos/client.ts` 中集中适配。

**search_memory 响应**：MemOS 返回结构以官方文档为准。实现时解析 API 响应中的记忆列表（如 `memory_detail_list`、`preference_detail_list` 等），将文本内容拼接为「检索到的记忆列表」注入 prompt。若文档与上述字段不符，在 `lib/memos/types.ts` 中定义响应类型并适配解析逻辑。

## 4. 调用点与集成

### 4.1 检索：executeAgentTurn 前注入记忆

**位置**：`lib/agents/executor.ts`，在调用 LLM 之前。

**流程**：
1. 当 `movieContext` 存在时启用 MemOS（由 `scene-executor` 传入，其他调用方不传则跳过）
2. 若是，调用 `search_memory(characterId, movieId, query)`
3. 将检索结果拼接到 system prompt，格式示例：

```
# 角色记忆（与本场相关）
<memories>
{检索到的记忆列表}
</memories>
```

**注入长度限制**：检索结果总字符数 ≤ 1500（约 400 token），超长则截断；避免上下文过长。

**query 构造**（可执行规格）：
- 字段顺序：`[场景heading] [contentSummary] [emotionalGoal] [最近N轮摘要]`
- 格式：用空格连接，每段最多 80 字，超长截断
- 「最近几轮」：N=1，即当前场景内已发生的上一轮完整对话（所有角色各一句），格式为 `角色A: 台词摘要; 角色B: 台词摘要`，总长 ≤ 200 字
- 最终 query 总长 ≤ 400 字

**search_memory 返回空**：不注入 `<memories>` 块，不修改 prompt 结构；仅当有检索结果时才追加记忆段落。

### 4.2 写入：每句台词生成后

**位置**：`lib/agents/orchestrator.ts` 的 `executeRound` 中，每轮每个 agent 生成完成后。

**流程**：
1. 若为 AI Movie 且 `MEMOS_ENABLED=true`
2. 构造 messages：
   - `user` content：场景上下文 + 本句前他人台词。**场景上下文**定义为：`[场景] ${heading}\n${contentSummary}\n目标: ${emotionalGoal}`（总长 ≤ 300 字）；**他人台词**为当前轮内已发言角色的 `角色名: 台词` 列表，总长 ≤ 500 字
   - `assistant` content：该角色本句台词原文
3. 调用 `add_message(characterId, movieId, messages)`
4. 失败时记录日志，不中断主流程

### 4.3 参数传递

当前 `executeRound` 和 `executeAgentTurn` 无 movieId、characterId，需：

- 在 `lib/movie/scene-executor.ts` 调用 `executeRound` 时传入 `movieContext`
- **映射方式**：采用显式映射。Scene 的 `sceneCharacters` 含 `characterId`，RoundTable 的 `agents` 与 Character 通过 `agent.name === character.name` 一一对应；在 `scene-executor` 中构建 `characterIdByAgentId: Record<agentId, characterId>`，从 `sceneCharacters` 与 `agents` 的 name 匹配得出
- **映射失败**：若某 agent 在 `sceneCharacters` 中无对应 character（name 不匹配），则跳过该 agent 的 MemOS add/search，记录日志，不中断流程
- 在 `RoundExecutionOptions` 中增加可选字段，`executeRound` 将其传给 `executeAgentTurn`；`ExecuteAgentTurnOptions` 同步扩展以接收 `movieContext`：

```ts
movieContext?: {
  movieId: string;
  characterIdByAgentId: Record<string, string>;
  sceneContext?: { heading: string; contentSummary: string; emotionalGoal: string };
}
```

## 5. 错误处理与降级

| 场景 | 处理方式 |
|------|----------|
| MemOS 服务不可用 | 记录日志，跳过 add/search，继续执行 |
| add_message 超时 | 记录日志，不重试，不阻塞生成 |
| search_memory 失败 | 不注入记忆，仅用现有 context 生成 |
| `MEMOS_ENABLED=false` | 不调用 MemOS，行为与改造前一致 |

## 6. 部署与依赖

### 6.1 MemOS 自托管

在项目根目录 `docker/docker-compose.memos.yml` 提供 MemOS 启动配置，映射端口 9005，便于本地开发。实现时参考 MemOS 仓库 `docker/` 目录的 compose 配置。

### 6.2 依赖

- 不新增 npm 包，使用 `fetch` 调用 MemOS REST API
- 类型定义放在 `lib/memos/types.ts`
