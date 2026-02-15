# @gramio/session

[![npm](https://img.shields.io/npm/v/@gramio/session?logo=npm&style=flat&labelColor=000&color=3b82f6)](https://www.npmjs.org/package/@gramio/session)
[![npm downloads](https://img.shields.io/npm/dw/@gramio/session?logo=npm&style=flat&labelColor=000&color=3b82f6)](https://www.npmjs.org/package/@gramio/session)
[![JSR](https://jsr.io/badges/@gramio/session)](https://jsr.io/@gramio/session)
[![JSR Score](https://jsr.io/badges/@gramio/session/score)](https://jsr.io/@gramio/session)

Session plugin for GramIO.

## Usage

```ts
import { Bot } from "gramio";
import { session } from "@gramio/session";

const bot = new Bot(process.env.token!)
    .extend(
        session({
            key: "sessionKey",
            initial: () => ({ apple: 1 }),
        })
    )
    .on("message", (context) => {
        context.send(`🍏 apple count is ${++context.sessionKey.apple}`);
    })
    .onStart(console.log);

bot.start();
```

You can use this plugin with any storage ([Read more](https://gramio.dev/storages/))

### Redis example

[More info](https://github.com/gramiojs/storages/tree/master/packages/redis)

```ts
import { Bot } from "gramio";
import { session } from "@gramio/session";
import { redisStorage } from "@gramio/storage-redis";

const bot = new Bot(process.env.token!)
    .extend(
        session({
            key: "sessionKey",
            initial: () => ({ apple: 1 }),
            storage: redisStorage(),
        })
    )
    .on("message", (context) => {
        context.send(`🍏 apple count is ${++context.sessionKey.apple}`);
    })
    .onStart(console.log);

bot.start();
```

### Lazy Sessions (v0.1.7+)

**Reduce database reads by 50-90%** with lazy session loading:

```ts
// Eager mode (default) - ALWAYS loads session
bot.extend(session({ initial: () => ({ count: 0 }) }));
bot.on("message", (ctx) => {
    ctx.session.count++;  // Session already loaded
});

// Lazy mode - ONLY loads when accessed
bot.extend(session({
    lazy: true,  // 🚀 Enable lazy loading
    initial: () => ({ count: 0 })
}));
bot.on("message", async (ctx) => {
    // Session NOT loaded yet ✅
    await ctx.send("Hello!");  // No database read!
});
bot.on("message", async (ctx) => {
    const session = await ctx.session;  // Loads HERE
    session.count++;
});
```

**When to use lazy sessions:**
- ✅ Many handlers that don't need session
- ✅ High traffic bots (reduce costs)
- ✅ Performance-critical applications

## Session Clearing

Clear session data and reset to initial state:

```ts
bot.on("message", async (ctx) => {
    if (ctx.text === "/reset") {
        await ctx.session.$clear();  // Deletes from storage
    }
});
```

## TypeScript

Session data is automatically typed from the `initial` function:

```ts
interface MySessionData {
    apple: number;
    some?: "maybe-empty";
}

// Eager mode
bot.extend(
    session({
        key: "sessionKey",
        initial: (): MySessionData => ({ apple: 1 }),
    })
);
// ctx.sessionKey is MySessionData & { $clear: () => Promise<void> }

// Lazy mode
bot.extend(
    session({
        key: "sessionKey",
        lazy: true,
        initial: (): MySessionData => ({ apple: 1 }),
    })
);
// ctx.sessionKey is Promise<MySessionData & { $clear: () => Promise<void> }>
```

## Custom Session Keys

By default, sessions are stored per-user (`senderId`). Customize with `getSessionKey`:

```ts
session({
    // Per-chat storage
    getSessionKey: (ctx) => `chat:${ctx.chatId}`,
    initial: () => ({ topic: "" }),
})

// Per-user-per-chat
session({
    getSessionKey: (ctx) => `${ctx.senderId}:${ctx.chatId}`,
    initial: () => ({ preferences: {} }),
})
```