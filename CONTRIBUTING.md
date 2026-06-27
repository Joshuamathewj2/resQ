# Contributing to ResQ

Thank you for your interest in contributing to ResQ! This document outlines the development workflow and standards used across the project.

---

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Git

```bash
git clone https://github.com/Joshuamathewj2/resQ.git
cd resQ
npm install
cp .env.example .env.local
# Edit .env.local with your Gemini API key
npm run dev
```

---

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/progressive-monitoring` |
| Bug fix | `fix/<issue-or-description>` | `fix/gps-null-crash` |
| Documentation | `docs/<topic>` | `docs/api-integration` |
| Refactor | `refactor/<module>` | `refactor/gemini-service` |
| Test | `test/<module>` | `test/agent-fusion` |

---

## Commit Message Format

ResQ uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code restructure without behaviour change
- `docs` — documentation only
- `test` — adding or fixing tests
- `chore` — build, config, dependency updates
- `perf` — performance improvement

**Examples:**
```
feat(agent): add multi-modal confidence fusion algorithm
fix(camera): handle null stream in captureFrame gracefully
docs(readme): update architecture diagram with progressive monitoring
test(agent): add integration tests for DISPATCH decision path
chore(deps): upgrade vitest to 2.x
```

---

## PR Checklist

Before opening a pull request, ensure:

- [ ] `npm test` passes with 0 failures
- [ ] `npm run lint` produces 0 errors (warnings are acceptable)
- [ ] `npm run build` completes without TypeScript errors
- [ ] All new functions have JSDoc comments
- [ ] No new `console.log/warn/error` calls — use `createModuleLogger`
- [ ] No magic numbers — add to `src/config/constants.ts`
- [ ] New features have corresponding unit or integration tests
- [ ] Types for new data shapes are added to `src/types/index.ts`

---

## Code Standards

### TypeScript
- Strict mode enabled (`"strict": true`) — no implicit any or implicit returns
- Use named exports over default exports for non-page components
- Prefer `const` over `let`; avoid `var`
- Use `??` over `||` for nullish coalescing

### React
- Functional components with typed props interfaces
- Custom hooks in `src/hooks/` — named `use<Name>`
- Keep components focused — extract logic to hooks
- All interactive elements must have unique `id` attributes for testability

### Logging
```typescript
// ❌ Don't
console.log('Agent started');

// ✅ Do
import { createModuleLogger } from '@utils/logger';
const log = createModuleLogger('MyModule');
log.info('Agent started');
```

### Constants
```typescript
// ❌ Don't
const THRESHOLD = 24.5;

// ✅ Do — in src/config/constants.ts
export const IMPACT_THRESHOLD_M_S2 = 24.5;
```

---

## Running the Full Test Suite

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Coverage report (outputs to ./coverage/)
npm run test:coverage

# CLI simulation script
npx tsx scripts/simulate-accident.ts
```

---

## Project Structure Reference

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full project structure and data flow diagrams.
