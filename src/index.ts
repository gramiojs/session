import { type Storage, inMemoryStorage } from "@gramio/storage";
import {
	type BotLike,
	type ContextType,
	type MaybePromise,
	Plugin,
} from "gramio";

interface SessionOptions<
	Data = unknown,
	Key extends string | undefined = "session",
> {
	key?: Key;
	storage?: Storage;
	getSessionKey?: (
		context: ContextType<BotLike, "message">,
	) => MaybePromise<string>;
	initial?: (context: ContextType<BotLike, "message">) => MaybePromise<Data>;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function createProxy(value: any, storage: Storage, sessionKey: string) {
	return new Proxy(value, {
		get(target, key) {
			return target[key];
		},
		set(target, key, newValue) {
			target[key] = newValue;

			storage.set(sessionKey, target);
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
		((context: ContextType<BotLike, "message">) => `${context.senderId}`);

	return new Plugin("@gramio/session").derive("message", async (context) => {
		const obj = {} as { [key in typeof key]: Data };

		const sessionKey = await getSessionKey(context);

		const session =
			(await storage.get(sessionKey)) ??
			(options.initial && (await options.initial(context))) ??
			{};

		Object.defineProperty(obj, key, {
			enumerable: true,
			get() {
				return createProxy(session, storage, sessionKey);
			},
			set(value) {
				// TODO: optimize it
				storage.set(sessionKey, value);
			},
		});

		return obj;
	});
}
