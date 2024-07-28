# @gramio/session

[![npm](https://img.shields.io/npm/v/@gramio/session?logo=npm&style=flat&labelColor=000&color=3b82f6)](https://www.npmjs.org/package/@gramio/session)
[![JSR](https://jsr.io/badges/@gramio/session)](https://jsr.io/@gramio/session)
[![JSR Score](https://jsr.io/badges/@gramio/session/score)](https://jsr.io/@gramio/session)

Session plugin for GramIO.

**!!!Currently not optimized and WIP!!!**

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

### TypeScript

To **type** a session data, you need to specify the type as the `ReturnType` of the initial function.

```ts
interface MySessionData {
    apple: number;
    some?: "maybe-empty";
}

bot.extend(
    session({
        key: "sessionKey",
        initial: (): MySessionData => ({ apple: 1 }),
    })
);
```
