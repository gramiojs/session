import type { Storage } from "@gramio/storage";
import type { ContextType, BotLike, MaybePromise } from "gramio";
import { createProxy, getTarget } from "./proxy.js";
import type { Events } from "./types.js";

/**
 * Creates a session object with $clear method and reactive updates
 * @param sessionData - Initial session data
 * @param sessionKey - Storage key for this session
 * @param storage - Storage backend
 * @param context - Bot context
 * @param getInitialData - Function to get initial data when clearing
 * @returns Proxied session with $clear method
 */
export function createSessionWithClear<Data>(
	sessionData: Data,
	sessionKey: string,
	storage: Storage,
	context: ContextType<BotLike, Events>,
	getInitialData?: (
		context: ContextType<BotLike, Events>,
	) => MaybePromise<Data>,
) {
	let session: any;

	// Update handler - saves to storage
	const onUpdate: () => unknown = () => {
		const target = getTarget(session);
		// Create a clean copy without the $clear method
		const dataToStore: any = {};
		for (const key in target) {
			if (key !== "$clear") {
				dataToStore[key] = target[key];
			}
		}
		storage.set(sessionKey, dataToStore);
	};

	// Create reactive proxy
	session = createProxy(sessionData, onUpdate, sessionKey);

	// Add $clear method if not already present
	if (!("$clear" in session)) {
		Object.defineProperty(session, "$clear", {
			enumerable: false,
			configurable: true,
			writable: false,
			value: async () => {
				await storage.delete(sessionKey);
				// Reset session to initial state without triggering onUpdate
				const newData = (getInitialData && (await getInitialData(context))) ?? {};

				// Get the underlying target from the proxy
				const target = getTarget(session);

				// Clear all properties from the target
				for (const key in target) {
					delete (target as any)[key];
				}

				// Copy new data to target (bypassing proxy)
				for (const key in newData) {
					(target as any)[key] = (newData as any)[key];
				}
			},
		});
	}

	return session;
}

/**
 * Loads session data from storage or creates initial data
 * @param storage - Storage backend
 * @param sessionKey - Storage key
 * @param context - Bot context
 * @param getInitialData - Function to get initial data
 * @returns Session data
 */
export async function loadSessionData<Data>(
	storage: Storage,
	sessionKey: string,
	context: ContextType<BotLike, Events>,
	getInitialData?: (
		context: ContextType<BotLike, Events>,
	) => MaybePromise<Data>,
): Promise<Data> {
	return (
		(await storage.get(sessionKey)) ??
		(getInitialData && (await getInitialData(context))) ??
		{}
	);
}
