# higgsfield-ai-prompt-skill 仓库总结

> 阅读日期：2026-08-11
> 仓库地址：https://github.com/OSideMedia/higgsfield-ai-prompt-skill

## 一、仓库定位

`higgsfield-ai-prompt-skill` 是一个面向 Claude、Claude Code 和 Claude Cowork 的 Higgsfield 专用提示词知识库与 Skill 调度器。

它负责把用户的自然语言创意转换为适合 Higgsfield 平台及其托管模型的专业提示词，并根据任务自动路由到模型选择、摄影机、运动、风格、角色一致性、Seedance、Cinema Studio、表演、声音、VFX、营销或故障诊断等子 Skill。

与模型无关的项目管理系统不同，这个仓库高度关注 Higgsfield 当前的平台词汇、模型规格、参数、工作区和生成方式。

## 二、主要能力

### 1. 使用 MCSLA 结构编写视频提示词

其核心提示词结构为：

- Model：选择生成模型和生成模式。
- Camera：景别、角度、镜头运动和摄影机行为。
- Subject：人物、物体、地点及其引用关系。
- Look：光线、色彩、材质、镜头语言和整体风格。
- Action：动作、表演、物理变化、节奏和结束状态。

仓库要求提示词使用经过验证的 Higgsfield 模型名称、摄影机控制、运动预设和参数，避免根据常识虚构平台词汇。

### 2. 模型选择与参数指导

仓库覆盖多种视频和图片模型，例如：

- Kling 系列。
- Seedance 2.0、2.5 及相关生成模式。
- Veo、Sora、Wan、Minimax Hailuo、FLUX Video。
- Higgsfield DoP、Soul、Nano Banana、Seedream、GPT Image 等。

它可以根据人物一致性、动作规模、多引用、视频续写、视频编辑、声音、时长、分辨率和预算等条件推荐模型，并要求在高成本生成前核对模型 schema 和费用。

### 3. Higgsfield 平台专项能力

仓库的子 Skill 覆盖：

- 摄影机控制和命名运动预设。
- Soul ID 人物一致性与角色表。
- Cinema Studio 2.5、3.0、3.5。
- Canvas 节点式生产工作区。
- Seedance 多引用、续写、视频编辑和扩展。
- 表演指导、行为节拍、眼神和潜台词。
- FACS 面部动作单元与微表情。
- 对白、音效、环境声和独立音频生成。
- AI-VFX、人物/生物/服装/地点资产准备。
- Marketing Studio、广告模板和内容工厂。
- 多镜头拆分、导演镜头表和完整制作管线。
- 失败诊断、积分优化和生成记录。

### 4. 模板与提示词路由

仓库包含动作、产品广告、恐怖、时尚、科幻、肖像、风景、喜剧、爱情、舞蹈等类型模板，还包含多人物空间关系、单人物位置锁定、Seedance 多引用、表情节拍和文字叠加等技术模板。

根目录的 `SKILL.md` 是总调度器。它首先判断用户的任务类型，再要求读取最少的相关子 Skill，而不是一次把整个知识库加载进上下文。

### 5. 生成记忆与质量控制

仓库提供脚本和本地数据库，用于记录：

- 每次生成使用的模型和标签。
- 结果是保留、拒绝还是触发过滤。
- 拒绝原因和失败模式。
- 各类镜头的成功率与每个成片所需尝试次数。
- 积分消耗和预计预算。

它还包含 Seedance 提示词检查器、模型规格同步和规格变化检测工具，目的是减少参数过期和重复踩坑。

## 三、与《Hell Grind》的关系

《Hell Grind》只是这个大型 Higgsfield 技能库中的一个专项生产模块，文件位于：

`skills/higgsfield-seedance/HELL-GRIND.md`

该模块总结的内容包括：

- 无头角色表和后续点编辑方法。
- 地点表、空间锚点和统一光线逻辑。
- 每个场景复用的空间布局块。
- 镜头第一秒的位置固定策略。
- 对白构造与角色表演。
- 禁用词和常见 AI 痕迹控制。
- 10—15 次迭代纪律。
- 群众、巨型角色和空间阈值转换的处理方法。

因此，这个仓库并不是专门为《Hell Grind》建立的；它把《Hell Grind》当作长片生产案例，并与其他 Higgsfield 模型、工具和工作区知识一起使用。

## 四、提示词与生成执行的边界

该仓库主要负责“构造提示词”，不会自行调用 Higgsfield API 或命令行生成内容。

实际执行可以采用：

- 将提示词手动粘贴到 `higgsfield.ai`。
- 使用 Higgsfield CLI。
- 使用 Higgsfield MCP 连接器。
- 使用 Higgsfield 官方 bundled skills。

推荐的端到端过程是：

1. 由本仓库选择模型并构造提示词。
2. 调用前查询模型 schema，核对时长、比例和引用角色。
3. 必要时先估算积分成本。
4. 通过 CLI、MCP 或网页执行生成。
5. 将结果记录到生成台账，再按失败模式迭代。

## 五、适合什么场景

这个仓库更适合：

- 需要直接编写 Higgsfield 图片或视频提示词。
- 不确定应该选择 Kling、Seedance、Veo、Sora 还是其他模型。
- 需要 Higgsfield 的相机、运动、风格和 Soul ID 专项指导。
- 使用 Cinema Studio、Canvas、Marketing Studio 等工作区。
- 制作 Seedance 多引用、视频续写、视频编辑或 AI-VFX 镜头。
- 希望把提示词生成与 Higgsfield CLI/MCP 连接起来。
- 需要诊断失败结果并控制积分消耗。

如果目标是管理一整部影片的全部资产、镜头、选片、连续性和交付记录，它本身不如完整生产数据库型工作流系统化。

## 六、与 Hell-Grind-AIGC-Skill 的关系

两者可以组合：

- `Hell-Grind-AIGC-Skill` 负责项目结构、资产、镜头契约、生成记录、连续性和交付。
- `higgsfield-ai-prompt-skill` 负责把某个镜头转换成符合 Higgsfield 当前模型和参数的具体提示词。

前者可以作为项目的生产总账，后者可以作为 Higgsfield 平台适配器和提示词导演。

## 七、一句话总结

`higgsfield-ai-prompt-skill` 是一套面向 Higgsfield 的大型提示词专家库，重点是选择正确的模型和平台能力，并产出可直接交给 Higgsfield 网页、CLI 或 MCP 使用的专业提示词。
