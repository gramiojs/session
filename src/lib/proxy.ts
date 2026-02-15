import { isPlainObject } from "gramio";

// WeakMap to cache proxies and prevent duplication
const proxyCache = new WeakMap();
const targetCache = new WeakMap();

/**
 * Creates a reactive proxy that automatically calls onUpdate when properties change
 * @param value - The object to proxy
 * @param onUpdate - Callback to trigger when data changes
 * @param sessionKey - Session identifier for debugging
 * @returns Proxied object with reactive updates
 */
export function createProxy<T>(
	// biome-ignore lint/suspicious/noExplicitAny: Required for generic proxy
	value: any,
	onUpdate: () => unknown,
	sessionKey: string,
): T {
	if (typeof value !== "object" || value === null) return value;

	// Return cached proxy if it exists
	if (proxyCache.has(value)) {
		return proxyCache.get(value);
	}

	const proxy = new Proxy(value, {
		get(target, key) {
			const val = target[key];

			return isPlainObject(val) || Array.isArray(val)
				? createProxy(val, onUpdate, sessionKey)
				: val;
		},
		set(target, key, newValue) {
			target[key] = newValue;
			onUpdate();
			return true;
		},
		deleteProperty(target, key) {
			delete target[key];
			onUpdate();
			return true;
		},
	});

	// Cache the proxy to prevent duplication
	proxyCache.set(value, proxy);
	targetCache.set(proxy, value);

	return proxy;
}

/**
 * Gets the original target object from a proxy
 * @param proxy - The proxy object
 * @returns Original target object
 */
export function getTarget<T>(proxy: T): T {
	return (targetCache.get(proxy as any) as T) ?? proxy;
}
