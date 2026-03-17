# MemOS AI Movie 记忆接入 — 实现计划

**设计文档**: [2026-03-17-memos-ai-movie-memory-design.md](./2026-03-17-memos-ai-movie-memory-design.md)  
**状态**: 已完成

## 实现步骤（已完成）

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | MemOS 客户端模块 | `lib/memos/types.ts`, `lib/memos/client.ts` |
| 2 | 扩展 RoundExecutionOptions / ExecuteAgentTurnOptions | `lib/types.ts`, `lib/agents/orchestrator.ts`, `lib/agents/executor.ts` |
| 3 | 检索集成（executeAgentTurn 前） | `lib/agents/executor.ts` |
| 4 | 写入集成（每句台词后） | `lib/agents/orchestrator.ts` |
| 5 | scene-executor 传入 movieContext | `lib/movie/scene-executor.ts` |
| 6 | Docker 与 env 配置 | `docker/docker-compose.memos.yml`, `.env.example` |

## 验证清单

- [x] `npm run test:ai-movie` 通过
- [ ] MemOS 服务运行后，执行场景验证 add/search 调用
- [ ] 对照 MemOS 最新 API 文档确认 `/product/add`、`/product/search` 请求/响应格式

## 后续可选

- 若 MemOS 自托管 API 与 Cloud 格式不同，在 `lib/memos/client.ts` 中适配
- 若 `mem_cube_id` 需预创建，补充初始化逻辑
