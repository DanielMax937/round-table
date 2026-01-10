# Testing Rules

## E2E Browser Testing

When running E2E tests for this project:

1. **Server Management**
   - Ask user for service URL before starting (e.g., `http://localhost:3001`)
   - NEVER kill or restart the server
   - Code changes trigger automatic hot reload

2. **Test Execution Flow**
   ```
   Loop through test cases:
     1. browser_navigate → Visit page
     2. browser_snapshot → Get DOM state
     3. browser_click/type/select → Perform actions
     4. browser_take_screenshot → Capture result
     5. Verify against expected values
     6. If FAIL → Fix code → Retest
     7. If PASS → Update TEST.md → Next test
   ```

3. **Test Case Reference**
   - See `TEST.md` for full test case list and status
   - See `.claude/skills/e2e-browser-testing.md` for detailed workflow

4. **Screenshot Convention**
   - Save to `.playwright-mcp/` directory
   - Format: `tc_{section}_{case}_{description}.png`

5. **Dev Mode for Special Tests**
   - Enable via bug icon in header
   - Use DEV PANEL for:
     - Fast-forward (victory testing)
     - Force betrayal (betrayal testing)
     - Force revolt (revolt testing)
     - Set stability (collapse testing)

## Fix-and-Retest Pattern

When a test fails:

```
1. Identify failure reason from DOM snapshot
2. Locate relevant file:
   - UI issues → src/components/*.tsx
   - Logic issues → src/store/useGameStore.ts
   - Core logic → src/core/*.ts
3. Apply fix via search_replace
4. Wait for hot reload (automatic)
5. Re-navigate and retest
6. Take new screenshot on success
```

## Test Progress Tracking

Update `TEST.md` after completing tests:
- Mark test as ✅ PASSED
- Add screenshot reference
- Update summary counts
