# API 调用日志

仅记录调用与是否成功。

| 时间 | 方法 | 路径 | 成功 |
|------|------|------|------|
| 2026-03-15 | POST | /api/movies | ✅ |
| 2026-03-15 | POST | /api/movies/[id]/confirm-story | ✅ |
| 2026-03-15 | POST | /api/movies/[id]/characters/generate | ✅ |
| 2026-03-15 | POST | /api/movies/[id]/confirm-characters | ✅ |
| 2026-03-15 | POST | /api/movies/[id]/outline | ✅ |
| 2026-03-15 | POST | /api/movies/[id]/confirm-outline | ✅ |
| 2026-03-15 | POST | /api/movies/cmmr23rus00008h7fw83kjygr/confirm-story | ✅ |
| 2026-03-15 | POST | /api/movies/cmmr23rus00008h7fw83kjygr/characters/generate | ✅ |
| 2026-03-15 | POST | /api/movies/cmmr23rus00008h7fw83kjygr/confirm-characters | ✅ |
| 2026-03-15 | GET | /api/movies/cmmr23rus00008h7fw83kjygr/workflow | ✅ |
| 2026-03-15 | GET | /api/movies/cmmr23rus00008h7fw83kjygr/outline | ✅ |
| 2026-03-15 | POST | /api/movies/cmmr23rus00008h7fw83kjygr/outline | ❌ 超时 |
| 2026-03-15 | POST | /api/movies (create-theme) | ❌ 超时 |
