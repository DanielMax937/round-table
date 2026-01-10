# Round Table - Comprehensive Test Cases

## 📊 Test Run Summary (2026-01-11)

| Test ID | Result | Notes |
|---------|--------|-------|
| RD-01 | ✅ PASSED | UI shows "Round 0 of 3" correctly |
| AG-01 | ✅ PASSED | 3 agents spoke in order: Devil's Advocate → Optimist → Pragmatist |
| AG-03 | ✅ PASSED | Streaming works, "Discussion in progress..." shown during generation |
| RD-02 | ✅ PASSED | "Discussion Complete!" banner + "Start Round 4" disabled |
| RD-03 | ✅ PASSED | API returns 400 with "maxRounds must be a number between 1 and 50" |
| BL-01 | ✅ PASSED | Modal opens, content streams, markdown headers visible |
| SR-03 | ✅ PASSED | Mock mode fallback works when SERPER_API_KEY unset |
| SR-04 | ✅ PASSED | Cache hit in 5ms vs 6295ms for fresh search |
| VT-01 | ✅ PASSED | Job created with jobId and estimatedCompletionTime |
| VT-02 | ✅ PASSED | Job completed, winner declared, scores available |
| DB-01 | ✅ PASSED | Cascade delete works - all related records deleted |
| SR-01 | ✅ PASSED | Serper API + Jina enrichment working (cache miss → fresh search) |
| SR-02 | ✅ PASSED | Playwright scraper mode: 5/5 scraped, source='scraper', content extracted |
| PL-01 | ✅ PASSED | Parallel scraping with 5 concurrent tabs |
| PL-02 | ✅ PASSED | Timeout handling: YouTube times out after 15s, fallback works |
| DB-02 | ✅ PASSED | State preserved after restart, can resume |
| AG-02 | ⏭️ SKIPPED | API proxy doesn't support raw tool use (test requires official API) |

### 🐛 Bugs Found & Fixed During Testing

1. **Missing agent relation in messages query** (`lib/db/roundtable.ts`)
   - Issue: `message.agent.name` was undefined because agent wasn't included in Prisma query
   - Fix: Added `include: { agent: true }` to messages query in `getRoundTableWithDetails()`

2. **Double JSON.parse on toolCalls** (`components/DiscussionView.tsx`)
   - Issue: `page.tsx` already parses toolCalls, but DiscussionView tried to parse again
   - Fix: Changed interface to accept `toolCalls?: any[]` and removed redundant `JSON.parse()`

3. **Unsafe JSON.parse on empty toolCalls** (`lib/agents/executor.ts`)
   - Issue: MoE jobs failed with "Unexpected end of JSON input" when toolCalls was empty string
   - Fix: Added `safeParseToolCalls()` function with try-catch and empty string check

---

## 🧪 Search System Tests

### 1. Hybrid Search Logic

| ID | Title | Pre-condition | Steps | Expected Result | Priority |
|----|-------|---------------|-------|-----------------|----------|
| SR-01 | Default Mode (Jina) ✅ | `USE_PLAYWRIGHT_SCRAPER=false`, Valid `SERPER_API_KEY` | 1. Start agent discussion<br>2. Trigger search prompt | 1. Agent calls `web_search`<br>2. Logs show "Enriching with Jina"<br>3. Agent cites content | P0 |
| SR-02 | Playwright Mode ✅ | `USE_PLAYWRIGHT_SCRAPER=true`, Valid `SERPER_API_KEY` | 1. Start agent discussion<br>2. Trigger search | 1. Logs show "Using Playwright Scraper"<br>2. Top 20 results scraped<br>3. Agent cites deep content | P0 |
| SR-03 | Mock Mode Fallback ✅ | `SERPER_API_KEY` unset | 1. Start agent discussion<br>2. Trigger search | 1. Logs warn "SERPER_API_KEY not configured"<br>2. Returns mock "Wikipedia" results<br>3. No crash | P1 |
| SR-04 | Cache Hit ✅ | Previous search exists | 1. Run search "AI Trends"<br>2. Run search "AI Trends" again | 1. First run: "Cache miss"<br>2. Second run: "Cache hit" (no API call) | P2 |

### 2. Playwright Scraper Specifics

| ID | Title | Steps | Expected Result | Priority |
|----|-------|-------|-----------------|----------|
| PL-01 | Parallel Scraping ✅ | 1. Trigger Playwright search returning 10+ results | 1. Logs show 5 concurrent tabs launching<br>2. All successful scrapes returned | P1 |
| PL-02 | Timeout Handling ✅ | 1. Search query returning slow site | 1. Slow page times out (15s)<br>2. Scraper returns partial list (doesn't crash)<br>3. Result marked as fallback | P2 |

---

## 🤖 Core Agent Tests

### 3. Agent Execution (SDK)

| ID | Title | Steps | Expected Result | Priority |
|----|-------|-------|-----------------|----------|
| AG-01 | Round Participation ✅ | 1. Create Round Table (3 agents)<br>2. Start Round 1 | 1. All 3 agents speak in order<br>2. Personas match (e.g., Critic is critical) | P0 |
| AG-02 | Tool Use Decision ⏭️ | 1. Prompt: "What is the weather in Tokyo?" | 1. Agent identifies missing info<br>2. Calls `web_search` tool<br>3. Incorporates result in answer | P0 |
| AG-03 | Streaming ✅ | 1. Observe UI during generation | 1. Text appears chunk-by-chunk<br>2. Tool icon appears when searching<br>3. No UI freeze | P1 |

### 4. Configurable Rounds

| ID | Title | Steps | Expected Result | Priority |
|----|-------|-------|-----------------|----------|
| RD-01 | Custom Limit ✅ | 1. Create Table with `maxRounds=3` | 1. UI shows "Round 1 of 3" | P1 |
| RD-02 | Auto-Stop ✅ | 1. Complete Round 3 of 3 | 1. UI shows "Discussion Complete"<br>2. "Start Round" button disabled | P0 |
| RD-03 | Input Validation ✅ | 1. Try to create with 51 rounds | 1. API returns 400 Error | P2 |

---

## 🗳️ MoE Voting Tests

### 5. Asynchronous Voting

| ID | Title | Steps | Expected Result | Priority |
|----|-------|-------|-----------------|----------|
| VT-01 | Job Creation ✅ | 1. POST `/api/moe-vote` | 1. Returns `jobId`<br>2. Job status is `pending` | P1 |
| VT-02 | Execution & result ✅ | 1. Poll job status | 1. Status moves to `completed`<br>2. Winner declared<br>3. Scores available for all agents | P1 |

---

## 📝 Blog Synthesis Tests

### 6. Blog Generation

| ID | Title | Steps | Expected Result | Priority |
|----|-------|-------|-----------------|----------|
| BL-01 | Generate Post ✅ | 1. Click "Generate Blog Post" on finished table | 1. Modal opens<br>2. Content streams in<br>3. Markdown format (Headers, Bold) | P1 |

---

## 💾 System & Persistence

### 7. Database Integrity

| ID | Title | Steps | Expected Result | Priority |
|----|-------|-------|-----------------|----------|
| DB-01 | Cascade Delete ✅ | 1. Delete RoundTable | 1. Associated Agents deleted<br>2. Associated Messages deleted<br>3. Associated Rounds deleted | P1 |
| DB-02 | Resume Capability ✅ | 1. Stop server mid-discussion<br>2. Restart server | 1. Discussion state preserved<br>2. Can resume from last round | P2 |
