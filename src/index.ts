/**
 * @module
 *
 * Session plugin for GramIO.
 */
import { type Storage, inMemoryStorage } from "@gramio/storage";
import {
	type BotLike,
	type ContextType,
	DeriveDefinitions,
	type MaybePromise,
	Plugin,
	isPlainObject,
} from "gramio";

type Events = [
	"message",
	"callback_query",
	"channel_post",
	"chat_join_request",
	"chosen_inline_result",
	"inline_query",
	"web_app_data",
	"successful_payment",
	"video_chat_started",
	"video_chat_ended",
	"video_chat_scheduled",
	"video_chat_participants_invited",
	"passport_data",
	"new_chat_title",
	"new_chat_photo",
	"pinned_message",
	"poll_answer",
	"pre_checkout_query",
	"proximity_alert_triggered",
	"shipping_query",
	"group_chat_created",
	"delete_chat_photo",
	"location",
	"invoice",
	"message_auto_delete_timer_changed",
	"migrate_from_chat_id",
	"migrate_to_chat_id",
	"new_chat_members",
	"chat_shared"
][number];


/** Options types from {@link session} plugin */
export interface SessionOptions<
	Data = unknown,
	Key extends string | undefined = "session",
> {
	/**
	 * The key that will be added to the context
	 * @default "session"
	 * */
	key?: Key;
	/**
	 * The {@link Storage} in which to store the session
	 *
	 * [Documentation](https://gramio.dev/storages/)
	 */
	storage?: Storage;
	/**
	 * A function that allows you to specify which key will be used to identify the session in the storage
	 * @default (context) => `${context.senderId}`
	 */
	getSessionKey?: (
		context: ContextType<BotLike, Events>,
	) => MaybePromise<string>;
	/** Specify which data will exist while there has not been an record in the repository yet
	 *
	 * To **type** a session data, you need to specify the type as the `ReturnType` of the initial function.
	 *
	 * ```ts
	 * interface MySessionData {
	 *     apple: number;
	 *     some?: "maybe-empty";
	 * }
	 *
	 * bot.extend(
	 *     session({
	 *         key: "sessionKey",
	 *         initial: (): MySessionData => ({ apple: 1 }),
	 *     })
	 * );
	 * ```
	 */
	initial?: (context: ContextType<BotLike, Events>) => MaybePromise<Data>;
}

function createProxy<T>(
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	value: any,
	onUpdate: () => unknown,
	sessionKey: string,
): T {
	if (typeof value !== "object") return value;

	return new Proxy(value, {
		get(target, key) {
			const value = target[key];

			return isPlainObject(value) || Array.isArray(value)
				? createProxy(value, onUpdate, sessionKey)
				: value;
		},
		set(target, key, newValue) {
			target[key] = newValue;

			onUpdate();

			return true;
		},
	});
}

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
```
 */
export function session<Data = unknown, Key extends string = "session">(
	options: SessionOptions<Data, Key> = {},
): Plugin<
	// biome-ignore lint/complexity/noBannedTypes: Temporally fix https://jsr.io/@gramio/session/0.1.2/src/index.ts#L109 slow-types-compiler issue
	{},
	DeriveDefinitions & {
		[K in Events]: Awaited<{ [key in Key extends string ? Key : "session"]: Data }>
	}
> {
	const key = (options.key ?? "session") as Key extends string
		? Key
		: "session";
	const storage = options.storage ?? inMemoryStorage();
	const getSessionKey =
		options.getSessionKey ??
		((context: ContextType<BotLike, Events>) => `${context.senderId}`);

	return new Plugin("@gramio/session").derive(
		[
			"message",
			"callback_query",
			"channel_post",
			"chat_join_request",
			"chosen_inline_result",
			"inline_query",
			"web_app_data",
			"successful_payment",
			"video_chat_started",
			"video_chat_ended",
			"video_chat_scheduled",
			"video_chat_participants_invited",
			"passport_data",
			"new_chat_title",
			"new_chat_photo",
			"pinned_message",
			"poll_answer",
			"pre_checkout_query",
			"proximity_alert_triggered",
			"shipping_query",
			"group_chat_created",
			"delete_chat_photo",
			"location",
			"invoice",
			"message_auto_delete_timer_changed",
			"migrate_from_chat_id",
			"migrate_to_chat_id",
			"new_chat_members",
			"chat_shared"
		],
		async (context) => {
			const obj = {} as {
				[key in typeof key]: Data;
			};

			// TODO: WE SHOULD ADD * TO GRAMIO/TYPES usage
			// @ts-ignore 
			const sessionKey = await getSessionKey(context);

			const sessionData =
				(await storage.get(sessionKey)) ??
				// @ts-ignore
				(options.initial && (await options.initial(context))) ??
				{};
			const onUpdate: () => unknown = () => storage.set(sessionKey, session);

			let session = createProxy(sessionData, onUpdate, sessionKey);

			Object.defineProperty(obj, key, {
				enumerable: true,
				get: () => session,
				set(value) {
					session = createProxy(value, onUpdate, sessionKey);
				},
			});

			return obj;
		},
	);
}
