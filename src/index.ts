/**
 * @module
 *
 * Session plugin for GramIO.
 */
import { inMemoryStorage } from "@gramio/storage";
import type { BotLike, ContextType } from "gramio";
import { Plugin, type DeriveDefinitions } from "gramio";
import { createEagerSessionPlugin } from "./lib/derive-eager.js";
import { createLazySessionPlugin } from "./lib/derive-lazy.js";
import type { SessionOptions, SessionData, Events } from "./lib/types.js";

// Re-export types
export type { SessionOptions, SessionData, Events };

/**
 * Session plugin
 * @example
 * ```ts
 * import { Bot } from "gramio";
 * import { session } from "@gramio/session";
 *
 * const bot = new Bot(process.env.token!)
 *     .extend(
 *         session({
 *             key: "sessionKey",
 *             initial: () => ({ apple: 1 }),
 *         })
 *     )
 *     .on("message", (context) => {
 *         context.send(`🍏 apple count is ${++context.sessionKey.apple}`);
 *     })
 *     .onStart(console.log);
 *
 * bot.start();
 * ```
 *
 * @example
 * ```ts
 * // Lazy sessions - only load when accessed
 * const bot = new Bot(process.env.token!)
 *     .extend(
 *         session({
 *             lazy: true,
 *             initial: () => ({ count: 0 }),
 *         })
 *     )
 *     .on("message", async (context) => {
 *         const session = await context.session;
 *         session.count++;
 *     });
 * ```
 */
export function session<
	Data = unknown,
	Key extends string = "session",
	Lazy extends boolean = false,
>(
	options: SessionOptions<Data, Key, Lazy> = {},
): Plugin<
	// biome-ignore lint/complexity/noBannedTypes: Temporally fix https://jsr.io/@gramio/session/0.1.2/src/index.ts#L109 slow-types-compiler issue
	{},
	DeriveDefinitions & {
		[K in Events]: Awaited<{
			[key in Key extends string ? Key : "session"]: SessionData<Data, Lazy>
		}>
	}
> {
	const key = (options.key ?? "session") as Key extends string
		? Key
		: "session";
	const storage = options.storage ?? inMemoryStorage();
	const getSessionKey =
		options.getSessionKey ??
		((context: ContextType<BotLike, Events>) => `${context.senderId}`);

	// Return lazy or eager plugin based on options
	if (options.lazy) {
		return createLazySessionPlugin(
			key,
			storage,
			getSessionKey,
			options.initial,
		);
	}

	return createEagerSessionPlugin(key, storage, getSessionKey, options.initial);
}
