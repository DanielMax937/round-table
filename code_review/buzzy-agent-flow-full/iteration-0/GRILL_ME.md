# Grill Questions

## Intent & Context

### 1. What is the Buzzy Agent feature and why are you adding navigation to it in this PR?

**What a good answer should mention:**
- Buzzy Agent is a new movie-related AI feature (based on component name `BuzzyAgentStudio`)
- The feature allows users to interact with an agent canvas, possibly for generating/editing movie content
- Navigation is being added to make the feature discoverable from multiple entry points (global nav, movies page, per-movie actions)
- Should acknowledge whether this is a soft launch, beta feature, or full release

### 2. Why are the route files (`app/buzzy-agent/page.tsx` and `components/BuzzyAgentStudio.tsx`) untracked while the navigation links are tracked?

**What a good answer should mention:**
- Explicit acknowledgment of the discrepancy
- Whether this was intentional (e.g., route in separate branch/PR) or accidental
- Plan for when/how the route files will be tracked
- Understanding that Next.js App Router requires tracked route files for navigation to work in production

---

## Happy Path

### 3. Walk me through the user journey when someone clicks "Buzzy Agent" in the global navigation. What should happen?

**What a good answer should mention:**
- User navigates from any page to `/buzzy-agent`
- `BuzzyAgentStudio` component renders
- User sees agent canvas interface
- Ability to create/interact with movie-related AI agent
- Should mention that this currently **doesn't work** because route is untracked

### 4. What's the difference between clicking the top-level "Create with Buzzy Agent" button vs. clicking a per-movie "Agent Canvas" button?

**What a good answer should mention:**
- Top-level button: navigates to `/buzzy-agent` without context
- Per-movie button: navigates to `/buzzy-agent?movieId=<id>` with specific movie context
- Route handler needs to detect and parse the `movieId` query parameter
- Different UX: blank canvas vs. pre-populated with movie data
- Should acknowledge if query param handling is implemented in the untracked route

---

## Failure Modes

### 5. What happens if a user clicks any of these three new navigation elements after this PR merges?

**What a good answer should mention:**
- User sees a Next.js 404 page
- Error occurs because `app/buzzy-agent/page.tsx` doesn't exist in the deployment
- Affects **all three entry points**: global nav (site-wide), movies page CTA, per-movie CTAs
- Blast radius is broad because global nav appears on every page
- This is a production-breaking regression

### 6. Why would this work perfectly in local development but fail in CI/CD or production?

**What a good answer should mention:**
- Local dev server with HMR serves untracked files from the working directory
- CI/CD builds from a clean checkout containing only tracked files
- Production builds similarly only include committed/tracked files
- This is a "false positive" testing scenario - local success doesn't guarantee deployment success
- Git tracking vs. file system presence distinction

### 7. What's the blast radius of this issue? How many users are affected and through what paths?

**What a good answer should mention:**
- **Every user** who visits the site can encounter the 404 via global navigation
- Movies page visitors see two broken CTAs (top-level + all per-movie buttons)
- Three distinct failure paths with the global nav being highest impact
- No user can successfully access Buzzy Agent feature
- Brand/trust impact from broken navigation in primary UI

### 8. If you needed to emergency rollback this PR after merge, what's involved?

**What a good answer should mention:**
- Simple `git revert` of the commit
- Redeploy to remove broken links
- Low rollback risk because changes are purely additive navigation
- No data migration or database changes to reverse
- However, user confusion if they heard about the feature externally (marketing, etc.)

---

## Security & Permissions

### 9. Could malicious users exploit the untracked route state in any way?

**What a good answer should mention:**
- Limited direct security risk since route truly doesn't exist (404 vs. vulnerable endpoint)
- Potential info disclosure if 404 page reveals internal paths or stack traces
- Social engineering risk: users might click broken links and land on phishing-lookalike 404s if not properly branded
- Once route is added, need to verify authentication/authorization for Buzzy Agent access

