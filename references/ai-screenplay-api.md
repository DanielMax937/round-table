# AI 自动化剧本创作 API 参考

每个工作流环节对应的 API 列表。

## Telegram 通知

需要用户参与的 API 完成后会自动发送 Telegram 消息（配置在项目 `.env`：`CTI_TG_BOT_TOKEN`、`CTI_TG_CHAT_ID`、`CTI_PROXY`）。

禁用：在 `.env` 中设置 `TELEGRAM_DISABLED=true`（或 `1`、`yes`）可关闭所有 Telegram 通知。

## 阶段一：故事与角色确立

| 环节 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 输入主题 | PUT | `/api/movies/[movieId]/theme` | 设置/更新主题 |
| 获取主题 | GET | `/api/movies/[movieId]/theme` | 获取当前主题 |
| 生成提案 | POST | `/api/movies/[movieId]/story-proposals` | 根据主题生成 3 个故事提案 |
| 获取提案 | GET | `/api/movies/[movieId]/story-proposals` | 获取已生成的提案列表 |
| 确认故事 | POST | `/api/movies/[movieId]/confirm-story` | 确认选中的提案（body: `{ proposalIndex: 0-2 }` 或 `{ proposal: {...} }`） |
| 获取故事 | GET | `/api/movies/[movieId]/story` | 获取已确认的故事 |
| 生成角色 | POST | `/api/movies/[movieId]/characters/generate` | 根据故事自动生成角色档案 |
| 获取角色 | GET | `/api/movies/[movieId]/characters` | 获取角色列表 |
| 更新角色 | PATCH | `/api/movies/[movieId]/characters/[characterId]` | 用户微调角色 |
| 确认角色 | POST | `/api/movies/[movieId]/confirm-characters` | 确认角色，进入大纲阶段 |

## 阶段二：剧本结构化

| 环节 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 生成大纲 | POST | `/api/movies/[movieId]/outline` | 根据故事和角色生成场景大纲 |
| 获取大纲 | GET | `/api/movies/[movieId]/outline` | 获取大纲列表 |
| 获取单条 | GET | `/api/movies/[movieId]/outlines/[outlineId]` | 获取单个大纲项 |
| 更新大纲 | PATCH | `/api/movies/[movieId]/outlines/[outlineId]` | 用户审阅微调（body: `title`, `contentSummary`, `emotionalGoal`, `characterIds`, `sortOrder`） |
| 删除大纲 | DELETE | `/api/movies/[movieId]/outlines/[outlineId]` | 删除大纲项 |
| 确认大纲 | POST | `/api/movies/[movieId]/confirm-outline` | 确认大纲，进入场景执行阶段 |

## 阶段三：多 Agent 场景生成与迭代

| 环节 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 场景预备 | GET | `/api/movies/[movieId]/scenes/context?outlineIndex=N` | 获取下一场景的 Context（目标、角色状态） |
| 执行生成 | POST | `/api/movies/[movieId]/scenes/execute` | 执行 Director 场景生成（JSON 返回，body: `{ outlineIndex: N }`） |
| 获取场景 | GET | `/api/movies/[movieId]/scenes/[sceneId]` | 获取场景详情（含剧本） |
| 更新场景 | PATCH | `/api/movies/[movieId]/scenes/[sceneId]` | 更新场景（body: `finalizedScript`, `status`） |
| 反馈重写 | POST | `/api/movies/[movieId]/scenes/[sceneId]/rewrite` | 根据用户反馈重写（body: `{ feedback: "..." }`） |
| 确认场景 | POST | `/api/movies/[movieId]/scenes/[sceneId]/confirm` | 仅标记为已确认 |
| 记忆结算 | POST | `/api/movies/[movieId]/scenes/[sceneId]/settle` | 执行记忆结算（剧情摘要 + 角色状态更新） |

## 阶段四：导出

| 环节 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 导出终稿 | GET | `/api/movies/[movieId]/export` | 导出完整剧本（text/plain） |

## 通用

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/movies/[movieId]/workflow` | 获取工作流状态（阶段、进度、是否可导出） |
| GET | `/api/movies/[movieId]` | 获取电影详情 |
| PATCH | `/api/movies/[movieId]` | 更新电影（含 theme, workflowPhase 等） |
