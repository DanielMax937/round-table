# Prompt: 创建 chrome-devtools-server Skill

将以下内容作为 prompt 发送给 Cursor，用于创建一个基于 **chrome-dev-mcp-server** 服务的 Agent Skill。

---

## Prompt 正文

请帮我创建一个 Cursor Agent Skill，该 skill 使用 **chrome-dev-mcp-server**（local-service 中的 Chrome DevTools Server，端口 9223）来操作浏览器。

### 核心要求

1. **后端服务**：chrome-dev-mcp-server
   - 启动命令：`local-service start chrome-dev-mcp-server`（或直接 `cd /path/to/chrome-dev-mcp-server && ./start-bg.sh`）
   - Base URL：`http://127.0.0.1:9223`
   - API 形式：REST，`POST /api/<endpoint>` + JSON body
   - **不使用** Playwright、不使用 9222 端口的 Chrome

2. **技能能力**：通过 HTTP/curl 调用 REST API 实现
   - 导航：打开 URL、新标签页、前进/后退、刷新
   - 快照：`take_snapshot` 获取 a11y 树与元素 UID，`take_screenshot` 截图
   - 交互：`click`、`fill`、`press_key`、`hover`、`drag` 等
   - 等待：`wait_for` 等待指定文本出现

3. **必须包含完整接口文档**：在 SKILL.md 中嵌入或引用以下 API 参考，确保 agent 知道每个接口的用途和参数。

---

## 接口文档（必须包含在 Skill 中）

**Base URL**: `http://127.0.0.1:9223`（可通过 `CDS_BASE_URL` 覆盖）

**响应格式**: `{"is_error": bool, "content": [{"type": "text", "text": "..."}]}`

**通用**:
- `GET /api/tools` — 列出所有可用工具
- `POST /api/tools/{tool_name}` — 按名称调用任意工具

### 导航

| 端点 | 用途 |
|------|------|
| `POST /api/list_pages` | 列出已打开页面 |
| `POST /api/new_page` | 新标签页打开 URL。参数：`url`(必填), `background`, `timeout` |
| `POST /api/navigate_page` | 当前页导航。参数：`type`("url"\|"back"\|"forward"\|"reload"), `url`, `ignoreCache`, `timeout` |
| `POST /api/select_page` | 切换当前页。参数：`pageId`(必填), `bringToFront` |
| `POST /api/close_page` | 关闭页面。参数：`pageId`(必填) |

### 快照与截图

| 端点 | 用途 |
|------|------|
| `POST /api/take_snapshot` | 获取 a11y 树与元素 UID。参数：`verbose`, `filePath` |
| `POST /api/take_screenshot` | 截图。参数：`format`(png/jpeg/webp), `quality`, `uid`, `fullPage`, `filePath` |

### 输入

| 端点 | 用途 |
|------|------|
| `POST /api/click` | 点击元素。参数：`uid`(必填), `dblClick`, `includeSnapshot` |
| `POST /api/fill` | 填写 input/textarea/select。参数：`uid`(必填), `value`(必填), `includeSnapshot` |
| `POST /api/fill_form` | 批量填写表单。参数：`elements`([{uid, value}]), `includeSnapshot` |
| `POST /api/type_text` | 键盘输入文本。参数：`text`(必填), `submitKey` |
| `POST /api/press_key` | 按键。参数：`key`(必填, 如 "Enter", "Control+A"), `includeSnapshot` |
| `POST /api/hover` | 悬停元素。参数：`uid`(必填), `includeSnapshot` |
| `POST /api/drag` | 拖拽。参数：`from_uid`(必填), `to_uid`(必填), `includeSnapshot` |
| `POST /api/handle_dialog` | 处理 alert/confirm/prompt。参数：`action`(accept/dismiss), `promptText` |
| `POST /api/upload_file` | 文件上传。参数：`uid`(必填), `filePath`(必填) |

### 脚本与工具

