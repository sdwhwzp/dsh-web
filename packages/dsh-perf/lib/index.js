import z from "schemastery";
import { monitorEventLoopDelay } from "node:perf_hooks";
//#region src/mount-once.ts
/**
* Host single-instance guard shared by the plugin family. The family bundle
* (dsh-web-all / dsh-skins) namespaces every child row id (web-ui-*), so
* the loader accepts a standalone install of the same package side by side;
* without this guard the second instance would still re-register the same
* webserver routes, tools, settings namespaces, and system-prompt sections
* and fail the boot. mountOnce makes the second host apply a no-op for the
* lifetime of the first instance (the browser half is already deduped by
* package name in the client module host).
*
* The registry rides a global symbol so two module instances of the same
* package (npm copy vs repository link) still share one verdict. cordis
* `ctx.effect` runs its callback immediately and treats the callback's
* return value as the fiber disposer, so the unmarker is returned, not run.
*/
const MOUNTED = Symbol.for("dsh-web.mounted-plugins");
function mountedSet() {
	const registry = globalThis;
	return registry[MOUNTED] ??= /* @__PURE__ */ new Set();
}
function mountOnce(packageName, fn) {
	return ((...args) => {
		const mounted = mountedSet();
		if (mounted.has(packageName)) return;
		mounted.add(packageName);
		args[0]?.effect?.(() => () => {
			mounted.delete(packageName);
		});
		return fn(...args);
	});
}
//#endregion
//#region src/host/perf-meter.ts
var PerfMeter = class {
	ctx;
	options;
	buckets = [];
	el;
	timer;
	disposed = false;
	started = false;
	windowMs;
	lastTypeBySession = /* @__PURE__ */ new Map();
	pendingSessions = /* @__PURE__ */ new Map();
	pendingTypes = {};
	lastDelay = {
		meanMs: 0,
		p99Ms: 0,
		maxMs: 0
	};
	agentStatus = /* @__PURE__ */ new Map();
	constructor(ctx, options) {
		this.ctx = ctx;
		this.options = options;
		this.el = monitorEventLoopDelay({ resolution: 10 });
		this.windowMs = options.statsWindowSeconds * 1e3;
	}
	/** (Re)apply host-side options; cheap, safe to call on settings change. */
	applyOptions(options) {
		this.windowMs = options.statsWindowSeconds * 1e3;
		const intervalChanged = options.meterIntervalMs !== this.options.meterIntervalMs;
		const wasOff = this.options.mode === "off";
		this.options = options;
		if (wasOff && options.mode !== "off" && this.started) {
			this.el.enable();
			this.attach();
		}
		if (!wasOff && options.mode === "off" && this.started) {
			this.detach();
			this.el.disable();
		}
		if (intervalChanged && this.timer !== void 0) {
			clearInterval(this.timer);
			this.timer = setInterval(() => this.tick(), options.meterIntervalMs);
			this.timer.unref?.();
		}
	}
	start() {
		if (this.started) return;
		this.started = true;
		if (this.options.mode !== "off") {
			this.el.enable();
			this.attach();
		}
		this.timer = setInterval(() => this.tick(), this.options.meterIntervalMs);
		this.timer.unref?.();
	}
	stop() {
		if (this.disposed) return;
		this.disposed = true;
		this.detach();
		if (this.timer !== void 0) clearInterval(this.timer);
		this.el.disable();
		this.started = false;
	}
	attached = false;
	disposers = [];
	attach() {
		if (this.attached) return;
		this.attached = true;
		const ctx = this.ctx;
		const offEvent = ctx.on("session/event", (subject, event) => {
			const ev = event;
			const type = typeof ev?.type === "string" ? ev.type : "unknown";
			const id = subject?.id ?? "root";
			this.noteEvent(id, type);
		});
		if (typeof offEvent === "function") this.disposers.push(offEvent);
		const offStatus = ctx.on("agent/status", (subject, data) => {
			const d = data ?? subject;
			const status = typeof d?.status === "string" ? d.status : "unknown";
			const id = typeof d?.id === "string" ? d.id : typeof subject?.id === "string" ? subject.id : void 0;
			if (id === void 0) return;
			this.agentStatus.set(id, {
				status,
				at: Date.now()
			});
		});
		if (typeof offStatus === "function") this.disposers.push(offStatus);
	}
	detach() {
		for (const dispose of this.disposers) try {
			dispose();
		} catch {}
		this.disposers.length = 0;
		this.attached = false;
	}
	noteEvent(id, type) {
		this.pendingSessions.set(id, (this.pendingSessions.get(id) ?? 0) + 1);
		this.lastTypeBySession.set(id, type);
		this.pendingTypes[type] = (this.pendingTypes[type] ?? 0) + 1;
	}
	/** 每 tick 归档 pending 到 per-session bucket; 读取 EL 延迟并清零。 */
	tick() {
		const at = Date.now();
		if (this.pendingSessions.size > 0) {
			this.buckets.push({
				at,
				perSession: new Map(this.pendingSessions),
				types: this.pendingTypes
			});
			this.pendingSessions.clear();
			this.pendingTypes = {};
		}
		this.compactBuckets(at);
		const meanMs = this.el.mean / 1e6;
		const p99Ms = this.el.percentile(99) / 1e6;
		const maxMs = this.el.max / 1e6;
		this.el.reset();
		this.lastDelay = {
			meanMs,
			p99Ms,
			maxMs
		};
	}
	compactBuckets(at) {
		const cutoff = at - this.windowMs;
		while (this.buckets.length > 0 && this.buckets[0].at < cutoff) this.buckets.shift();
		const alive = /* @__PURE__ */ new Set();
		for (const bucket of this.buckets) for (const id of bucket.perSession.keys()) alive.add(id);
		for (const id of this.lastTypeBySession.keys()) if (!alive.has(id)) this.lastTypeBySession.delete(id);
		for (const id of this.agentStatus.keys()) if (!alive.has(id)) this.agentStatus.delete(id);
	}
	/** 窗口内聚合: 总速率 / 每会话速率 / 事件类型分布。 */
	windowAggregate() {
		const bySession = /* @__PURE__ */ new Map();
		const types = /* @__PURE__ */ new Map();
		let count = 0;
		for (const bucket of this.buckets) {
			for (const [id, n] of bucket.perSession) {
				count += n;
				bySession.set(id, (bySession.get(id) ?? 0) + n);
			}
			for (const [type, n] of Object.entries(bucket.types)) types.set(type, (types.get(type) ?? 0) + n);
		}
		const seconds = Math.max(1, this.windowMs / 1e3);
		const topSessions = [...bySession.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({
			id,
			eventsPerSec: Math.round(n / seconds * 10) / 10,
			lastType: this.lastTypeBySession.get(id) ?? "unknown",
			status: this.agentStatus.get(id)?.status
		}));
		return {
			perSec: Math.round(count / seconds * 10) / 10,
			window: count,
			activeSessions: bySession.size,
			topSessions,
			eventTypes: Object.fromEntries([...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10))
		};
	}
	snapshot() {
		const agg = this.windowAggregate();
		const mem = process.memoryUsage();
		const sessionsOver = agg.activeSessions >= this.options.maxActiveSessions;
		const eventsOver = agg.perSec >= this.options.maxEventsPerSec;
		const alert = sessionsOver || eventsOver ? {
			kind: sessionsOver && eventsOver ? "both" : sessionsOver ? "sessions" : "events",
			activeSessions: agg.activeSessions,
			eventsPerSec: agg.perSec,
			maxSessions: this.options.maxActiveSessions,
			maxEventsPerSec: this.options.maxEventsPerSec
		} : null;
		return {
			ok: true,
			ts: Date.now(),
			uptimeMs: process.uptime() * 1e3,
			mode: this.options.mode,
			meterIntervalMs: this.options.meterIntervalMs,
			batchDelayMs: this.options.batchDelayMs,
			elDelay: this.lastDelay,
			mem: {
				rssMB: Math.round(mem.rss / 1048576),
				heapUsedMB: Math.round(mem.heapUsed / 1048576)
			},
			events: {
				perSec: agg.perSec,
				window: agg.window,
				activeSessions: agg.activeSessions
			},
			topSessions: agg.topSessions,
			eventTypes: agg.eventTypes,
			alert
		};
	}
};
//#endregion
//#region src/host/loopback.ts
function isIPv4Loopback(v4) {
	const parts = v4.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function isLoopbackAddress(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
	return isIPv4Loopback(normalized);
}
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIPv4Loopback(hostname);
}
function isLoopbackRequest(request) {
	if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/host/http-util.ts
/** Write a JSON response with a stable envelope and no-store caching. */
function writeJson(res, status, body, extraHeaders = {}) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		...extraHeaders
	});
	res.end(JSON.stringify(body));
}
//#endregion
//#region src/host/routes.ts
/** Loopback-fenced stats route: aggregate metrics only, no session content. */
function makePerfStatsRoute(meter) {
	return {
		kind: "exact",
		path: "/api/dsh-perf/stats",
		handler: async (req, res) => {
			if (!isLoopbackRequest(req)) {
				writeJson(res, 403, {
					ok: false,
					error: "forbidden: loopback-only"
				});
				return;
			}
			writeJson(res, 200, meter.snapshot(), { "cache-control": "no-store" });
		}
	};
}
//#endregion
//#region src/index.ts
const name = "dsh-perf";
const inject = ["webServer"];
const PERF_SETTINGS_NAMESPACE = "dsh-perf";
const Config = z.object({
	enabled: z.boolean().default(true),
	mode: z.string().default("balanced"),
	meterIntervalMs: z.number().min(1e3).max(6e4).default(2e3),
	statsWindowSeconds: z.number().min(10).max(3600).default(120),
	alertPreset: z.string().default("standard"),
	hudEnabled: z.boolean().default(false),
	renderDegrade: z.boolean().default(true)
});
/** 告警阈值预设: 轻/标准/严格 → 会话数与事件速率。 */
const ALERT_PRESETS = {
	light: {
		sessions: 10,
		eventsPerSec: 1e3
	},
	standard: {
		sessions: 5,
		eventsPerSec: 300
	},
	strict: {
		sessions: 3,
		eventsPerSec: 150
	}
};
function resolveConfig(config) {
	return {
		enabled: config?.enabled ?? true,
		mode: config?.mode === "off" || config?.mode === "aggressive" || config?.mode === "balanced" ? config.mode : "balanced",
		meterIntervalMs: config?.meterIntervalMs ?? 2e3,
		statsWindowSeconds: config?.statsWindowSeconds ?? 120,
		...(() => {
			const preset = typeof config?.alertPreset === "string" && config.alertPreset in ALERT_PRESETS ? config.alertPreset : "standard";
			const mapped = ALERT_PRESETS[preset];
			return {
				maxActiveSessions: mapped.sessions,
				maxEventsPerSec: mapped.eventsPerSec
			};
		})(),
		hudEnabled: config?.hudEnabled ?? false,
		renderDegrade: config?.renderDegrade ?? true
	};
}
/** 由 bundle patch 应用的持久化写批延迟: 覆盖整行时写死 500ms(balanced)。 */
const BUNDLE_WRITE_BATCH_DELAY_MS = 500;
/** 尽力从运行时读取 persistence 行实际生效的 writeBatchMaxDelayMs(只读, 不修改)。 */
function readAppliedBatchDelay(ctx) {
	try {
		const config = (ctx.get?.("sessionPersistence"))?.config;
		return typeof config?.writeBatchMaxDelayMs === "number" ? config.writeBatchMaxDelayMs : void 0;
	} catch {
		return;
	}
}
const apply = mountOnce("@linxin666/dsh-perf", (ctx, config) => {
	let source = () => config ?? {};
	let meter;
	let disposeRoutes;
	const rearm = () => {
		const value = resolveConfig(source());
		if (!value.enabled) {
			meter?.stop();
			meter = void 0;
			disposeRoutes?.();
			disposeRoutes = void 0;
			return;
		}
		const options = {
			mode: value.mode,
			meterIntervalMs: value.meterIntervalMs,
			statsWindowSeconds: value.statsWindowSeconds,
			maxActiveSessions: value.maxActiveSessions,
			maxEventsPerSec: value.maxEventsPerSec,
			batchDelayMs: readAppliedBatchDelay(ctx) ?? 500
		};
		if (meter === void 0) {
			meter = new PerfMeter(ctx, options);
			meter.start();
			disposeRoutes = ctx.webServer.register(makePerfStatsRoute(meter));
		} else meter.applyOptions(options);
	};
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.installSection(ctx, PERF_SETTINGS_NAMESPACE, Config, config ?? {}, {
			setSource: (next) => {
				source = next;
				rearm();
			},
			onChange: rearm
		});
	});
	ctx.effect(() => {
		rearm();
		return () => {
			disposeRoutes?.();
			meter?.stop();
		};
	}, "dsh-perf: runtime");
});
//#endregion
export { BUNDLE_WRITE_BATCH_DELAY_MS, Config, PERF_SETTINGS_NAMESPACE, apply, inject, name, resolveConfig };
