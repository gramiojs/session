import { describe, expect, it } from "bun:test";
import { Bot } from "gramio";
import { TelegramTestEnvironment } from "@gramio/test";
import { session } from "./index.js";
import type { Storage } from "@gramio/storage";
import { inMemoryStorage } from "@gramio/storage";

interface TestSession {
	counter: number;
	nested: {
		value: string;
		deep: {
			count: number;
		};
	};
	items: string[];
}

describe("@gramio/session", () => {
	describe("Basic functionality", () => {
		it("should initialize session with initial data", async () => {
			const bot = new Bot("test").extend(
				session({
					initial: (): TestSession => ({
						counter: 0,
						nested: { value: "test", deep: { count: 0 } },
						items: [],
					}),
				}),
			);

			let sessionData: TestSession | undefined;

			bot.on("message", (ctx) => {
				sessionData = ctx.session;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser();

			await user.sendMessage("test");

			expect(sessionData).toBeDefined();
			expect(sessionData?.counter).toBe(0);
			expect(sessionData?.nested.value).toBe("test");
			expect(sessionData?.items).toEqual([]);
		});

		it("should persist session data across messages", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: (): TestSession => ({
						counter: 0,
						nested: { value: "test", deep: { count: 0 } },
						items: [],
					}),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.counter++;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("first");
			await user.sendMessage("second");
			await user.sendMessage("third");

			// Check storage directly
			const storedSession = await storage.get("123");
			expect(storedSession?.counter).toBe(3);
		});

		it("should use custom session key", async () => {
			const bot = new Bot("test").extend(
				session({
					key: "mySession",
					initial: () => ({ value: 42 }),
				}),
			);

			let hasCustomKey = false;
			let hasDefaultKey = false;

			bot.on("message", (ctx) => {
				hasCustomKey = (ctx as any).mySession !== undefined;
				hasDefaultKey = (ctx as any).session !== undefined;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser();

			await user.sendMessage("test");

			expect(hasCustomKey).toBe(true);
			expect(hasDefaultKey).toBe(false);
		});

		it("should separate sessions by senderId", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: () => ({ counter: 0 }),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.counter++;
			});

			const env = new TelegramTestEnvironment(bot);
			const user1 = env.createUser({ id: 123 });
			const user2 = env.createUser({ id: 456 });

			await user1.sendMessage("user1 msg1");
			await user2.sendMessage("user2 msg1");
			await user1.sendMessage("user1 msg2");
			await user2.sendMessage("user2 msg2");

			// Check storage directly
			const sessionData1 = await storage.get("123");
			const sessionData2 = await storage.get("456");

			expect(sessionData1.counter).toBe(2);
			expect(sessionData2.counter).toBe(2);
		});
	});

	describe("Nested object and array modifications", () => {
		it("should handle nested object modifications", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: (): TestSession => ({
						counter: 0,
						nested: { value: "test", deep: { count: 0 } },
						items: [],
					}),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.nested.value = "updated";
				ctx.session.nested.deep.count++;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("first");
			await user.sendMessage("second");

			const sessionData = await storage.get("123");

			expect(sessionData.nested.value).toBe("updated");
			expect(sessionData.nested.deep.count).toBe(2);
		});

		it("should handle array modifications", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: (): TestSession => ({
						counter: 0,
						nested: { value: "test", deep: { count: 0 } },
						items: [],
					}),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.items.push("item");
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("first");
			await user.sendMessage("second");

			const sessionData = await storage.get("123");

			expect(sessionData.items).toEqual(["item", "item"]);
		});

		it("should handle nested array modifications", async () => {
			interface NestedArraySession {
				matrix: number[][];
			}

			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: (): NestedArraySession => ({
						matrix: [[1, 2], [3, 4]],
					}),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.matrix[0][0] = 99;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("first");
			await user.sendMessage("second");

			const sessionData = await storage.get("123");

			expect(sessionData.matrix[0][0]).toBe(99);
		});
	});

	describe("Property deletion", () => {
		it("should handle property deletion", async () => {
			interface DeletableSession {
				keep: string;
				remove?: string;
			}

			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: (): DeletableSession => ({
						keep: "value",
						remove: "toDelete",
					}),
				}),
			);

			bot.on("message", (ctx) => {
				delete ctx.session.remove;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("first");
			await user.sendMessage("second");

			const sessionData = await storage.get("123");

			expect(sessionData.keep).toBe("value");
			expect(sessionData.remove).toBeUndefined();
		});

		it("should handle nested property deletion", async () => {
			interface NestedDeletable {
				data: {
					keep: string;
					remove?: string;
				};
			}

			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: (): NestedDeletable => ({
						data: {
							keep: "value",
							remove: "toDelete",
						},
					}),
				}),
			);

			bot.on("message", (ctx) => {
				delete ctx.session.data.remove;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("first");
			await user.sendMessage("second");

			const sessionData = await storage.get("123");

			expect(sessionData.data.keep).toBe("value");
			expect(sessionData.data.remove).toBeUndefined();
		});
	});

	describe("Session clearing ($clear)", () => {
		it("should clear session data", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: (): TestSession => ({
						counter: 0,
						nested: { value: "test", deep: { count: 0 } },
						items: [],
					}),
				}),
			);

			bot.on("message", async (ctx) => {
				if (ctx.text === "clear") {
					await ctx.session.$clear();
				} else {
					ctx.session.counter++;
				}
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("increment");
			await user.sendMessage("increment");

			let sessionData = await storage.get("123");
			expect(sessionData.counter).toBe(2);

			await user.sendMessage("clear");

			sessionData = await storage.get("123");
			expect(sessionData).toBeUndefined(); // Session should be deleted from storage

			await user.sendMessage("increment");

			sessionData = await storage.get("123");
			expect(sessionData.counter).toBe(1); // Should start fresh
		});

		it("should reset to initial state after clear", async () => {
			const storage = inMemoryStorage();
			let capturedSession: TestSession | undefined;

			const bot = new Bot("test").extend(
				session({
					storage,
					initial: (): TestSession => ({
						counter: 100,
						nested: { value: "initial", deep: { count: 50 } },
						items: ["initial"],
					}),
				}),
			);

			bot.on("message", async (ctx) => {
				if (ctx.text === "clear") {
					await ctx.session.$clear();
				} else if (ctx.text === "check") {
					// Just capture the session without modifying
					capturedSession = { ...ctx.session };
				} else {
					ctx.session.counter = 999;
					ctx.session.nested.value = "modified";
					ctx.session.items = ["modified"];
				}
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("modify");

			let sessionData = await storage.get("123");
			expect(sessionData.counter).toBe(999);
			expect(sessionData.nested.value).toBe("modified");

			await user.sendMessage("clear");

			sessionData = await storage.get("123");
			expect(sessionData).toBeUndefined();

			// After clear, next message should have initial values
			await user.sendMessage("check");

			expect(capturedSession?.counter).toBe(100);
			expect(capturedSession?.nested.value).toBe("initial");
			expect(capturedSession?.items).toEqual(["initial"]);
		});
	});

	describe("Custom storage", () => {
		it("should work with custom storage", async () => {
			const dataMap = new Map<string, any>();
			const customStorage: Storage = {
				async get(key: string) {
					return dataMap.get(key);
				},
				async set(key: string, value: any) {
					dataMap.set(key, value);
				},
				async has(key: string) {
					return dataMap.has(key);
				},
				async delete(key: string) {
					dataMap.delete(key);
					return true;
				},
			};

			const bot = new Bot("test").extend(
				session({
					storage: customStorage,
					initial: () => ({ counter: 0 }),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.counter++;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("first");

			// Verify data is in custom storage
			const storedData = await customStorage.get("123");
			expect(storedData.counter).toBe(1);

			await user.sendMessage("second");

			const storedData2 = await customStorage.get("123");
			expect(storedData2.counter).toBe(2);
		});

		it("should use custom getSessionKey", async () => {
			const dataMap = new Map<string, any>();
			const customStorage: Storage = {
				async get(key: string) {
					return dataMap.get(key);
				},
				async set(key: string, value: any) {
					dataMap.set(key, value);
				},
				async has(key: string) {
					return dataMap.has(key);
				},
				async delete(key: string) {
					dataMap.delete(key);
					return true;
				},
			};

			const bot = new Bot("test").extend(
				session({
					storage: customStorage,
					getSessionKey: (ctx: any) => `custom:${ctx.senderId}`,
					initial: () => ({ counter: 0 }),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.counter++;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("test");

			// Verify custom key is used
			const storedData = await customStorage.get("custom:123");
			expect(storedData.counter).toBe(1);
		});
	});

	describe("Proxy caching (memory leak prevention)", () => {
		it("should reuse proxies for the same object", async () => {
			const bot = new Bot("test").extend(
				session({
					initial: (): TestSession => ({
						counter: 0,
						nested: { value: "test", deep: { count: 0 } },
						items: [],
					}),
				}),
			);

			bot.on("message", (ctx) => {
				// Access nested object multiple times
				const ref1 = ctx.session.nested;
				const ref2 = ctx.session.nested;
				const ref3 = ctx.session.nested;

				// All references should be the same proxy
				expect(ref1 === ref2).toBe(true);
				expect(ref2 === ref3).toBe(true);
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser();

			await user.sendMessage("test");
		});

		it("should handle deeply nested proxy caching", async () => {
			const bot = new Bot("test").extend(
				session({
					initial: (): TestSession => ({
						counter: 0,
						nested: { value: "test", deep: { count: 0 } },
						items: [],
					}),
				}),
			);

			bot.on("message", (ctx) => {
				// Access deeply nested object multiple times
				const deep1 = ctx.session.nested.deep;
				const deep2 = ctx.session.nested.deep;

				// Should be the same proxy
				expect(deep1 === deep2).toBe(true);
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser();

			await user.sendMessage("test");
		});
	});

	describe("Edge cases", () => {
		it("should handle null values", async () => {
			interface NullableSession {
				value: string | null;
			}

			const bot = new Bot("test").extend(
				session({
					initial: (): NullableSession => ({ value: null }),
				}),
			);

			let sessionValue: string | null | undefined;

			bot.on("message", (ctx) => {
				if (ctx.text === "set") {
					ctx.session.value = "not null";
				}
				sessionValue = ctx.session.value;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("check");
			expect(sessionValue).toBeNull();

			await user.sendMessage("set");
			expect(sessionValue).toBe("not null");
		});

		it("should handle empty initial state", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(session({ storage }));

			bot.on("message", (ctx) => {
				(ctx.session as any).dynamic = "value";
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("test");

			const sessionData = await storage.get("123");

			expect(sessionData.dynamic).toBe("value");
		});

		it("should handle modifying all session properties", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: () => ({ counter: 0, name: "test" }),
				}),
			);

			bot.on("message", (ctx) => {
				if (ctx.text === "reset") {
					// Manually reset all properties
					ctx.session.counter = 100;
					ctx.session.name = "reset";
				} else {
					ctx.session.counter++;
				}
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("increment");

			let sessionData = await storage.get("123");
			expect(sessionData.counter).toBe(1);

			await user.sendMessage("reset");

			sessionData = await storage.get("123");
			expect(sessionData.counter).toBe(100);
			expect(sessionData.name).toBe("reset");

			await user.sendMessage("increment");

			sessionData = await storage.get("123");
			expect(sessionData.counter).toBe(101);
		});
	});

	describe("Different event types", () => {
		it("should work with callback_query events", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: () => ({ counter: 0 }),
				}),
			);

			bot.on("callback_query", (ctx) => {
				ctx.session.counter++;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			// Send message first to have a message to click on
			const msg = await user.sendMessage("test");
			await user.click("button1", msg);
			await user.click("button2", msg);

			const sessionData = await storage.get("123");

			expect(sessionData.counter).toBe(2);
		});
	});

	describe("Sequential updates (realistic Telegram behavior)", () => {
		it("should handle sequential updates from the same user", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: () => ({ counter: 0 }),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.counter++;
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			// Telegram processes updates sequentially per bot
			await user.sendMessage("msg1");
			await user.sendMessage("msg2");
			await user.sendMessage("msg3");
			await user.sendMessage("msg4");
			await user.sendMessage("msg5");

			const sessionData = await storage.get("123");

			// All updates should be persisted
			expect(sessionData.counter).toBe(5);
		});

		it("should handle sequential nested object modifications", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: () => ({ items: [] as string[] }),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.items.push(ctx.text || "item");
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			await user.sendMessage("item1");
			await user.sendMessage("item2");
			await user.sendMessage("item3");

			const sessionData = await storage.get("123");

			expect(sessionData.items).toHaveLength(3);
			expect(sessionData.items).toEqual(["item1", "item2", "item3"]);
		});

		it("should maintain independent sessions for different users", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: () => ({ counter: 0 }),
				}),
			);

			bot.on("message", (ctx) => {
				ctx.session.counter++;
			});

			const env = new TelegramTestEnvironment(bot);
			const user1 = env.createUser({ id: 123 });
			const user2 = env.createUser({ id: 456 });
			const user3 = env.createUser({ id: 789 });

			// Interleaved messages from different users
			await user1.sendMessage("msg1");
			await user2.sendMessage("msg2");
			await user3.sendMessage("msg3");
			await user1.sendMessage("msg4");
			await user2.sendMessage("msg5");
			await user3.sendMessage("msg6");

			const sessionData1 = await storage.get("123");
			const sessionData2 = await storage.get("456");
			const sessionData3 = await storage.get("789");

			// Each user's session is independent
			expect(sessionData1.counter).toBe(2);
			expect(sessionData2.counter).toBe(2);
			expect(sessionData3.counter).toBe(2);
		});

		it("should handle rapid clear and update operations", async () => {
			const storage = inMemoryStorage();
			const bot = new Bot("test").extend(
				session({
					storage,
					initial: () => ({ counter: 0 }),
				}),
			);

			bot.on("message", async (ctx) => {
				if (ctx.text === "clear") {
					await ctx.session.$clear();
				} else {
					ctx.session.counter++;
				}
			});

			const env = new TelegramTestEnvironment(bot);
			const user = env.createUser({ id: 123 });

			// Increment, then clear, then increment again rapidly
			await user.sendMessage("inc1");
			await user.sendMessage("inc2");
			await user.sendMessage("clear");
			await user.sendMessage("inc3");

			const sessionData = await storage.get("123");

			// After clear, counter should restart from 0
			expect(sessionData.counter).toBe(1);
		});
	});
});
