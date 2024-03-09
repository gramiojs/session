import { Plugin } from "gramio";

interface SessionOptions<
	Data = unknown,
	Key extends string | undefined = "session",
> {
	key?: Key;
	schema?: Data;
}

export function session<Data = unknown, Key extends string = "session">(
	options: SessionOptions<Data, Key> = {},
) {
	const key = (options.key ?? "session") as Key extends string
		? Key
		: "session";

	return new Plugin("@gramio/session").derive("message", () => {
		return { [key]: {} } as { [key in typeof key]: Data };
	});
}
