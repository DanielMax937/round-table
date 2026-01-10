# E2E Browser Testing Skill

Use this skill when testing web applications via browser. This skill loops through test cases defined in TEST.md, uses browser tools to verify functionality, takes screenshots, and fixes any issues found.

## Required Input

Before starting, ask the user:

> **What URL is the service running on?**
> Example: `http://localhost:3001`

Store the URL as `{{SERVICE_URL}}` for all browser operations.

## Prerequisites

- Dev server running on `{{SERVICE_URL}}` (hot reload enabled)
- Never kill or restart the server - code changes auto-reload
- Browser MCP tools available (`mcp_cursor-ide-browser_*`)
- `TEST.md` file in project root with test cases

## Workflow

### Step 1: Read Test Cases

```
read_file → TEST.md
```

Parse the test case tables to get:
- Test ID (e.g., TC-1.1)
- Test Case name
- Action to perform
- Verification criteria

### Step 2: Navigate to Service

```
browser_navigate → {{SERVICE_URL}}
```

### Step 3: Get DOM Snapshot

```
browser_snapshot → Get current page state
```

- Parse the YAML snapshot to identify elements
- Note element `ref` values for interactions

### Step 4: Loop Through Test Cases

For each test case in TEST.md:

1. **Identify Target Elements**
   - Use Element Reference section in TEST.md
   - Match element names/titles to snapshot refs

2. **Perform Actions**
   ```
   browser_click → Click element by ref
   browser_type → Type text into input
   browser_select_option → Select from dropdown
   ```

3. **Capture State**
   ```
   browser_snapshot → Get updated DOM
   browser_take_screenshot → Save as tc_X_X_description.png
   ```

4. **Verify Results**
   - Compare DOM state against verification criteria
   - Check stat values, log messages, UI changes

5. **Record Result**
   - PASS: Update TEST.md, continue to next test
   - FAIL: Go to Step 5 (Fix and Retest)

### Step 5: Handle Failures

If verification fails:

1. **Identify the Issue**
   - Missing UI element → Add to component
   - Wrong value → Fix game logic
   - Broken interaction → Fix event handler

2. **Fix the Code**
   - Use `search_replace` to modify source files
   - Common locations:
     - `src/components/*.tsx` - UI issues
     - `src/store/*.ts` - State/logic issues
     - `src/core/*.ts` - Core logic issues

3. **Wait for Hot Reload**
   - Server auto-restarts on code change
   - No need to manually restart

4. **Retest**
   - Navigate back to service
   - Re-execute the failing test case
   - Take new screenshot on success

### Step 6: Update Progress

After completing tests:
- Update `TEST.md` with results
- Mark tests as ✅ PASSED or ❌ FAILED
- Add screenshot references
- Update summary counts

## Example Test Execution

```
# Read TEST.md for test cases
# TC-1.1: Initial Resource Check

1. browser_navigate → {{SERVICE_URL}}
2. browser_snapshot → Get DOM
3. Verify from snapshot:
   - Find "国库 (Treasury)" → Check value = "100,000"
   - Find "国力 (Stability)" → Check value = "80"
   - Find "威望 (Prestige)" → Check value = "100"
   - Find "精力 (Energy)" → Check value = "100"
   - Find "禁军 (Central Army)" → Check value = "50,000"
4. browser_take_screenshot → tc_1_1_initial_resources.png
5. If all match: Mark TC-1.1 as PASSED ✅
6. Update TEST.md
7. Continue to TC-1.2
```

## Dev Mode Testing

For tests requiring special conditions (check TEST.md for Dev Mode Features):

1. **Enable Dev Mode**
   ```
   browser_click → Toggle Dev Mode button
   browser_click → DEV PANEL button
   ```

2. **Use Dev Features**
   - Fast-Forward: Jump to specific year
   - Force actions: Trigger special events
   - Set values: Override game state

## Important Notes

1. **Never restart the server** - It runs on `{{SERVICE_URL}}` with hot reload
2. **Read TEST.md first** - Get test cases and element references
3. **Take screenshots** for visual verification and documentation
4. **Update TEST.md** after completing tests to track progress
5. **Use Dev Mode** for hard-to-trigger scenarios
6. **Fix code immediately** when tests fail, then retest
7. **Always ask for URL first** if not provided by user