### 10. When the route is eventually tracked, what permissions/authentication should `/buzzy-agent` enforce?

**What a good answer should mention:**
- Whether Buzzy Agent requires user authentication
- Whether movie-specific access (`?movieId=<id>`) requires ownership/permissions checks
- Rate limiting for AI interactions
- API key validation if Buzzy Agent calls external services
- Should acknowledge if this is already implemented in the untracked route or still needs design

---

## Data & Compatibility

### 11. Does the Buzzy Agent feature create or modify data? What happens to that data if the route is unavailable?

**What a good answer should mention:**
- Whether agents create movie content, user sessions, or other persisted data
- Database schema changes (if any) in untracked migrations
- Orphaned data risk if users somehow accessed the feature then lost access
- Backward compatibility if older app versions reference `/buzzy-agent`

### 12. Are there any query parameters, local storage, or cookies that depend on this route existing?

**What a good answer should mention:**
- `movieId` query parameter is documented in per-movie links
- Whether app pre-fetches or caches `/buzzy-agent` route metadata
- Whether other pages save "last visited agent canvas" state
- Analytics/tracking implications of broken navigation links

---

## Testing & Validation

### 13. What testing did you perform before submitting this PR? Did it include testing from a clean checkout?

**What a good answer should mention:**
- Local testing only validates HMR behavior, not production builds
- Need to test `npm run build && npm run start` from clean checkout
- E2E tests should navigate to `/buzzy-agent` and verify 200 response (not 404)
- Should include tests for all three navigation entry points
- Should acknowledge lack of clean-checkout testing if not performed

### 14. How would you detect this issue in CI/CD before production deployment?

**What a good answer should mention:**
- Pre-commit hook to validate all `href` attributes resolve to tracked routes
- CI smoke test: build from clean checkout and assert `/buzzy-agent` returns 200
- Link validator that scrapes built site and checks for 404s
- Next.js build warnings for unreachable routes (if any)
- Should acknowledge current CI doesn't catch this

### 15. What end-to-end test cases should exist for the Buzzy Agent feature?

**What a good answer should mention:**
- **TC1**: Click global nav "Buzzy Agent" → renders agent canvas
- **TC2**: Click movies page "Create with Buzzy Agent" → renders blank canvas
- **TC3**: Click per-movie "Agent Canvas" → renders canvas with movie context
- **TC4**: Verify `?movieId=123` is parsed and loads correct movie data
- **TC5**: Test authentication/authorization if required
- **TC6**: Test graceful error handling for invalid movieIds

---

## Architecture & Dependencies

### 16. What files does `app/buzzy-agent/page.tsx` depend on? Are they all tracked?

**What a good answer should mention:**
- `components/BuzzyAgentStudio.tsx` (currently untracked)
- Potential dependencies: movie data fetching utilities, AI client libraries, shared UI components
- Database queries or API calls for movie context
- Environment variables (API keys for AI services)
- Should acknowledge full dependency audit hasn't been completed if files are untracked

### 17. If another developer runs `git grep "/buzzy-agent"` six months from now, what will they find?

**What a good answer should mention:**
- If this PR merges as-is: only the navigation links in tracked files
- Won't see the actual route implementation (if it remains untracked)
- Reverse dependency problem: hard to safely refactor or remove
- Need for better code ownership documentation
- Should mention whether there's a plan to track all Buzzy Agent files together

---

## Deployment Strategy

### 18. Should this feature be behind a feature flag? Why or why not?

**What a good answer should mention:**
- **Yes**, because route implementation is incomplete/untracked
- Allows safe deployment of navigation code while route is finalized
- Enables gradual rollout (beta users, A/B testing)
- Easy rollback without redeployment (toggle flag off)
- Example: `if (process.env.NEXT_PUBLIC_BUZZY_AGENT_ENABLED)`

### 19. What's the correct order of operations to safely deploy this feature?

