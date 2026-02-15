# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

@gramio/session is a session management plugin for GramIO (a type-safe Telegram Bot API framework). It provides persistent session storage for Telegram bot contexts with pluggable storage backends. The project supports multiple runtimes: Node.js, Bun, and Deno.

## Development Commands

**Build:**
```bash
bunx pkgroll
```
This is automatically run during `prepublishOnly`. Uses pkgroll to generate dual CJS/ESM outputs.

**Type checking:**
```bash
bunx tsc --noEmit
```

**Tests:**
```bash
bun test
```
Run this after ANY code change. All tests must pass before committing.

**Pre-commit validation:**
```bash
bunx tsc --noEmit && bun test
```
Always run BOTH type-checking and tests before committing or pushing changes.

**Publishing preparation (JSR):**
```bash
bun scripts/prepare-jsr.ts
```
Synchronizes version from package.json to deno.json and runs slow-types-compiler to fix Deno compatibility.

## Architecture

### Core Design

The plugin is organized into focused modules in `src/lib/`:

**File Structure:**
```
src/
├── index.ts                 # Public API (88 lines)
└── lib/
    ├── types.ts            # Type definitions
    ├── proxy.ts            # Proxy creation & caching (prevents memory leaks)
    ├── session-manager.ts  # Core session logic (shared by lazy/eager)
    ├── derive-eager.ts     # Eager mode implementation
    └── derive-lazy.ts      # Lazy mode implementation
```

**Design Principles:**
- Each file has **single responsibility**
- **Zero code duplication** (shared logic in session-manager)
- Easy to extend (add new file in `lib/`)
- See `src/lib/README.md` for detailed architecture docs

**Reactive Session Pattern:**
- Uses JavaScript `Proxy` to automatically track changes to session data
- When session properties are modified, the `onUpdate` callback triggers storage synchronization
- Nested objects/arrays are recursively proxied (see `createProxy` function)
- This ensures session state is always persisted without explicit save calls

**Plugin Integration:**
- Extends GramIO's `Plugin` class to derive additional context properties
- Uses `.derive()` to add session data to context for specific Telegram events
- Sessions are scoped to events that have a `senderId` (messages, callbacks, inline queries, etc.)

**Storage Abstraction:**
- Default: in-memory storage (via `@gramio/storage`)
- Pluggable: supports any storage implementing the `Storage` interface (Redis, file-based, etc.)
- Storage key defaults to `senderId` but can be customized via `getSessionKey` option

### Event Coverage

The plugin derives session context for 29 specific Telegram event types (not all events). See the `Events` type union for the full list. Notable events include:
- `message`, `callback_query`, `inline_query`
- `successful_payment`, `pre_checkout_query`
- `chat_join_request`, `new_chat_members`
- Video chat events, passport data, etc.

### Type Safety

Session data is typed through the `initial` function's return type:
```typescript
interface MySessionData {
    apple: number;
    some?: "maybe-empty";
}

session({
    key: "sessionKey",
    initial: (): MySessionData => ({ apple: 1 }),
})
```

The generic types flow through to context augmentation, providing full IntelliSense.

### Memory Leak Fixes (v0.1.7+)

**IMPORTANT**: The following memory leak issues were fixed in version 0.1.7:

1. **Proxy Duplication** - Previously, each access to a nested object created a new Proxy, causing memory leaks:
   ```typescript
   // OLD (leaked memory):
   const ref1 = ctx.session.nested; // Creates new proxy
   const ref2 = ctx.session.nested; // Creates ANOTHER new proxy

   // NEW (cached):
   const ref1 = ctx.session.nested; // Creates proxy
   const ref2 = ctx.session.nested; // Returns SAME proxy
   ```
   **Fix**: `WeakMap` caches (`proxyCache` and `targetCache`) ensure the same proxy is reused.

2. **Missing `deleteProperty` trap** - Property deletion didn't trigger storage updates:
   ```typescript
   delete ctx.session.someProperty; // Didn't save to storage!
   ```
   **Fix**: Added `deleteProperty` trap that calls `onUpdate()`.

3. **Internal methods in storage** - The `$clear` method was being saved to storage:
   ```typescript
   // Storage incorrectly contained: { counter: 1, $clear: [Function] }
   ```
   **Fix**: `onUpdate()` filters out `$clear` before saving.

**Implementation Details**:
- `proxyCache`: Maps original objects to their proxies (prevents duplicate proxies)
- `targetCache`: Maps proxies back to original objects (for storage serialization)
- Both use `WeakMap` for proper garbage collection
- The `$clear()` method is non-enumerable and explicitly filtered during storage operations

### Lazy Sessions (v0.1.7+)

