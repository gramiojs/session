import type { Storage } from "@gramio/storage";
import type { ContextType, BotLike, MaybePromise } from "gramio";
import { createProxy, getTarget } from "./proxy.js";
import type { Events } from "./types.js";

/**
 * Session manager result with session data and save function
 */
export interface SessionManager<Data> {
	/** The proxied session data */
	session: Data & { $clear: () => Promise<void> };
	/** Save function to persist changes to storage */
	save: () => Promise<void>;
	/** Check if session has unsaved changes */
	isDirty: () => boolean;
}

/**
 * Creates a session object with $clear method and dirty tracking
 * @param sessionData - Initial session data
 * @param sessionKey - Storage key for this session
 * @param storage - Storage backend
 * @param context - Bot context
 * @param getInitialData - Function to get initial data when clearing
 * @returns Session manager with save function and dirty flag
 */
export function createSessionWithClear<Data>(
	sessionData: Data,
	sessionKey: string,
	storage: Storage,
	context: ContextType<BotLike, Events>,
	getInitialData?: (
		context: ContextType<BotLike, Events>,
	) => MaybePromise<Data>,
): SessionManager<Data> {
	let session: any;
	let dirty = false;

	// Mark session as modified
	const markDirty = () => {
		dirty = true;
	};

	// Save session to storage
	const save = async () => {
		if (!dirty) return;

		const target = getTarget(session);
		// Create a clean copy without the $clear method
		const dataToStore: any = {};
		for (const key in target) {
			if (key !== "$clear") {
				dataToStore[key] = target[key];
			}
		}
		await storage.set(sessionKey, dataToStore);
		dirty = false;
	};

	// Create reactive proxy with dirty tracking
	session = createProxy(sessionData, markDirty, sessionKey);

	// Add $clear method if not already present
	if (!("$clear" in session)) {
		Object.defineProperty(session, "$clear", {
			enumerable: false,
			configurable: true,
			writable: false,
			value: async () => {
				await storage.delete(sessionKey);
				dirty = false; // Clear is an explicit action, reset dirty flag

				// Reset session to initial state
				const newData = (getInitialData && (await getInitialData(context))) ?? {};

				// Get the underlying target from the proxy
				const target = getTarget(session);

				// Clear all properties from the target
				for (const key in target) {
					delete (target as any)[key];
				}

				// Copy new data to target (bypassing proxy to avoid marking dirty)
				for (const key in newData) {
					(target as any)[key] = (newData as any)[key];
				}
			},
		});
	}

	return {
		session,
		save,
		isDirty: () => dirty,
	};
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