**What a good answer should mention:**
1. Track and merge `app/buzzy-agent/page.tsx` + `BuzzyAgentStudio.tsx` + dependencies **first**
2. Verify route works in staging/production (E2E smoke test)
3. **Then** merge navigation links in separate PR
4. Or: merge both atomically in a single PR
5. Or: use feature flag and deploy in any order, enabling only when ready

### 20. How will you monitor for issues after this PR deploys?

**What a good answer should mention:**
- 404 rate monitoring (spike in `/buzzy-agent` not-found errors)
- User session replay for clicked links leading to errors
- Error tracking (Sentry, Datadog) for Next.js 404 logs
- User support tickets mentioning broken navigation
- Analytics: funnel drop-off at Buzzy Agent navigation clicks
- Should acknowledge if monitoring isn't currently configured for this

---

## Merge Readiness Rubric

### ✅ Ready to Merge When:
- [ ] `app/buzzy-agent/page.tsx` and `components/BuzzyAgentStudio.tsx` are tracked in this PR or a prerequisite PR is already merged
- [ ] All navigation links verified to resolve to existing routes in a clean-checkout build
- [ ] E2E tests added for all three navigation entry points (global nav, top CTA, per-movie CTA)
- [ ] Query parameter handling (`?movieId=<id>`) tested and working
- [ ] Feature flag added if deployment is phased, or removed if full rollout
- [ ] CI/CD includes link validation or route existence checks
- [ ] 404 monitoring configured for `/buzzy-agent` route

### ⚠️ Needs Work If:
- [ ] Links point to untracked routes (current state)
- [ ] No E2E tests for navigation flows
- [ ] Clean-checkout builds not tested
- [ ] No monitoring for 404 errors
- [ ] Unclear deployment order or feature flag strategy

### 🚫 Do Not Merge If:
- [ ] This PR alone causes site-wide 404s from global navigation (current state)
- [ ] No plan exists to track the route files before or during merge
- [ ] Rollback strategy is undefined
- [ ] No testing validates production build behavior

**Current Status:** 🚫 **BLOCK** - High-severity issue (RF-001) requires route files to be tracked before merge or links to be removed/feature-gated.

# Grill Questions

## Intent & Context

### 1. What is the Buzzy Agent feature and why are you adding navigation to it in this PR?

**What a good answer should mention:**
- Buzzy Agent is a new movie-related AI feature (based on component name `BuzzyAgentStudio`)
- The feature allows users to interact with an agent canvas, possibly for generating/editing movie content
- Navigation is being added to make the feature discoverable from multiple entry points (global nav, movies page, per-movie actions)
- Should acknowledge whether this is a soft launch, beta feature, or full release

### 2. Why are the route files (`app/buzzy-agent/page.tsx` and `components/BuzzyAgentStudio.tsx`) untracked while the navigation links are tracked?

**What a good answer should mention:**
- Explicit acknowledgment of the discrepancy
- Whether this was intentional (e.g., route in separate branch/PR) or accidental
- Plan for when/how the route files will be tracked
- Understanding that Next.js App Router requires tracked route files for navigation to work in production

---

## Happy Path

### 3. Walk me through the user journey when someone clicks "Buzzy Agent" in the global navigation. What should happen?

**What a good answer should mention:**
- User navigates from any page to `/buzzy-agent`
- `BuzzyAgentStudio` component renders
- User sees agent canvas interface
- Ability to create/interact with movie-related AI agent
- Should mention that this currently **doesn't work** because route is untracked

### 4. What's the difference between clicking the top-level "Create with Buzzy Agent" button vs. clicking a per-movie "Agent Canvas" button?

**What a good answer should mention:**
- Top-level button: navigates to `/buzzy-agent` without context
- Per-movie button: navigates to `/buzzy-agent?movieId=<id>` with specific movie context
- Route handler needs to detect and parse the `movieId` query parameter
- Different UX: blank canvas vs. pre-populated with movie data
- Should acknowledge if query param handling is implemented in the untracked route

---

## Failure Modes

### 5. What happens if a user clicks any of these three new navigation elements after this PR merges?

