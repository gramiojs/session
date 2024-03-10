import type { MaybePromise } from "gramio";

export interface Storage {
	get(key: string): MaybePromise<any | undefined>;
	set(key: string, value: any): MaybePromise<void>;
	has(key: string): MaybePromise<boolean>;
	delete(key: string): MaybePromise<boolean>;
}
