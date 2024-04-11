import { type Storage, inMemoryStorage } from "@gramio/storage";
import {
	type BotLike,
	type ContextType,
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
][number];

interface SessionOptions<
	Data = unknown,
	Key extends string | undefined = "session",
> {
	key?: Key;
	storage?: Storage;
	getSessionKey?: (
		context: ContextType<BotLike, Events>,
	) => MaybePromise<string>;
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

export function session<Data = unknown, Key extends string = "session">(
	options: SessionOptions<Data, Key> = {},
) {
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
		],
		async (context) => {
			const obj = {} as { [key in typeof key]: Data };

			const sessionKey = await getSessionKey(context);

			const sessionData =
				(await storage.get(sessionKey)) ??
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