**What a good answer should mention:**
- User sees a Next.js 404 page
- Error occurs because `app/buzzy-agent/page.tsx` doesn't exist in the deployment
- Affects **all three entry points**: global nav (site-wide), movies page CTA, per-movie CTAs
- Blast radius is broad because global nav appears on every page
- This is a production-breaking regression

### 6. Why would this work perfectly in local development but fail in CI/CD or production?

**What a good answer should mention:**
- Local dev server with HMR serves untracked files from the working directory
- CI/CD builds from a clean checkout containing only tracked files
- Production builds similarly only include committed/tracked files
- This is a "false positive" testing scenario - local success doesn't guarantee deployment success
- Git tracking vs. file system presence distinction

### 7. What's the blast radius of this issue? How many users are affected and through what paths?

**What a good answer should mention:**
- **Every user** who visits the site can encounter the 404 via global navigation
- Movies page visitors see two broken CTAs (top-level + all per-movie buttons)
- Three distinct failure paths with the global nav being highest impact
- No user can successfully access Buzzy Agent feature
- Brand/trust impact from broken navigation in primary UI

### 8. If you needed to emergency rollback this PR after merge, what's involved?

**What a good answer should mention:**
- Simple `git revert` of the commit
- Redeploy to remove broken links
- Low rollback risk because changes are purely additive navigation
- No data migration or database changes to reverse
- However, user confusion if they heard about the feature externally (marketing, etc.)

---

## Security & Permissions

### 9. Could malicious users exploit the untracked route state in any way?

**What a good answer should mention:**
- Limited direct security risk since route truly doesn't exist (404 vs. vulnerable endpoint)
- Potential info disclosure if 404 page reveals internal paths or stack traces
- Social engineering risk: users might click broken links and land on phishing-lookalike 404s if not properly branded
- Once route is added, need to verify authentication/authorization for Buzzy Agent access

### 10. When the route is eventually tracked, what permissions/authentication should `/buzzy-agent` enforce?

**What a good answer should mention:**
- Whether Buzzy Agent requires user authentication
- Whether movie-specific access (`?movieId=<id>`) requires ownership/permissions checks
- Rate limiting for AI interactions
- API key validation if Buzzy Agent calls external services
- Should acknowledge if this is already implemented in the untracked route or still needs design

---

## Data & Compatibility

### 11. Does the Buzzy Agent feature create or modify data? What happens to that data if the route is unavailable?

**What a good answer should mention:**
- Whether agents create movie content, user sessions, or other persisted data
- Database schema changes (if any) in untracked migrations
- Orphaned data risk if users somehow accessed the feature then lost access
- Backward compatibility if older app versions reference `/buzzy-agent`

### 12. Are there any query parameters, local storage, or cookies that depend on this route existing?

**What a good answer should mention:**
- `movieId` query parameter is documented in per-movie links
- Whether app pre-fetches or caches `/buzzy-agent` route metadata
- Whether other pages save "last visited agent canvas" state
- Analytics/tracking implications of broken navigation links

---

## Testing & Validation

### 13. What testing did you perform before submitting this PR? Did it include testing from a clean checkout?

**What a good answer should mention:**
- Local testing only validates HMR behavior, not production builds
- Need to test `npm run build && npm run start` from clean checkout
- E2E tests should navigate to `/buzzy-agent` and verify 200 response (not 404)
- Should include tests for all three navigation entry points
- Should acknowledge lack of clean-checkout testing if not performed

### 14. How would you detect this issue in CI/CD before production deployment?

**What a good answer should mention:**
- Pre-commit hook to validate all `href` attributes resolve to tracked routes
- CI smoke test: build from clean checkout and assert `/buzzy-agent` returns 200
- Link validator that scrapes built site and checks for 404s
- Next.js build warnings for unreachable routes (if any)
- Should acknowledge current CI doesn't catch this

### 15. What end-to-end test cases should exist for the Buzzy Agent feature?