| 端点 | 用途 |
|------|------|
| `POST /api/evaluate_script` | 在页面执行 JS。参数：`function`(必填), `args` |
| `POST /api/wait_for` | 等待指定文本出现。参数：`text`(必填, 数组), `timeout` |

### 控制台与网络

| 端点 | 用途 |
|------|------|
| `POST /api/list_console_messages` | 列出控制台消息 |
| `POST /api/get_console_message` | 获取单条消息。参数：`msgid` |
| `POST /api/list_network_requests` | 列出网络请求 |
| `POST /api/get_network_request` | 获取单条请求。参数：`reqid`, `responseFilePath` |

### 模拟与审计

| 端点 | 用途 |
|------|------|
| `POST /api/emulate` | 设备/网络/地理模拟。参数：`networkConditions`, `cpuThrottlingRate`, `geolocation`, `userAgent`, `colorScheme`, `viewport` |
| `POST /api/resize_page` | 调整视口。参数：`width`(必填), `height`(必填) |
| `POST /api/lighthouse_audit` | Lighthouse 审计。参数：`mode`, `device`, `outputDirPath` |
| `POST /api/performance_start_trace` | 开始性能追踪 |
| `POST /api/performance_stop_trace` | 停止性能追踪 |
| `POST /api/take_memory_snapshot` | 内存堆快照。参数：`filePath`(必填) |

---

## 标准工作流

1. **确认服务运行**：`curl -sf http://127.0.0.1:9223/api/tools` 返回 200
2. **导航**：`POST /api/new_page` 或 `POST /api/navigate_page`
3. **（可选）等待**：`POST /api/wait_for` 等待内容加载
4. **快照**：`POST /api/take_snapshot` 获取元素 UID
5. **交互**：使用 UID 调用 `click`、`fill`、`press_key` 等
6. **截图**：`POST /api/take_screenshot`，可用 `filePath` 保存到本地

**重要**：元素 UID（如 `1_16`）来自 `take_snapshot`，页面更新后 UID 会变，交互前需重新快照。

---

## curl 示例（供 agent 参考）

```bash
# 打开百度
curl -s -X POST http://127.0.0.1:9223/api/new_page \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.baidu.com"}'

# 打开 Google 并延长超时
curl -s -X POST http://127.0.0.1:9223/api/new_page \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com.hk", "timeout": 30000}'

# 获取快照（找搜索框等元素 UID）
curl -s -X POST http://127.0.0.1:9223/api/take_snapshot \
  -H "Content-Type: application/json" -d '{}'

# 填写搜索框（uid 来自快照）
curl -s -X POST http://127.0.0.1:9223/api/fill \
  -H "Content-Type: application/json" \
  -d '{"uid": "1_16", "value": "白银"}'

# 按 Enter 提交
curl -s -X POST http://127.0.0.1:9223/api/press_key \
  -H "Content-Type: application/json" \
  -d '{"key": "Enter"}'

# 等待搜索结果
curl -s -X POST http://127.0.0.1:9223/api/wait_for \
  -H "Content-Type: application/json" \
  -d '{"text": ["白银", "Silver"], "timeout": 5000}'

# 截图并保存
curl -s -X POST http://127.0.0.1:9223/api/take_screenshot \
  -H "Content-Type: application/json" \
  -d '{"format": "png", "filePath": "/path/to/screenshot.png"}'
```

---

## 触发场景

当用户说以下内容时使用此 skill：
- 打开网页、访问 URL、浏览网站
- 搜索、填写表单、点击按钮
- 截图、获取页面内容
- 浏览器自动化、网页测试、爬取

---

## 参考文件路径

- 接口详细参数：`chrome-dev-mcp-server/skills/chrome-devtools-api/references/api-reference.md`
- Swagger 文档：`http://127.0.0.1:9223/docs`（服务启动后）
- local-service 配置：`~/.local-service/services.json`（chrome-dev-mcp-server 的 startCommand 为 `./start-bg.sh`）
