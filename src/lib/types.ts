import type { ContextType, BotLike, MaybePromise } from "gramio";
import type { Storage } from "@gramio/storage";

/** Telegram events that support session */
export type Events = [
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
	"chat_shared",
][number];

/** Helper type: If Lazy is true, wraps Data in Promise, otherwise returns Data as-is */
export type SessionData<Data, Lazy extends boolean> = Lazy extends true
	? Promise<Data & { $clear: () => Promise<void> }>
	: Data & { $clear: () => Promise<void> };

/** Options types from {@link session} plugin */
export interface SessionOptions<
	Data = unknown,
	Key extends string | undefined = "session",
	Lazy extends boolean = false,
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
	/**
	 * Enable lazy session loading. When true, session is only loaded from storage
	 * when accessed, reducing database reads for handlers that don't use sessions.
	 *
	 * @default false
	 *
	 * @example
	 * ```ts
	 * // Lazy session - only loads if accessed
	 * bot.extend(session({ lazy: true, initial: () => ({ count: 0 }) }));
	 *
	 * bot.on("message", async (ctx) => {
	 *     const session = await ctx.session;  // Loads here
	 *     session.count++;
	 * });
	 * ```
	 */
	lazy?: Lazy;
}
