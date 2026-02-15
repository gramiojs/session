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
tsc --noEmit
```

**Publishing preparation (JSR):**
```bash
bun scripts/prepare-jsr.ts
```
Synchronizes version from package.json to deno.json and runs slow-types-compiler to fix Deno compatibility.

## Architecture

### Core Design

The entire plugin implementation is in a **single file** (`src/index.ts`). This is intentional for simplicity as a focused plugin.

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

## Code Patterns

**Avoid:**
- Creating additional files unless necessary (keep the single-file architecture)
- Breaking changes to the `SessionOptions` interface (peer dependency constraints)
- Adding dependencies beyond `@gramio/storage` (keep it lightweight)

**When modifying:**
- Update the `Events` type union if new Telegram events need session support
- Ensure both `@ts-ignore` comments have explanatory context (current ones are for upstream type issues)
- Test with both in-memory and external storage (e.g., Redis) to verify proxy behavior
- Check that nested object/array mutations trigger storage updates

## Multi-Runtime Considerations

- Primary development uses **Bun** (see bun.lockb)
- TypeScript config targets ES2022 with NodeNext module resolution
- Deno config maps imports to JSR packages
- Keep code compatible with all three runtimes (avoid runtime-specific APIs)
