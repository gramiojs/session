# Session Plugin Internal Library

This directory contains the internal implementation of the session plugin, separated by concern.

## Files

### `types.ts`
Type definitions and interfaces used throughout the plugin.
- `Events` - Telegram events that support sessions
- `SessionOptions` - Configuration options
- `SessionData` - Conditional type for lazy/eager modes

### `proxy.ts`
Reactive proxy creation with WeakMap caching to prevent memory leaks.
- `createProxy()` - Creates a reactive proxy with automatic updates
- `getTarget()` - Extracts original object from proxy

**Key feature**: WeakMap caching prevents creating duplicate proxies for the same object.

### `session-manager.ts`
Core session management logic.
- `createSessionWithClear()` - Creates session with $clear method
- `loadSessionData()` - Loads data from storage or creates initial

**Shared by both lazy and eager modes**.

### `derive-eager.ts`
Eager session plugin implementation.
- Loads session data immediately when derive function runs
- `ctx.session` is directly accessible (not a Promise)

### `derive-lazy.ts`
Lazy session plugin implementation.
- Defers loading until `ctx.session` is accessed
- `ctx.session` is a Promise (must await)
- Reduces database reads for handlers that don't use sessions

## Architecture

```
┌─────────────────────────────────────────────┐
│            index.ts (public API)             │
│  ┌────────────────────────────────────────┐ │
│  │  session(options)                      │ │
│  │    ├─> lazy? createLazy : createEager │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ derive-lazy.ts   │    │ derive-eager.ts  │
│                  │    │                  │
│ - Promise-based  │    │ - Direct access  │
│ - Deferred load  │    │ - Immediate load │
└────────┬─────────┘    └─────────┬────────┘
         │                        │
         │   ┌────────────────────┘
         │   │
         ▼   ▼
┌──────────────────────────────────┐
│     session-manager.ts           │
│  ┌────────────────────────────┐  │
│  │ createSessionWithClear()   │  │
│  │ loadSessionData()          │  │
│  └────────────────────────────┘  │
└──────────────┬───────────────────┘
               │
               ▼
      ┌────────────────┐
      │   proxy.ts     │
      │ ┌────────────┐ │
      │ │createProxy││ │
      │ │getTarget  ││ │
      │ └────────────┘ │
      └────────────────┘
               │
               ▼
      ┌────────────────┐
      │   types.ts     │
      │ ┌────────────┐ │
      │ │Events     ││ │
      │ │Options    ││ │
      │ │SessionData││ │
      │ └────────────┘ │
      └────────────────┘
```

## Design Principles

1. **Single Responsibility**: Each file has one clear purpose
2. **DRY (Don't Repeat Yourself)**: Shared logic extracted to session-manager
3. **Type Safety**: All functions fully typed
4. **Documentation**: Every export has JSDoc
5. **Testability**: Pure functions, easy to mock
6. **Performance**: WeakMap caching, lazy loading

## Adding Features

### Example: Adding Session TTL

1. **Create new file**: `src/lib/ttl.ts`
```typescript
export function wrapWithTTL<T>(
    data: T,
    ttl: number
): { data: T; expiresAt: number } {
    return {
        data,
        expiresAt: Date.now() + ttl,
    };
}

export function isExpired(item: { expiresAt: number }): boolean {
    return Date.now() > item.expiresAt;
}
```

2. **Update types**: Add `ttl?: number` to `SessionOptions` in `types.ts`

3. **Integrate in session-manager**: Use TTL helpers in `loadSessionData()`

4. **No changes needed** to derive-lazy or derive-eager!

## Internal vs Public API

### Public (users can import)
```typescript
import { session, type SessionOptions } from "@gramio/session";
```

### Internal (only for plugin development)
```typescript
import { createProxy } from "./lib/proxy.js";
import { createSessionWithClear } from "./lib/session-manager.js";
```

**Note**: Only exports from `index.ts` are part of the public API.
