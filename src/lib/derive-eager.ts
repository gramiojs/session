import type { Storage } from "@gramio/storage";
import type { ContextType, BotLike, MaybePromise } from "gramio";
import { Plugin } from "gramio";
import { createSessionWithClear, loadSessionData } from "./session-manager.js";
import { getTarget } from "./proxy.js";
import type { Events } from "./types.js";

/**
 * Creates eager session plugin (loads session immediately on each update)
 */
export function createEagerSessionPlugin<Data, Key extends string>(
	key: Key,
	storage: Storage,
	getSessionKey: (context: ContextType<BotLike, Events>) => MaybePromise<string>,
	getInitialData?: (
		context: ContextType<BotLike, Events>,
	) => MaybePromise<Data>,
) {
	const events: Events[] = [
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
	];

	return new Plugin("@gramio/session").derive(events, async (context) => {
		const obj = {} as any;

		// @ts-ignore - TODO: WE SHOULD ADD * TO GRAMIO/TYPES usage
		const sessionKey = await getSessionKey(context);

		const sessionData = await loadSessionData(
			storage,
			sessionKey,
			context,
			getInitialData,
		);

		let session = createSessionWithClear(
			sessionData,
			sessionKey,
			storage,
			context,
			getInitialData,
		);

		Object.defineProperty(obj, key, {
			enumerable: true,
			get: () => session,
			set(value) {
				// Get the target from the value being set
				const newTarget = getTarget(value);
				session = createSessionWithClear(
					newTarget,
					sessionKey,
					storage,
					context,
					getInitialData,
				);

				// Trigger update with the new value
				const target = getTarget(session);
				const dataToStore: any = {};
				for (const k in target) {
					if (k !== "$clear") {
						dataToStore[k] = target[k];
					}
				}
				storage.set(sessionKey, dataToStore);
			},
		});

		return obj;
	}) as any;
}
