import {
	type BotLike,
	type ContextType,
	type MaybePromise,
	Plugin,
} from "gramio";
import { inMemoryStorage } from "in-memory-storage";
import type { Storage } from "types";

interface SessionOptions<
	Data = unknown,
	Key extends string | undefined = "session",
> {
	key?: Key;
	schema?: Data;
	storage?: Storage;
	getSessionKey?: (
		context: ContextType<BotLike, "message">,
	) => MaybePromise<string>;
	initial?: (context: ContextType<BotLike, "message">) => MaybePromise<Data>;
}

function createProxy(value: any, storage: Storage, sessionKey: string) {
	return new Proxy(value, {
		get(target, key) {
			return target[key];
		},
		set(target, key, newValue) {
			console.log("test", target, key, newValue);

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
				console.log("get");
				return createProxy(session, storage, sessionKey);
			},
			set(value) {
				console.log("set", value);
				storage.set(sessionKey, value);
			},
		});

		return obj;
	});
}