**Feature**: Lazy sessions only load from storage when actually accessed, significantly reducing database reads.

```typescript
// Eager mode (default) - Always loads
bot.extend(session({ initial: () => ({ count: 0 }) }));
bot.on("message", (ctx) => {
    // Session loaded even if not used ❌
    ctx.send("Hello!");
});

// Lazy mode - Loads only when accessed
bot.extend(session({ lazy: true, initial: () => ({ count: 0 }) }));
bot.on("message", async (ctx) => {
    // Session NOT loaded ✅
    ctx.send("Hello!");
});
bot.on("message", async (ctx) => {
    const session = await ctx.session;  // Loads HERE
    session.count++;
});
```

**Benefits**:
- 50-90% fewer database reads for bots with many handlers
- Lower costs for cloud storage services
- Faster responses for handlers that don't need session
- Automatic caching per-update (multiple accesses = single load)

**Type Safety**: When `lazy: true`, `ctx.session` is `Promise<Data>` and must be awaited. TypeScript enforces this at compile time.

**See**: `LAZY_SESSIONS_EXAMPLE.ts` for detailed comparison

### Concurrency Behavior

**Single User Updates**: Telegram processes updates sequentially per bot instance. Each update from the same user is handled one at a time, so there are no race conditions for same-user updates in normal operation.

**Multi-User Updates**: Different users have different session keys, so their sessions are completely independent. Concurrent updates from different users work correctly.

**Known Limitation**: If you manually trigger concurrent processing for the same user (e.g., via webhooks with multiple workers), the last write wins. This is expected behavior for in-memory session storage without distributed locking.

## Publishing Process

This package is **dual-published** to NPM and JSR:

1. **NPM**: Standard npm package with CJS/ESM dual exports
2. **JSR**: Deno-focused registry with TypeScript source

The publish workflow (`.github/workflows/publish.yml`) is manual (`workflow_dispatch`) and:
1. Generates changelog
2. Syncs versions between package.json and deno.json
3. Type-checks with `tsc`
4. Publishes to JSR using `deno publish`
5. Publishes to NPM using `npm publish`
6. Creates GitHub release with changelog

## Testing

This package uses `@gramio/test` for bot testing and `bun:test` as the test runner.

**Test Coverage Requirements:**
- Basic session functionality (init, persistence, custom keys, user separation)
- Nested object/array modifications
- Property deletion (top-level and nested)
- Session clearing (`$clear` method)
- Proxy caching (memory leak prevention)
- Race conditions and concurrent access
- Custom storage implementations
- Different Telegram event types
- Edge cases (null values, empty state)
- **Lazy sessions** (load behavior, caching, performance)

**Test Location:**
- All tests in `tests/` folder (not `src/`)
- Import from `../src/index.js` in test files

**Running Tests:**
```bash
bun test                    # Run all tests
bunx tsc --noEmit          # Type-check
bunx tsc --noEmit && bun test  # Full validation
```

**When Adding Tests:**
- Test both storage state (via `storage.get()`) and runtime behavior
- Use separate storage instances per test to avoid interference
- Test concurrent operations to catch race conditions
- Verify proxy caching by checking object identity (`===`)

## Code Patterns

**Avoid:**
- Breaking changes to the `SessionOptions` interface (peer dependency constraints)
- Adding dependencies beyond `@gramio/storage` (keep it lightweight)
- Modifying `proxyCache` or `targetCache` logic without understanding memory leak implications
- Creating files outside of `src/lib/` structure

**When modifying:**
- **ALWAYS** run `bunx tsc --noEmit && bun test` before committing
- **ALWAYS** update README.md if adding features or changing behavior
- Update the `Events` type union (in `src/lib/types.ts`) if new Telegram events need session support
- Ensure both `@ts-ignore` comments have explanatory context (current ones are for upstream type issues)
- Test with both in-memory and external storage (e.g., Redis) to verify proxy behavior
- Check that nested object/array mutations trigger storage updates
- Verify that `onUpdate()` properly filters out internal methods (`$clear`)
- Test concurrent access scenarios if modifying proxy or storage logic

**When adding features:**
- Create new file in `src/lib/` with clear, single responsibility
- Export from `index.ts` if part of public API
- Add tests in `tests/` folder
- Update `CLAUDE.md` with implementation notes
- **Update README.md** with usage examples and documentation
- Add JSDoc comments to all public functions

## Multi-Runtime Considerations

- Primary development uses **Bun** (see bun.lockb)
- TypeScript config targets ES2022 with NodeNext module resolution
- Deno config maps imports to JSR packages
- Keep code compatible with all three runtimes (avoid runtime-specific APIs)