**What a good answer should mention:**
- **TC1**: Click global nav "Buzzy Agent" → renders agent canvas
- **TC2**: Click movies page "Create with Buzzy Agent" → renders blank canvas
- **TC3**: Click per-movie "Agent Canvas" → renders canvas with movie context
- **TC4**: Verify `?movieId=123` is parsed and loads correct movie data
- **TC5**: Test authentication/authorization if required
- **TC6**: Test graceful error handling for invalid movieIds

---

## Architecture & Dependencies

### 16. What files does `app/buzzy-agent/page.tsx` depend on? Are they all tracked?

**What a good answer should mention:**
- `components/BuzzyAgentStudio.tsx` (currently untracked)
- Potential dependencies: movie data fetching utilities, AI client libraries, shared UI components
- Database queries or API calls for movie context
- Environment variables (API keys for AI services)
- Should acknowledge full dependency audit hasn't been completed if files are untracked

### 17. If another developer runs `git grep "/buzzy-agent"` six months from now, what will they find?

**What a good answer should mention:**
- If this PR merges as-is: only the navigation links in tracked files
- Won't see the actual route implementation (if it remains untracked)
- Reverse dependency problem: hard to safely refactor or remove
- Need for better code ownership documentation
- Should mention whether there's a plan to track all Buzzy Agent files together

---

## Deployment Strategy

### 18. Should this feature be behind a feature flag? Why or why not?

**What a good answer should mention:**
- **Yes**, because route implementation is incomplete/untracked
- Allows safe deployment of navigation code while route is finalized
- Enables gradual rollout (beta users, A/B testing)
- Easy rollback without redeployment (toggle flag off)
- Example: `if (process.env.NEXT_PUBLIC_BUZZY_AGENT_ENABLED)`

### 19. What's the correct order of operations to safely deploy this feature?

**What a good answer should mention:**
1. Track and merge `app/buzzy-agent/page.tsx` + `BuzzyAgentStudio.tsx` + dependencies **first**
2. Verify route works in staging/production (E2E smoke test)
3. **Then** merge navigation links in separate PR
4. Or: merge both atomically in a single PR
5. Or: use feature flag and deploy in any order, enabling only when ready

### 20. How will you monitor for issues after this PR deploys?

**What a good answer should mention:**
- 404 rate monitoring (spike in `/buzzy-agent` not-found errors)
- User session replay for clicked links leading to errors
- Error tracking (Sentry, Datadog) for Next.js 404 logs
- User support tickets mentioning broken navigation
- Analytics: funnel drop-off at Buzzy Agent navigation clicks
- Should acknowledge if monitoring isn't currently configured for this

---

## Merge Readiness Rubric

### ✅ Ready to Merge When:
- [ ] `app/buzzy-agent/page.tsx` and `components/BuzzyAgentStudio.tsx` are tracked in this PR or a prerequisite PR is already merged
- [ ] All navigation links verified to resolve to existing routes in a clean-checkout build
- [ ] E2E tests added for all three navigation entry points (global nav, top CTA, per-movie CTA)
- [ ] Query parameter handling (`?movieId=<id>`) tested and working
- [ ] Feature flag added if deployment is phased, or removed if full rollout
- [ ] CI/CD includes link validation or route existence checks
- [ ] 404 monitoring configured for `/buzzy-agent` route

### ⚠️ Needs Work If:
- [ ] Links point to untracked routes (current state)
- [ ] No E2E tests for navigation flows
- [ ] Clean-checkout builds not tested
- [ ] No monitoring for 404 errors
- [ ] Unclear deployment order or feature flag strategy

### 🚫 Do Not Merge If:
- [ ] This PR alone causes site-wide 404s from global navigation (current state)
- [ ] No plan exists to track the route files before or during merge
- [ ] Rollback strategy is undefined
- [ ] No testing validates production build behavior

**Current Status:** 🚫 **BLOCK** - High-severity issue (RF-001) requires route files to be tracked before merge or links to be removed/feature-gated.
