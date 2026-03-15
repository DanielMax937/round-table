# 剧本创作 Agent 流程说明

## 概述

剧本创作采用**交互式分步流程**：用户发送主题 → 调用创建接口 → 用户审阅后同意 → 调用下一步接口；若需修改则调用更新接口。

## API 调用流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段一：故事与角色确立                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. 用户发送剧本主题                                                       │
│    → POST /api/movies  { title, description?, theme }                     │
│    → 返回 movieId                                                        │
│                                                                          │
│ 2. 用户审阅                                                               │
│    - 同意 → 执行下一步 (3)                                                 │
│    - 修改 → PUT /api/movies/[movieId]/theme  { theme }                   │
│                                                                          │
│ 3. 生成故事提案                                                           │
│    → POST /api/movies/[movieId]/story-proposals                           │
│    → 返回 3 个提案                                                         │
│                                                                          │
│ 4. 用户选择提案                                                           │
│    → POST /api/movies/[movieId]/confirm-story  { proposalIndex: 0|1|2 }    │
│    或 自定义提案: { proposal: { oneLiner, coreConflict, styleReference, synopsis } } │
│                                                                          │
│ 5. 生成角色                                                               │
│    → POST /api/movies/[movieId]/characters/generate                       │
│                                                                          │
│ 6. 用户确认角色                                                           │
│    → POST /api/movies/[movieId]/confirm-characters                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段二：剧本结构化                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ 7. 生成大纲                                                               │
│    → POST /api/movies/[movieId]/outline                                   │
│                                                                          │
│ 8. 用户审阅/微调大纲                                                       │
│    - 更新: PATCH /api/movies/[movieId]/outlines/[outlineId]               │
│    - 删除: DELETE /api/movies/[movieId]/outlines/[outlineId]              │
│                                                                          │
│ 9. 确认大纲                                                               │
│    → POST /api/movies/[movieId]/confirm-outline                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段三：场景生成与迭代                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 10. 按顺序执行场景生成                                                     │
│     → POST /api/movies/[movieId]/scenes/execute  { outlineIndex: N }      │
│     → JSON 返回 { sceneId, fullScript }                                    │
│                                                                          │
│ 11. 用户审阅场景（可选）                                                    │
│     - 反馈重写: POST .../scenes/[sceneId]/rewrite  { feedback }           │
│     - 确认: POST .../scenes/[sceneId]/confirm                             │
│     - 记忆结算: POST .../scenes/[sceneId]/settle                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段四：导出                                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ 12. 导出终稿                                                              │
│     → GET /api/movies/[movieId]/export                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## 查询接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/movies/[movieId]/workflow` | 工作流状态（阶段、进度、是否可导出） |
| GET | `/api/movies/[movieId]/theme` | 当前主题 |
| GET | `/api/movies/[movieId]/story-proposals` | 已生成的故事提案 |
| GET | `/api/movies/[movieId]/story` | 已确认的故事 |
| GET | `/api/movies/[movieId]/characters` | 角色列表 |
| GET | `/api/movies/[movieId]/outline` | 大纲列表 |
| GET | `/api/movies/[movieId]/scenes/[sceneId]` | 场景详情 |

## 工作流脚本

使用 `scripts/script-workflow.ts` 按步骤调用：

```bash
# 创建主题
npm run workflow -- create-theme "<主题>" [标题]
npm run workflow -- create-theme --file <路径> [标题]

# 修改主题
npm run workflow -- update-theme "<新主题>"

# 同意，执行下一步
npm run workflow -- approve

# 确认故事（选 AI 生成的提案）
npm run workflow -- confirm-story 0|1|2

# 确认故事（自定义提案）
npm run workflow -- confirm-story-custom <提案JSON文件>

# 查看状态
npm run workflow -- status
```

## Telegram 通知

以下 API 完成后会发送 Telegram 消息：
- POST /api/movies（主题已创建）
- POST /api/movies/[id]/story-proposals
- POST /api/movies/[id]/confirm-story
- POST /api/movies/[id]/characters/generate
- POST /api/movies/[id]/confirm-characters
- POST /api/movies/[id]/outline
- POST /api/movies/[id]/confirm-outline
- POST /api/movies/[id]/scenes/execute
- POST /api/movies/[id]/scenes/[sceneId]/rewrite
- POST /api/movies/[id]/scenes/[sceneId]/settle

**配置**（项目 `.env`）：
- `CTI_TG_BOT_TOKEN` / `TELEGRAM_BOT_TOKEN`
- `CTI_TG_CHAT_ID` / `TELEGRAM_CHAT_ID`
- `CTI_PROXY` / `TELEGRAM_PROXY`（需代理时必填，如 `http://127.0.0.1:1087`）

**禁用**：`TELEGRAM_DISABLED=true`

**调试**：控制台会输出 `[Telegram] Sending... (proxy: xxx)` 或 `[Telegram] CTI_TG_BOT_TOKEN not configured` 等日志。

## 前置条件

- 服务已启动：`npm run dev`（默认端口 8400）
- `.env` 配置 `OPENAI_API_KEY`（角色、大纲、场景生成需调用 LLM）
