# Higgsfield `HELL GRIND` API 与数据导出

数据源：<https://higgsfield.ai/@higgsfield.studio/projects/hell-grind>

导出时间：2026-08-10（Asia/Shanghai）

## Network 中确认的接口

API 基址：`https://fnf-api-gw.higgsfield.ai/fnf`

| 用途 | 方法与路径 |
| --- | --- |
| 公开项目及快照根目录 | `GET /project-publications/{username}/{slug}` |
| 文件夹信息 | `GET /folders/{folder_id}` |
| 子文件夹分页 | `GET /folders/{folder_id}/children?limit=100&cursor=...` |
| 文件夹内生成任务分页 | `GET /folders/{folder_id}/items/v2?limit=50&cursor=...` |
| 页面预览信息 | `GET /folders/{folder_id}/info?size=10` |

实际抓取链路：

1. 请求 publication，读取 `snapshot_folder_id`。
2. 从快照根目录开始广度遍历 `/children`，获得完整文件夹树。
3. 对每个文件夹持续请求 `/items/v2`，直到响应中的 `cursor` 为 `null`。
4. 从每个 `item.job` 提取 `params.prompt`、`params.medias`、`params.reference_elements` 和 `results`。

服务端当前会忽略较大的 `limit`，每页最多返回 20 条，因此不能根据请求的 `limit` 判断是否到达末页，必须始终跟随响应 `cursor`。

这些公开接口在本次检查中不要求登录令牌。抓取器仍带上 `Origin: https://higgsfield.ai` 和 `Referer: https://higgsfield.ai/`。

## 导出结果

数据目录：`data/higgsfield/higgsfield.studio__hell-grind/`

| 文件 | 内容 |
| --- | --- |
| `scene-shots.jsonl` | 最方便使用的镜头表；每行一个生成任务，直接包含场景、完整提示词、参考媒体和输出 URL |
| `jobs.jsonl` | 115,446 条唯一任务的较完整规范化 API 记录 |
| `scene-index.json` | 114 个名称含 `Scene` 的场景文件夹及其镜头/参考媒体汇总 |
| `references.json` | 1,084 个去重参考媒体，含 URL、名称、类型、使用次数及关联文件夹 |
| `folders.json` | 162 个文件夹的完整树结构 |
| `publication.json` | 项目 publication 原始响应 |
| `stats.json` | 导出和校验统计 |
| `progress.json` | 可恢复抓取进度 |

`scene-shots.jsonl` 每条记录的主要字段：

```json
{
  "id": "generation/job id",
  "scene_id": "最近的 Scene 祖先文件夹 id；非场景素材可为 null",
  "scene_name": "Scene 17",
  "folder_id": "任务实际所在文件夹 id",
  "prompt": "完整提示词",
  "reference_media": [
    {
      "id": "media id",
      "url": "https://...",
      "type": "media_input",
      "name": "角色或素材名称"
    }
  ],
  "output_url": "生成结果 URL"
}
```

最终统计：

- 162/162 个文件夹均已翻页到空 cursor。
- 115,446 条唯一任务，与 publication 的 `stats.generations_count` 完全一致。
- 115,309 条任务带非空提示词；未带提示词的 137 条记录仍原样保留。
- 101,522 条任务使用了参考媒体，共 350,978 次引用。
- 1,084 个唯一参考媒体 URL：1,024 张图片、56 个视频、4 个音频输入。
- 83,041 条任务能映射到名称含 `Scene` 的场景文件夹；其余 32,405 条位于 Assets、Credits、Series、Regenerations 等非场景目录，仍完整保留。

根文件夹的 `count` 报告 115,451，比 publication 与实际唯一任务多 5。另有 `Scene 52` 的文件夹计数报告 2,102，但 `/items/v2` 翻页结束后返回 2,101 条。这说明文件夹 `count` 是独立的汇总/缓存计数，不能作为唯一任务数或抓取完成条件；本导出以 publication 计数、空 cursor、文件夹完成数和唯一 ID 校验共同验收。

## 使用示例

查看 Scene 17 的全部镜头：

```bash
jq -c 'select(.scene_name == "Scene 17")' \
  data/higgsfield/higgsfield.studio__hell-grind/scene-shots.jsonl
```

只取镜头 ID、提示词和参考图 URL：

```bash
jq -c '{id, scene_name, prompt, references: [.reference_media[].url]}' \
  data/higgsfield/higgsfield.studio__hell-grind/scene-shots.jsonl
```

重新抓取或刷新已完成文件夹中的新增任务：

```bash
npm run higgsfield:download -- \
  higgsfield.studio hell-grind --refresh --concurrency 32
```

下载参考媒体二进制文件：

```bash
npm run higgsfield:download -- \
  higgsfield.studio hell-grind --concurrency 8 --download-references
```

参考媒体 URL 已全部写入 `references.json`。二进制下载会跳过已完成文件，并通过 `.part` 文件继续未完成下载；CloudFront 在本次环境中速度较慢，因此当前只完成了 3 个二进制文件，JSON 清单本身不受影响。
