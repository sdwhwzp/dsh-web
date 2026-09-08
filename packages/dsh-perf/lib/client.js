window.__ModuleLoader__.load({
	id: "@linxin666/dsh-perf",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/perf-locales.ts
		/**
		* The dsh-perf plugin settings card dictionaries.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"settings.title": "性能引擎",
			"settings.description": "流式/多会话场景的性能引擎：指标监测、写批频控、告警阈值与渲染降载。",
			"settings.enabled": "启用性能观测",
			"settings.enabledHint": "关闭后 host 停止订阅事件与采样（HUD 随之无数据）。",
			"settings.mode": "模式",
			"settings.modeHint": "观测与采样档位：off（仅路由）/ balanced（默认）/ aggressive。写批延迟由 bundle patch 声明为 500ms。",
			"settings.modeOff": "关闭",
			"settings.modeBalanced": "均衡",
			"settings.modeAggressive": "激进",
			"settings.renderDegrade": "消息渲染降载",
			"settings.renderDegradeHint": "会话列表的纯投影刷新(token 计数等)合并降至约 1Hz，可见字段变化仍立即发布；开启后消息行附带 content-visibility 屏外降载。",
			"settings.alertPreset": "告警阈值",
			"settings.alertPresetHint": "轻（10 会话 / 1000 ev·s⁻¹）/ 标准（5 / 300）/ 严格（3 / 150）。",
			"settings.alertPresetLight": "减轻",
			"settings.alertPresetStandard": "标准",
			"settings.alertPresetStrict": "严格",
			"settings.hudEnabled": "HUD 检测面板",
			"settings.hudEnabledHint": "右下角性能浮窗（events/s、事件循环延迟、FPS 等）。默认关闭，需要时打开。",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.overridden": "已覆盖",
			"settings.reset": "恢复默认",
			"settings.notExposed": "当前 DSH 版本未向配置页暴露本插件的设置命名空间。请直接编辑 ~/.dsh/settings.yaml，或联系管理员开放 Host 设置白名单后重启。",
			"settings.readOnly": "此部署的设置只读。",
			"settings.expand": "显示设置",
			"settings.collapse": "收起设置",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.discard": "放弃",
			"settings.unsaved": "未保存",
			"settings.saveFailed": "部署未接受这些值，已保留待修正。",
			"settings.invalidNumber": "请输入数字，或留空使用默认值。",
			"hud.alert.sessions": "会话 {count} 个 ≥ 阈值 {max}",
			"hud.alert.events": "事件 {count}/s ≥ 阈值 {max}",
			"hud.alert.both": "会话与事件均超阈值"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"settings.title": "Performance engine",
			"settings.description": "Performance engine for streaming and multi-session loads: metrics, write-batch pacing, alert thresholds and render throttling.",
			"settings.enabled": "Enable performance monitoring",
			"settings.enabledHint": "Off: the host stops subscribing and sampling (the HUD goes empty).",
			"settings.mode": "Mode",
			"settings.modeHint": "Monitoring tier: off (routes only) / balanced (default) / aggressive. Write-batch delay is declared at 500ms by the bundle patch.",
			"settings.modeOff": "Off",
			"settings.modeBalanced": "Balanced",
			"settings.modeAggressive": "Aggressive",
			"settings.renderDegrade": "Message render degrade",
			"settings.renderDegradeHint": "Projection-only session-list publishes (token counters etc.) coalesce to ~1Hz while visible-field changes still publish immediately; message rows keep the content-visibility off-screen degrade while on.",
			"settings.alertPreset": "Alert threshold",
			"settings.alertPresetHint": "Light (10 sessions / 1000 ev/s) / Standard (5 / 300) / Strict (3 / 150).",
			"settings.alertPresetLight": "Light",
			"settings.alertPresetStandard": "Standard",
			"settings.alertPresetStrict": "Strict",
			"settings.hudEnabled": "HUD panel",
			"settings.hudEnabledHint": "The floating bottom-right performance panel (events/s, event-loop delay, FPS...). Off by default; enable when needed.",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.overridden": "Overridden",
			"settings.reset": "Reset to default",
			"settings.notExposed": "This DSH version does not expose this plugin's settings namespace to the configuration page, so the form is unavailable. Edit ~/.dsh/settings.yaml directly, or ask the administrator to open the Host settings allowlist and restart.",
			"settings.readOnly": "This deployment stores settings read-only.",
			"settings.expand": "Show settings",
			"settings.collapse": "Hide settings",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.discard": "Discard",
			"settings.unsaved": "Unsaved",
			"settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
			"settings.invalidNumber": "Enter a number, or leave blank to use the default.",
			"hud.alert.sessions": "Sessions {count} ≥ threshold {max}",
			"hud.alert.events": "Events {count}/s ≥ threshold {max}",
			"hud.alert.both": "Both sessions and events over threshold"
		};
		//#endregion
		//#region src/client/perf-alert.ts
		/**
		* One readable alert reason line for the HUD, or undefined when there is
		* no alert. Undefined numbers degrade to '?' exactly like the other HUD fields.
		* @param alert - the stats wire alert block.
		* @param t - the dsh-perf translate seat (reads the active locale at call time).
		* @returns the formatted reason, or undefined without an alert.
		*/
		function hudAlertReason(alert, t) {
			if (alert === null || alert === void 0) return void 0;
			if (alert.kind === "sessions") return t("hud.alert.sessions", {
				count: alert.activeSessions ?? "?",
				max: alert.maxSessions ?? "?"
			});
			if (alert.kind === "events") return t("hud.alert.events", {
				count: alert.eventsPerSec ?? "?",
				max: alert.maxEventsPerSec ?? "?"
			});
			return t("hud.alert.both");
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-perf/src/client/settings-card.module.css.mjs
		const css = ".etjnXG_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.etjnXG_card:hover{border-color:var(--dsw-alias-label-dimmed)}.etjnXG_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.etjnXG_header{appearance:none;box-sizing:border-box;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.etjnXG_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.etjnXG_headerStatic{box-sizing:border-box;border-radius:12px;align-items:center;gap:12px;width:100%;padding:14px 16px;display:flex}.etjnXG_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.etjnXG_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.etjnXG_description{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5}.etjnXG_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.etjnXG_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.etjnXG_chevronOpen{transform:rotate(180deg)}.etjnXG_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.etjnXG_readOnly{color:var(--dsw-alias-label-secondary);margin:12px 0 0;font-size:12px;line-height:1.5}.etjnXG_notExposed{color:var(--dsw-alias-state-warn-primary);margin:12px 0 0;font-size:12px;line-height:1.5}.etjnXG_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.etjnXG_failed{min-width:0;color:var(--dsw-alias-state-error-primary,#b42318);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.etjnXG_discard,.etjnXG_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.etjnXG_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.etjnXG_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.etjnXG_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.etjnXG_discard:disabled,.etjnXG_save:disabled{opacity:.4;cursor:default}.etjnXG_discard:focus-visible,.etjnXG_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.etjnXG_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.etjnXG_field+.etjnXG_field{border-top:1px solid var(--dsw-alias-border-l2)}.etjnXG_head{align-items:center;gap:8px;display:flex}.etjnXG_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.etjnXG_badges{align-items:center;gap:8px;display:inline-flex}.etjnXG_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.etjnXG_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.etjnXG_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.etjnXG_reset:disabled{cursor:default}.etjnXG_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.etjnXG_input,.etjnXG_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.etjnXG_input:focus-visible,.etjnXG_select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.etjnXG_input:disabled,.etjnXG_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.etjnXG_inputInvalid{border:1px solid var(--dsw-alias-state-error-primary,#b42318);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.etjnXG_inputInvalid:focus-visible{outline:2px solid var(--dsw-alias-state-error-primary,#b42318);outline-offset:1px;border-color:var(--dsw-alias-state-error-primary,#b42318)}.etjnXG_selectWrap{position:relative}.etjnXG_selectButton{appearance:none;text-align:left;cursor:pointer;justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.etjnXG_selectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.etjnXG_selectChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.etjnXG_selectChevronOpen{transform:rotate(180deg)}.etjnXG_selectPopup{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-height:240px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2);opacity:0;border-radius:8px;flex-direction:column;padding:4px;transition:opacity .1s,transform .1s;display:flex;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow-y:auto;transform:translateY(-4px)}.etjnXG_selectPopupOpen{opacity:1;transform:none}.etjnXG_selectPopupClose{opacity:0;pointer-events:none;transform:translateY(-4px)}.etjnXG_selectOption{color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex-shrink:0;padding:6px 10px;font-size:13px;line-height:1.5;overflow:hidden}.etjnXG_selectOption:hover,.etjnXG_selectOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.etjnXG_selectOptionSelected{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);font-weight:500}.etjnXG_invalid{color:var(--dsw-alias-state-error-primary,#b42318);margin:0;font-size:12px;line-height:1.5}.etjnXG_hint{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:1.5}@media (prefers-reduced-motion:reduce){.etjnXG_card,.etjnXG_header,.etjnXG_chevron,.etjnXG_chevronOpen,.etjnXG_discard,.etjnXG_save,.etjnXG_selectChevron,.etjnXG_selectChevronOpen,.etjnXG_selectPopup{transition:none}}";
		const tagId = "@linxin666/dsh-perf/packages/dsh-perf/src/client/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-perf";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "etjnXG_badge",
			"badges": "etjnXG_badges",
			"body": "etjnXG_body",
			"card": "etjnXG_card",
			"cardOpen": "etjnXG_cardOpen",
			"chevron": "etjnXG_chevron",
			"chevronOpen": "etjnXG_chevronOpen",
			"description": "etjnXG_description",
			"discard": "etjnXG_discard",
			"failed": "etjnXG_failed",
			"field": "etjnXG_field",
			"footer": "etjnXG_footer",
			"head": "etjnXG_head",
			"headText": "etjnXG_headText",
			"header": "etjnXG_header",
			"headerStatic": "etjnXG_headerStatic",
			"hint": "etjnXG_hint",
			"input": "etjnXG_input",
			"inputInvalid": "etjnXG_inputInvalid",
			"invalid": "etjnXG_invalid",
			"label": "etjnXG_label",
			"name": "etjnXG_name",
			"notExposed": "etjnXG_notExposed",
			"pending": "etjnXG_pending",
			"readOnly": "etjnXG_readOnly",
			"reset": "etjnXG_reset",
			"save": "etjnXG_save",
			"select": "etjnXG_select",
			"selectButton": "etjnXG_selectButton",
			"selectChevron": "etjnXG_selectChevron",
			"selectChevronOpen": "etjnXG_selectChevronOpen",
			"selectLabel": "etjnXG_selectLabel",
			"selectOption": "etjnXG_selectOption",
			"selectOptionActive": "etjnXG_selectOptionActive",
			"selectOptionSelected": "etjnXG_selectOptionSelected",
			"selectPopup": "etjnXG_selectPopup",
			"selectPopupClose": "etjnXG_selectPopupClose",
			"selectPopupOpen": "etjnXG_selectPopupOpen",
			"selectWrap": "etjnXG_selectWrap"
		};
		//#endregion
		//#region src/client/plugin-settings-card.tsx
		/**
		* Family-shared chrome for plugin settings cards: a disclosure header naming
		* the plugin and what its settings govern, the controls inside, and the save
		* that writes them. Renders nothing while the namespace is unavailable — a
		* deployment that does not compose the owning plugin should show no trace of
		* it. Inlined into each consumer's client bundle; mirrors the official
		* ui-plugin-config PluginCard in a self-contained slice.
		*/
		/**
		* Render one plugin settings card.
		* @param props - the plugin's copy keys, its form state, and its controls.
		* @returns the card, or nothing while the namespace is still loading.
		*/
		function PluginSettingsCard(props) {
			const [open, setOpen] = (0, react.useState)(props.defaultOpen ?? true);
			const { state, alwaysOpen } = props;
			if (!state.available) return null;
			const title = props.t(props.titleKey);
			const description = props.t(props.descriptionKey);
			const blocked = !state.dirty || state.invalid || state.saving;
			const expanded = alwaysOpen === true || open;
			const cardClass = expanded ? `${settings_card_module_css_default.cardOpen} ${settings_card_module_css_default.card}` : settings_card_module_css_default.card;
			const header = alwaysOpen === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.headerStatic,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: settings_card_module_css_default.headText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.name,
						title,
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.description,
						title: description,
						children: props.descriptionNode ?? description
					})]
				}), state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: settings_card_module_css_default.pending,
					title: props.t("settings.unsaved"),
					children: props.t("settings.unsaved")
				}) : null]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: settings_card_module_css_default.header,
				"aria-expanded": open,
				"aria-label": `${props.t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
				onClick: () => {
					setOpen(!open);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: settings_card_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.name,
							title,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.description,
							title: description,
							children: props.descriptionNode ?? description
						})]
					}),
					state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.pending,
						title: props.t("settings.unsaved"),
						children: props.t("settings.unsaved")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.chevron} ${settings_card_module_css_default.chevronOpen}` : settings_card_module_css_default.chevron,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})
				]
			});
			if (!state.exposed) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.body,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.notExposed,
						role: "status",
						children: props.t("settings.notExposed")
					})
				}) : null]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.readOnly,
							role: "status",
							children: props.t("settings.readOnly")
						}) : null,
						props.children,
						props.hideFooter === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: settings_card_module_css_default.failed,
									role: "status",
									children: [props.t("settings.saveFailed"), state.failedReason ? " - " + state.failedReason : ""]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.onDiscard,
									children: props.t("settings.discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.save,
									disabled: blocked,
									onClick: props.onSave,
									children: props.t(!state.saving ? "settings.save" : "settings.saving")
								})
							]
						})
					]
				}) : null]
			});
		}
		const NON_SKIN_BODY_MARKERS = /* @__PURE__ */ new Set(["dshSkinCenter", "dshSidebarCollapsed"]);
		function isSkinActive() {
			return Object.keys(document.body.dataset).some((key) => key.startsWith("dsh") && !NON_SKIN_BODY_MARKERS.has(key));
		}
		const SELECT_CLOSE_MS = 100;
		/**
		* The shared dual-mode select control. While an appearance skin is active it
		* renders the legacy native `<select>` untouched, so element-level skin
		* selectors keep working; under the default appearance it renders a
		* self-drawn `role="listbox"` popup whose open/close is transition-animated.
		* Staged cards reach it through BooleanField/ChoiceField; immediate-apply
		* editors (the side-card prefs) bind it directly through onEdit.
		* 双模式下拉框：皮肤激活时用原生 select，默认外观用自绘动画弹层。
		*/
		function SelectField(props) {
			const { id, options, value } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [closing, setClosing] = (0, react.useState)(false);
			const [phase, setPhase] = (0, react.useState)("initial");
			const [activeIndex, setActiveIndex] = (0, react.useState)(0);
			const closeTimer = (0, react.useRef)(void 0);
			const wrapRef = (0, react.useRef)(null);
			const popupRef = (0, react.useRef)(null);
			const currentIndex = () => {
				const index = options.findIndex((option) => option.value === value);
				return index >= 0 ? index : 0;
			};
			const close = (0, react.useCallback)(() => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setClosing(true);
				closeTimer.current = setTimeout(() => {
					setClosing(false);
					setOpen(false);
				}, SELECT_CLOSE_MS);
			}, []);
			const openPopup = () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setActiveIndex(currentIndex());
				setPhase("initial");
				setClosing(false);
				setOpen(true);
			};
			const commit = (index) => {
				const option = options[index];
				if (option) props.onEdit(option.value);
				close();
			};
			const onTriggerClick = () => {
				if (props.disabled) return;
				if (open && !closing) close();
				else openPopup();
			};
			const onKeyDown = (event) => {
				if (props.disabled) return;
				const count = options.length;
				switch (event.key) {
					case "ArrowDown":
					case "ArrowUp":
					case "Enter":
					case " ":
						event.preventDefault();
						if (!open) openPopup();
						else if (!closing) if (event.key === "ArrowDown") setActiveIndex((index) => (index + 1) % count);
						else if (event.key === "ArrowUp") setActiveIndex((index) => (index - 1 + count) % count);
						else commit(activeIndex);
						break;
					case "Escape":
						if (open) {
							event.preventDefault();
							event.stopPropagation();
							close();
						}
						break;
					case "Tab":
						if (open) close();
						break;
				}
			};
			(0, react.useEffect)(() => () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (open && !closing && phase === "initial") {
					popupRef.current?.offsetHeight;
					setPhase("open");
				}
			}, [
				open,
				closing,
				phase
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target instanceof Node && !wrapRef.current?.contains(target)) close();
				};
				document.addEventListener("pointerdown", onPointerDown);
				return () => document.removeEventListener("pointerdown", onPointerDown);
			}, [open, close]);
			(0, react.useEffect)(() => {
				if (props.disabled && open) close();
			}, [
				props.disabled,
				open,
				close
			]);
			if (isSkinActive()) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				id,
				className: settings_card_module_css_default.select,
				value,
				disabled: props.disabled,
				onChange: (event) => {
					props.onEdit(event.target.value);
				},
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: option.value,
					children: option.label
				}, option.value))
			});
			const label = options.find((option) => option.value === value)?.label ?? "";
			const popupClass = closing ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupClose}` : phase === "open" ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupOpen}` : settings_card_module_css_default.selectPopup;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.selectWrap,
				ref: wrapRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					id,
					className: `${settings_card_module_css_default.select} ${settings_card_module_css_default.selectButton}`,
					disabled: props.disabled,
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					"aria-activedescendant": open ? `${id}-o${activeIndex}` : void 0,
					"aria-invalid": props.invalid || void 0,
					onClick: onTriggerClick,
					onKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.selectLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.selectChevron} ${settings_card_module_css_default.selectChevronOpen}` : settings_card_module_css_default.selectChevron,
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: popupClass,
					role: "listbox",
					ref: popupRef,
					children: options.map((option, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						id: `${id}-o${index}`,
						role: "option",
						"aria-selected": option.value === value,
						className: `${settings_card_module_css_default.selectOption}${option.value === value ? ` ${settings_card_module_css_default.selectOptionSelected}` : ""}${index === activeIndex && !closing ? ` ${settings_card_module_css_default.selectOptionActive}` : ""}`,
						onClick: () => {
							commit(index);
						},
						children: option.label
					}, option.value))
				}) : null]
			});
		}
		/** A staged boolean field: 继承 / 开 / 关. */
		function BooleanField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: props.id,
						options: [
							{
								value: "",
								label: props.inheritLabel
							},
							{
								value: "true",
								label: props.onLabel
							},
							{
								value: "false",
								label: props.offLabel
							}
						],
						value: props.text,
						disabled: props.disabled,
						invalid: props.invalid,
						onEdit: props.onEdit
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-store-engine
		const platform = ["@deepseek-ai/dsh-client", "-store"].join("");
		const legacy = ["@deepseek-ai/dsh-client-runtime", "/client"].join("");
		let engine;
		try {
			engine = require(platform);
		} catch {
			engine = require(legacy);
		}
		const createSnapshotStore = engine.createSnapshotStore;
		engine.defineStore;
		engine.shallowEqual;
		//#endregion
		//#region src/client/settings-form.ts
		/** A whole- or decimal-number field. An empty draft clears the field; any other draft that is not a finite number within the constraints blocks the save. */
		function numberField(field, constraints = {}) {
			const { integer = false, min } = constraints;
			return {
				field,
				format: (value) => typeof value === "number" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					const parsed = Number(trimmed);
					if (!Number.isFinite(parsed)) return void 0;
					if (integer && !Number.isInteger(parsed)) return void 0;
					if (min !== void 0 && parsed < min) return void 0;
					return {
						kind: "set",
						value: parsed
					};
				}
			};
		}
		/** A boolean field, edited through true/false draft text. */
		function booleanField(field) {
			return {
				field,
				format: (value) => typeof value === "boolean" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					if (trimmed === "true") return {
						kind: "set",
						value: true
					};
					if (trimmed === "false") return {
						kind: "set",
						value: false
					};
				}
			};
		}
		/** An enumerated string field; only the listed choices are accepted. An empty draft clears the field. */
		function choiceField(field, choices) {
			return {
				field,
				format: (value) => typeof value === "string" && choices.includes(value) ? value : "",
				parse: (text) => {
					if (text === "") return { kind: "clear" };
					return choices.includes(text) ? {
						kind: "set",
						value: text
					} : void 0;
				}
			};
		}
		/**
		* Stages one card's edits over one settings namespace and writes them on save.
		*
		* The Host is the only authority on whether a value was accepted — its
		* validators own the constraints no schema can express — so the outcome is
		* read back from the section rather than predicted here. A save that did not
		* land keeps its drafts, so the user can correct them instead of retyping.
		*/
		var CardForm = class {
			scope;
			specs;
			staged = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			/** The scope subscription installed in the constructor; released by dispose(). */
			disposeScope;
			disposed = false;
			saving = false;
			failed = false;
			failedReason;
			/** @param scope - the bound settings scope for this card's namespace. */
			constructor(scope, specs) {
				this.scope = scope;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.disposeScope = scope.subscribe(() => {
					this.publish();
				});
			}
			/**
			* Release the scope subscription and every bound store listener. The card
			* must call this on teardown; later calls are no-ops.
			*/
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.disposeScope();
				this.listeners.clear();
			}
			/** Publish a projection of this form, rebuilt whenever the scope or a draft changes. */
			bind(project) {
				const store = createSnapshotStore(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/** Read the card-level state: what the Host serves, and what a save would do. */
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status !== "loading",
					exposed: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === void 0),
					saving: this.saving,
					failed: this.failed,
					...this.failedReason === void 0 ? {} : { failedReason: this.failedReason }
				};
			}
			/** Read one field's state from the effective section and its staged draft. */
			field(field) {
				const spec = this.specOf(field);
				const staged = this.staged.get(field);
				if (staged === void 0) return {
					text: spec.format(this.sectionValue(field)),
					overridden: this.stored(field),
					invalid: false
				};
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === void 0
				};
			}
			/** The actions the card's slot registration injects. */
			actions() {
				return {
					edit: (field, text) => {
						this.stage(field, {
							text,
							clear: false
						});
					},
					resetField: (field) => {
						this.stage(field, {
							text: this.specOf(field).format(this.baseValue(field)),
							clear: true
						});
					},
					save: () => {
						this.save();
					},
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.failed = false;
						this.failedReason = void 0;
						this.publish();
					}
				};
			}
			/**
			* Write every staged edit, then re-seed from what the Host accepted.
			*
			* When the scope carries the optional batch surface (the dsh-web
			* bridge scope), every planned write rides one mutation so cross-field
			* validate hooks (baseURL+model) judge the batch as a unit instead of
			* deadlocking on per-field writes. Otherwise the per-field loop runs.
			* A field lands only when the Host reports it held the staged value; a
			* landed field's draft is dropped, a failed one stays staged for the user.
			* @returns settlement after every write and the read-back.
			*/
			async save() {
				const plan = this.plan();
				const valid = plan.filter((item) => item.run !== void 0);
				if (plan.length === 0 || this.saving || valid.length !== plan.length) return;
				const plannedWrites = valid.map((item) => item.op);
				const pending = /* @__PURE__ */ new Map();
				for (const item of plan) pending.set(item.field, this.staged.get(item.field));
				this.saving = true;
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
				const landed = /* @__PURE__ */ new Set();
				const batch = this.batchedScope();
				if (batch !== void 0) {
					const result = await batch.mutateBatch(plannedWrites);
					if (result.ok) {
						for (const field of result.fields) if (field.landed) landed.add(field.field);
					} else this.failedReason = result.message;
				} else for (const item of valid) if (await item.run()) landed.add(item.field);
				for (const [field, before] of pending) if (landed.has(field) && this.staged.get(field) === before) this.staged.delete(field);
				this.saving = false;
				this.failed = landed.size !== pending.size;
				this.publish();
			}
			/** The scope's compatibility batch surface when it supports one; undefined conservatively otherwise. */
			batchedScope() {
				const candidate = this.scope;
				return typeof candidate.mutateBatch === "function" ? { mutateBatch: candidate.mutateBatch } : void 0;
			}
			/**
			* Every staged edit a save would write. An entry whose draft is not a value
			* its field accepts carries no write: the form is still dirty, and the save
			* refuses rather than dropping the edit. A staged edit that matches the
			* effective section is not a write at all.
			* @returns the planned writes, in the order the fields were staged.
			*/
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const spec = this.specOf(field);
					if (staged.clear) {
						if (this.stored(field)) plan.push({
							field,
							op: {
								field,
								op: "unset"
							},
							run: () => this.clear(field)
						});
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === void 0) plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						run: void 0
					});
					else if (write.kind === "clear") plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						run: () => this.clear(field)
					});
					else plan.push({
						field,
						op: {
							field,
							op: "set",
							value: write.value
						},
						run: () => this.store(field, write.value)
					});
				}
				return plan;
			}
			async clear(field) {
				await this.scope.unset(field);
				return !this.stored(field);
			}
			async store(field, value) {
				await this.scope.set(field, value);
				if (this.specOf(field).secret) return true;
				return this.userLayer()?.[field] === value;
			}
			stage(field, edit) {
				this.staged.set(field, edit);
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
			}
			specOf(field) {
				const spec = this.specs.get(field);
				if (spec === void 0) throw new Error(`settings card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region src/client/perf-settings-card.tsx
		/** Bridges the dsh-perf scope onto the card's staged form. */
		var PerfSettingsCardController = class {
			form;
			store;
			constructor(scope) {
				this.form = new CardForm(scope, [
					booleanField("enabled"),
					choiceField("mode", [
						"off",
						"balanced",
						"aggressive"
					]),
					numberField("meterIntervalMs"),
					numberField("statsWindowSeconds"),
					choiceField("alertPreset", [
						"light",
						"standard",
						"strict"
					]),
					booleanField("hudEnabled"),
					booleanField("renderDegrade")
				]);
				this.store = this.form.bind(() => this.projection());
			}
			projection() {
				return {
					...this.form.shell(),
					enabled: this.form.field("enabled"),
					mode: this.form.field("mode"),
					meterIntervalMs: this.form.field("meterIntervalMs"),
					statsWindowSeconds: this.form.field("statsWindowSeconds"),
					alertPreset: this.form.field("alertPreset"),
					hudEnabled: this.form.field("hudEnabled"),
					renderDegrade: this.form.field("renderDegrade")
				};
			}
			inject() {
				return {
					hooks: { perfSettingsCard: this.store },
					...this.form.actions()
				};
			}
			dispose() {
				this.form.dispose();
			}
		};
		/** Render the dsh-perf card. */
		function PerfSettingsCard(props) {
			const { t } = props;
			const state = props.usePerfSettingsCard((snapshot) => snapshot);
			const disabled = !state.writable;
			const fieldProps = {
				overriddenLabel: t("settings.overridden"),
				resetLabel: t("settings.reset"),
				invalidLabel: t("settings.invalidNumber"),
				disabled
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginSettingsCard, {
				t,
				titleKey: "settings.title",
				descriptionKey: "settings.description",
				defaultOpen: false,
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-perf-enabled",
						label: t("settings.enabled"),
						hint: t("settings.enabledHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.enabled,
						onEdit: (text) => {
							props.edit("enabled", text);
						},
						onReset: () => {
							props.resetField("enabled");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: "settings-perf-mode",
						options: [
							{
								label: t("settings.modeOff"),
								value: "off"
							},
							{
								label: t("settings.modeBalanced"),
								value: "balanced"
							},
							{
								label: t("settings.modeAggressive"),
								value: "aggressive"
							}
						],
						value: state.mode.text,
						disabled,
						invalid: state.mode.invalid,
						onEdit: (text) => {
							props.edit("mode", text);
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: t("settings.modeHint")
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-perf-render-degrade",
						label: t("settings.renderDegrade"),
						hint: t("settings.renderDegradeHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.renderDegrade,
						onEdit: (text) => {
							props.edit("renderDegrade", text);
						},
						onReset: () => {
							props.resetField("renderDegrade");
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: "settings-perf-alert-preset",
						options: [
							{
								label: t("settings.alertPresetLight"),
								value: "light"
							},
							{
								label: t("settings.alertPresetStandard"),
								value: "standard"
							},
							{
								label: t("settings.alertPresetStrict"),
								value: "strict"
							}
						],
						value: state.alertPreset.text,
						disabled,
						invalid: state.alertPreset.invalid,
						onEdit: (text) => {
							props.edit("alertPreset", text);
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: t("settings.alertPresetHint")
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-perf-hud-enabled",
						label: t("settings.hudEnabled"),
						hint: t("settings.hudEnabledHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						...fieldProps,
						...state.hudEnabled,
						onEdit: (text) => {
							props.edit("hudEnabled", text);
						},
						onReset: () => {
							props.resetField("hudEnabled");
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/perf-integrity.ts
		const RING_KEY = "dsh-perf-integrity-ring";
		const COOLDOWN_MS = 3e4;
		/**
		* 纯判定: 最后一个 assistant-step 已 settled 却缺少 finalNode。
		* @param node - 窗口尾部节点(取最后一个 assistant-step 传入)。
		* @returns 发现类别或 null。
		*/
		function classifyStepTail(node) {
			if (node?.kind !== "assistant-step") return null;
			if (node.data?.status === "settled" && node.data.finalNode === void 0) return "final-node-missing";
			return null;
		}
		/**
		* 纯判定: 服务端 history 尾部是 assistant/message 且 seq 晚于窗口最后可见节点。
		* @param hostTail - history 返回的最后一个事件的 event 视图。
		* @param lastNode - 客户端窗口最后一个可见节点。
		* @returns 发现类别或 null。
		*/
		function classifyStaleTail(hostTail, lastNode) {
			if (hostTail?.type !== "assistant/message") return null;
			if (typeof hostTail.seq !== "number" || typeof lastNode?.anchorSeq !== "number") return null;
			if (hostTail.seq > lastNode.anchorSeq) return "stale-tail";
			return null;
		}
		function readRing() {
			try {
				const raw = localStorage.getItem(RING_KEY);
				if (raw === null) return [];
				const parsed = JSON.parse(raw);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		function writeRing(finding) {
			try {
				const next = [...readRing(), finding].slice(-24);
				localStorage.setItem(RING_KEY, JSON.stringify(next));
			} catch {}
		}
		/**
		* 启动观察器。
		* @param ctx - 插件客户端上下文(仅经 inject 服务访问)。
		* @param isEnabled - 总开关读取器; 观察器随 enabled 生命周期启停。
		* @returns 停止函数。
		*/
		function startIntegrityObserver(ctx, isEnabled) {
			let sessions;
			try {
				sessions = ctx.get("sessions");
			} catch {
				return () => {};
			}
			if (typeof sessions?.list?.subscribe !== "function") return () => {};
			let disposed = false;
			const running = /* @__PURE__ */ new Map();
			const lastHit = /* @__PURE__ */ new Map();
			const record = (sessionId, kind, detail) => {
				if (!isEnabled()) return;
				const now = Date.now();
				const key = sessionId + ":" + kind;
				if ((lastHit.get(key) ?? 0) > now) return;
				lastHit.set(key, now + COOLDOWN_MS);
				writeRing({
					ts: now,
					sessionId,
					kind,
					detail
				});
				console.warn("[dsh-perf-integrity]", kind, sessionId, detail);
			};
			const checkTurnEnd = (sessionId) => {
				try {
					const session = sessions?.binding?.(sessionId)?.session;
					if (session === void 0) return;
					const snapshot = session.getSnapshot?.();
					const nodes = snapshot?.chat?.legacy?.nodes ?? [];
					if (nodes.length === 0) return;
					const lastStep = [...nodes].reverse().find((node) => node.kind === "assistant-step");
					const stepFinding = classifyStepTail(lastStep);
					if (stepFinding !== null) record(sessionId, stepFinding, "step " + String(lastStep?.data?.turn) + ":" + String(lastStep?.data?.step) + " settled without finalNode (blocks=" + (lastStep?.data?.blocks ?? []).length + ")");
					(async () => {
						try {
							const hostTail = ((await session.history?.({ maxMessages: 50 }))?.result?.value?.events ?? []).at(-1)?.event;
							const lastNode = nodes[nodes.length - 1];
							const stale = classifyStaleTail(hostTail, lastNode);
							if (stale !== null) record(sessionId, stale, "history tail seq=" + String(hostTail?.seq) + " (" + String(hostTail?.type) + ") > last node seq=" + String(lastNode?.anchorSeq) + " kind=" + String(lastNode?.kind));
						} catch {}
					})();
					if (snapshot?.running === false) try {
						const value = document.querySelector("textarea")?.value ?? "";
						if (value.trim() !== "") record(sessionId, "draft-residue", "editor non-empty (" + value.length + " chars) while session idle after a running edge");
					} catch {}
				} catch {}
			};
			const unsubscribe = sessions.list.subscribe(() => {
				if (disposed) return;
				try {
					const byId = sessions?.list?.getSnapshot().byId ?? {};
					for (const [sessionId, summary] of Object.entries(byId)) {
						const now = summary?.running ?? false;
						if ((running.get(sessionId) ?? false) && !now) checkTurnEnd(sessionId);
						running.set(sessionId, now);
					}
				} catch {}
			});
			return () => {
				disposed = true;
				unsubscribe();
			};
		}
		//#endregion
		//#region src/client/perf-list-gate.ts
		/** 逐字段比对单条会话条目, 唯一豁免 projectionValues(投影身份, 侧栏不显示)。 */
		function sameEntryVisible(a, b) {
			if (a === b) return true;
			if (a === void 0 || b === void 0) return false;
			const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
			keys.delete("projectionValues");
			for (const key of keys) if (!Object.is(a[key], b[key])) return false;
			return true;
		}
		/** 键值表比对: 同键同引用(目录/任务表的值在内容不变时身份稳定)。 */
		function sameRecord(a, b) {
			if (a === b) return true;
			if (a === void 0 || b === void 0) return false;
			const aKeys = Object.keys(a);
			const bKeys = Object.keys(b);
			if (aKeys.length !== bKeys.length) return false;
			for (const key of aKeys) {
				if (!(key in b)) return false;
				const va = a[key];
				const vb = b[key];
				if (Object.is(va, vb)) continue;
				if (Array.isArray(va) && Array.isArray(vb) && va.length === vb.length) {
					let equal = true;
					for (let i = 0; i < va.length; i += 1) if (!Object.is(va[i], vb[i])) {
						equal = false;
						break;
					}
					if (equal) continue;
				}
				return false;
			}
			return true;
		}
		/** 两个列表快照的可见内容是否一致(豁免 byId 条目的 projectionValues 身份)。 */
		function sameVisibleContent(a, b) {
			if (a === b) return true;
			if (!Object.is(a.current, b.current)) return false;
			if (!Object.is(a.phase, b.phase)) return false;
			if (!Object.is(a.currentAddress, b.currentAddress)) return false;
			const aIds = a.ids ?? [];
			const bIds = b.ids ?? [];
			if (aIds.length !== bIds.length) return false;
			for (let i = 0; i < aIds.length; i += 1) if (aIds[i] !== bIds[i]) return false;
			const aById = a.byId ?? {};
			const bById = b.byId ?? {};
			const aKeys = Object.keys(aById);
			const bKeys = Object.keys(bById);
			if (aKeys.length !== bKeys.length) return false;
			for (const key of aKeys) if (!sameEntryVisible(aById[key], bById[key])) return false;
			return sameRecord(a.subagentsByParent, b.subagentsByParent) && sameRecord(a.jobsBySession, b.jobsBySession);
		}
		function makeListSetGate(options) {
			options.now;
			const setTimeoutFn = options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
			const clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => {
				clearTimeout(handle);
			});
			const counts = {
				published: 0,
				coalesced: 0,
				flushed: 0
			};
			let pending;
			let timer;
			let disposed = false;
			function clearPendingTimer() {
				if (timer !== void 0) {
					clearTimeoutFn(timer);
					timer = void 0;
				}
			}
			function flushPending() {
				clearPendingTimer();
				if (pending === void 0) return;
				const next = pending;
				pending = void 0;
				counts.flushed += 1;
				options.publish(next);
			}
			return {
				set(next) {
					if (disposed) {
						options.publish(next);
						return;
					}
					if (!sameVisibleContent(options.getPublished(), next)) {
						clearPendingTimer();
						pending = void 0;
						counts.published += 1;
						options.publish(next);
						return;
					}
					pending = next;
					counts.coalesced += 1;
					if (timer === void 0) timer = setTimeoutFn(() => {
						timer = void 0;
						flushPending();
					}, options.coalesceMs);
				},
				get counts() {
					return counts;
				},
				dispose() {
					if (disposed) return;
					disposed = true;
					flushPending();
				}
			};
		}
		//#endregion
		//#region src/client/perf-attribution.ts
		/**
		* Per-plugin activity attribution for the dsh-perf HUD.
		*
		* One merged MutationObserver resolves every mutated node to its nearest
		* `[data-dsh-plugin]` root (semantic attribute convention,
		* skins/skin-center contracts/semantic-attrs-v1.md) and counts added nodes
		* into fixed time-grid buckets. The HUD renders a top-N scoreboard so
		* steady-state cost of our own plugins becomes measurable instead of
		* anecdotal. Classification and bucket math live here as pure injectable
		* logic; index.ts only wires the DOM observer and the render line.
		*
		* Semantics kept deliberately humble: rates are wall-clock (idle time
		* dilutes them on purpose), per-callback work above the budget and nodes
		* without a `data-dsh-plugin` ancestor share one "unattributed" bucket -
		* plugins that do not emit semantic attributes show up there, which is the
		* honest signal that drives adoption of the convention; totals include that bucket so an
		* all-unattributed page still reads nonzero. Everything fails
		* open: no MutationObserver or no roots means an empty scoreboard, never an
		* error surface.
		* @module @linxin666/dsh-perf/client
		*/
		/** Selector used to resolve a mutated node to its owning plugin root. */
		const ATTR_ROOT_SELECTOR = "[data-dsh-plugin]";
		function bucketKey(nowMs, windowMs) {
			return Math.floor(nowMs / windowMs);
		}
		/**
		* Fixed-grid attribution buckets. Timestamps come from the caller so the
		* math stays deterministic in tests; `windowMs` keeps rates comparable no
		* matter how irregularly mutations arrive.
		*/
		function createAttributionAggregator(options = {}) {
			const windowMs = options.windowMs ?? 2e3;
			const history = options.history ?? 8;
			const buckets = /* @__PURE__ */ new Map();
			const getOrCreate = (key) => {
				const oldest = key - history + 1;
				for (const existing of buckets.keys()) if (existing < oldest) buckets.delete(existing);
				let bucket = buckets.get(key);
				if (bucket === void 0) {
					bucket = {
						byPlugin: /* @__PURE__ */ new Map(),
						unattributed: 0,
						records: 0
					};
					buckets.set(key, bucket);
				}
				return bucket;
			};
			const bump = (plugin, nodes, nowMs) => {
				if (!(nodes > 0)) return;
				const bucket = getOrCreate(bucketKey(nowMs, windowMs));
				if (plugin === null) bucket.unattributed += nodes;
				else bucket.byPlugin.set(plugin, (bucket.byPlugin.get(plugin) ?? 0) + nodes);
			};
			return {
				add(plugin, nodes, nowMs) {
					bump(plugin, nodes, nowMs);
				},
				addRecords(records, nowMs) {
					if (!(records > 0)) return;
					getOrCreate(bucketKey(nowMs, windowMs)).records += records;
				},
				snapshot(nowMs, topN = 3) {
					const cursor = bucketKey(nowMs, windowMs);
					const oldest = cursor - history + 1;
					const startMs = oldest * windowMs;
					const byPlugin = /* @__PURE__ */ new Map();
					let unattributed = 0;
					let records = 0;
					for (const [key, bucket] of buckets) {
						if (key < oldest || key > cursor) continue;
						for (const [name, nodes] of bucket.byPlugin) byPlugin.set(name, (byPlugin.get(name) ?? 0) + nodes);
						unattributed += bucket.unattributed;
						records += bucket.records;
					}
					const spanSeconds = Math.max((nowMs - startMs) / 1e3, windowMs / 1e3);
					const perSec = (nodes) => Math.round(nodes / spanSeconds * 10) / 10;
					const ranked = [...byPlugin.entries()].map(([name, nodes]) => ({
						name,
						nodesPerSec: perSec(nodes)
					})).sort((a, b) => b.nodesPerSec - a.nodesPerSec || (a.name < b.name ? -1 : 1));
					const totalNodes = [...byPlugin.values()].reduce((sum, nodes) => sum + nodes, 0) + unattributed;
					const head = ranked.slice(0, Math.max(topN, 0));
					const restPerSec = ranked.slice(Math.max(topN, 0)).reduce((sum, entry) => sum + entry.nodesPerSec, 0) + perSec(unattributed);
					return {
						spanSeconds: Math.round(spanSeconds * 100) / 100,
						totalNodesPerSec: perSec(totalNodes),
						unattributedPerSec: perSec(unattributed),
						otherNodesPerSec: Math.round(restPerSec * 10) / 10,
						topPlugins: head,
						recordsPerSec: perSec(records)
					};
				}
			};
		}
		/**
		* Ring of recent long tasks with coarse origin labels. The spec-level
		* attribution often carries no container name, so the most useful stable
		* output is still aggregate: count, worst duration, and whichever sources
		* did label themselves. Counting iterates batched entries (one observer
		* callback can deliver several tasks).
		*/
		function createLongtaskLog(options = {}) {
			const windowMs = options.windowMs ?? 6e4;
			const capacity = options.capacity ?? 40;
			const items = [];
			const sinceWindow = (nowMs) => {
				const cutoff = nowMs - windowMs;
				return items.filter((item) => item.t >= cutoff);
			};
			return {
				push(record) {
					items.push(record);
					while (items.length > capacity) items.shift();
				},
				prune(nowMs) {
					const cutoff = nowMs - windowMs;
					while (items.length > 0 && items[0].t < cutoff) items.shift();
				},
				list() {
					return items;
				},
				countSince(nowMs, spanMs) {
					return sinceWindow(nowMs).filter((item) => item.t >= nowMs - spanMs).length;
				},
				maxSince(nowMs, spanMs) {
					return sinceWindow(nowMs).filter((item) => item.t >= nowMs - spanMs).reduce((max, item) => Math.max(max, item.durationMs), 0);
				},
				topSources(nowMs, spanMs, n = 3) {
					const merged = /* @__PURE__ */ new Map();
					for (const item of sinceWindow(nowMs)) {
						if (item.t < nowMs - spanMs) continue;
						const entry = merged.get(item.source) ?? {
							count: 0,
							durationMs: 0
						};
						entry.count += 1;
						entry.durationMs += item.durationMs;
						merged.set(item.source, entry);
					}
					return [...merged.entries()].map(([source, agg]) => ({
						source,
						...agg
					})).sort((a, b) => b.durationMs - a.durationMs || (a.source < b.source ? -1 : 1)).slice(0, Math.max(n, 0));
				}
			};
		}
		/** Extracts the best-effort source label from a raw long-task entry. */
		function readLongtaskSource(entry) {
			const extended = entry;
			const name = (Array.isArray(extended.attribution) ? extended.attribution[0] : void 0)?.containerName;
			return typeof name === "string" && name.length > 0 ? name : "unknown";
		}
		/**
		* Installs the merged body MutationObserver feeding the aggregator.
		* Returns a disposer, or `undefined` when the environment lacks the APIs -
		* callers treat that as an empty scoreboard, never a failure.
		*/
		function startDomAttributionSampler(aggregator, options = {}) {
			try {
				if (typeof document === "undefined" || typeof MutationObserver !== "function") return void 0;
				const target = document.body;
				if (target === null) return void 0;
				const budget = options.budget ?? 400;
				const now = options.now ?? (() => performance.now());
				let warned = false;
				const classify = (element) => {
					if (element === null || typeof element.closest !== "function") return null;
					const value = element.closest(ATTR_ROOT_SELECTOR)?.getAttribute("data-dsh-plugin");
					return value ? value : null;
				};
				const observer = new MutationObserver((records) => {
					try {
						const timestamp = now();
						aggregator.addRecords(records.length, timestamp);
						let processed = 0;
						let overflow = 0;
						for (const record of records) for (const node of record.addedNodes) {
							let owner;
							if (node.nodeType === 1) owner = classify(node);
							else if (node.nodeType === 3) owner = classify(node.parentElement);
							else owner = null;
							if (processed >= budget) {
								overflow += 1;
								continue;
							}
							processed += 1;
							aggregator.add(owner, 1, timestamp);
						}
						if (overflow > 0) aggregator.add(null, overflow, timestamp);
					} catch (error) {
						if (!warned) {
							warned = true;
							console.debug("[dsh-perf] attribution sampler degraded:", error);
						}
					}
				});
				observer.observe(target, {
					childList: true,
					subtree: true
				});
				return () => {
					observer.disconnect();
				};
			} catch (error) {
				console.debug("[dsh-perf] attribution sampler unavailable:", error);
				return;
			}
		}
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace owned by this plugin. */
		const NS = "dsh-perf";
		/** Services required by the browser half. */
		const inject = [
			"slots",
			"locale",
			"settingsScope",
			"sessions"
		];
		const API_STATS = "/api/dsh-perf/stats";
		const POLL_MS = 2e3;
		const STORAGE_KEY = "dsh-perf-hud-visible";
		const FPS_WINDOW_MS = 1e3;
		function apply(ctx) {
			let perfScope;
			try {
				perfScope = (ctx.get("webUiSettings") ?? ctx.settingsScope).bind({ namespace: NS });
			} catch {}
			let perfTranslate;
			try {
				perfTranslate = ctx.locale.bind(NS);
			} catch {
				perfTranslate = (key) => en[key];
			}
			let renderDegrade = true;
			let hudOn = false;
			let hudDispose;
			let integrityDispose;
			let listGateDispose;
			const refreshClientSwitches = () => {
				let snapshotValue;
				try {
					const snapshot = perfScope?.getSnapshot();
					if (snapshot?.status === "ready") snapshotValue = snapshot.value;
				} catch {}
				renderDegrade = snapshotValue?.renderDegrade ?? true;
				const nextHudOn = snapshotValue?.hudEnabled ?? false;
				if (nextHudOn !== hudOn) {
					hudOn = nextHudOn;
					try {
						if (hudOn && hudDispose === void 0) hudDispose = boot(isEnabled, perfTranslate);
						else if (!hudOn && hudDispose !== void 0) {
							hudDispose();
							hudDispose = void 0;
						}
					} catch (error) {
						console.debug("[dsh-perf] HUD boot degraded:", error);
					}
				}
				try {
					installPerfCss(() => isEnabled() && renderDegrade);
				} catch {}
				const shouldRun = isEnabled();
				if (shouldRun && integrityDispose === void 0) try {
					integrityDispose = startIntegrityObserver(ctx, isEnabled);
				} catch (error) {
					console.debug("[dsh-perf] integrity observer degraded:", error);
				}
				else if (!shouldRun && integrityDispose !== void 0) {
					integrityDispose();
					integrityDispose = void 0;
				}
				const shouldGate = isEnabled() && renderDegrade;
				if (shouldGate && listGateDispose === void 0) try {
					listGateDispose = installListGate(ctx);
				} catch (error) {
					console.warn("[dsh-perf] list gate degraded:", error);
				}
				else if (!shouldGate && listGateDispose !== void 0) {
					listGateDispose();
					listGateDispose = void 0;
				}
			};
			const isEnabled = () => {
				try {
					const snapshot = perfScope?.getSnapshot();
					return snapshot?.status === "ready" ? snapshot.value?.enabled ?? true : true;
				} catch {
					return true;
				}
			};
			try {
				refreshClientSwitches();
				perfScope?.subscribe(refreshClientSwitches);
			} catch {}
			try {
				ctx.effect(() => ctx.locale.register(NS, {
					zh,
					en
				}), "dsh-perf: dictionaries");
			} catch {}
			try {
				const controller = new PerfSettingsCardController((ctx.get("webUiSettings") ?? ctx.settingsScope).bind({ namespace: NS }));
				ctx.slots.inject("web-ui.plugin.item", () => {
					try {
						const unregister = ctx.slots.register({
							name: "web-ui.plugin.item",
							id: "dsh-perf",
							order: 95,
							locale: NS,
							inject: () => controller.inject()
						}, PerfSettingsCard);
						return () => {
							controller.dispose();
							unregister();
						};
					} catch {
						return () => {};
					}
				});
			} catch (error) {
				console.debug("[dsh-perf] settings card degraded:", error);
			}
		}
		function installListGate(ctx) {
			const list = ctx.get("sessions")?.list;
			if (list === void 0 || typeof list.set !== "function" || typeof list.getSnapshot !== "function") {
				console.warn("[dsh-perf] list gate: sessions.list store shape not recognized, skipped");
				return () => {};
			}
			if (list.__dshPerfGate !== void 0) {
				console.log("[dsh-perf] list gate: already installed, reuse");
				return () => {};
			}
			const originalSet = list.set;
			const gate = makeListSetGate({
				coalesceMs: readPositiveInt("dsh-perf-list-coalesce", 1e3),
				getPublished: () => list.getSnapshot?.() ?? {},
				publish: (next) => {
					originalSet(next);
				}
			});
			list.set = gate.set;
			list.__dshPerfGate = gate;
			try {
				if (localStorage.getItem("dsh-perf-debug") === "1") window.__dshPerfListGate = gate;
			} catch {}
			console.log("[dsh-perf] list gate: installed on sessions.list (coalesce projection-only publishes)");
			return () => {
				gate.dispose();
				if (list.__dshPerfGate === gate) {
					list.set = originalSet;
					delete list.__dshPerfGate;
				}
			};
		}
		function readPositiveInt(key, fallback) {
			try {
				const value = Number(localStorage.getItem(key));
				return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
			} catch {
				return fallback;
			}
		}
		/** P0 CSS 降载样式(单例): 屏外消息行 content-visibility 近似虚拟化。 */
		let perfCssStyle;
		function installPerfCss(isDegradeEnabled) {
			try {
				const off = localStorage.getItem("dsh-perf-css") === "off";
				if (!isDegradeEnabled() || off) {
					perfCssStyle?.remove();
					perfCssStyle = void 0;
					return;
				}
				if (perfCssStyle !== void 0 && perfCssStyle.isConnected) return;
				const style = document.createElement("style");
				style.dataset.dshPerf = "css";
				style.textContent = [
					"[data-chat-flow-kind=\"assistant-step\"]:not(:has(.md-table-wide)),",
					"[data-chat-flow-kind=\"tool-call\"]:not(:has(.md-table-wide)) {",
					"  content-visibility: auto;",
					"  contain-intrinsic-size: auto 120px;",
					"}",
					"[data-chat-flow-kind=\"assistant-step\"]:has(.md-table-wide),",
					"[data-chat-flow-kind=\"tool-call\"]:has(.md-table-wide) {",
					"  content-visibility: visible !important;",
					"  contain: none !important;",
					"}"
				].join("\n");
				document.head.appendChild(style);
				perfCssStyle = style;
			} catch {}
		}
		function boot(isEnabled, t) {
			const host = document.documentElement;
			if (host === null || host === void 0) return () => {};
			const root = document.createElement("div");
			root.dataset.dshPerf = "hud";
			root.style.cssText = [
				"position:fixed",
				"bottom:10px",
				"right:10px",
				"z-index:2147483000",
				"padding:7px 9px",
				"border-radius:8px",
				"background:rgba(15,20,26,.92)",
				"color:#d8e0ea",
				"font:11px/1.5 ui-monospace,Menlo,Consolas,monospace",
				"white-space:pre",
				"pointer-events:auto",
				"user-select:none",
				"box-shadow:0 2px 12px rgb(0 0 0 / .35)",
				"max-width:340px",
				"overflow:hidden",
				"border:1px solid transparent"
			].join(";");
			const cache = {
				stats: void 0,
				stale: true,
				failures: 0
			};
			let fps = 0;
			const longtaskLog = createLongtaskLog();
			const activityAgg = createAttributionAggregator();
			const stopAttribution = startDomAttributionSampler(activityAgg);
			let frames = 0;
			let fps0 = performance.now();
			const rafLoop = () => {
				frames += 1;
				const now = performance.now();
				if (now - fps0 >= FPS_WINDOW_MS) {
					fps = Math.round(frames * 1e3 / (now - fps0));
					frames = 0;
					fps0 = now;
				}
				requestAnimationFrame(rafLoop);
			};
			requestAnimationFrame(rafLoop);
			try {
				new PerformanceObserver((list) => {
					const now = performance.now();
					for (const entry of list.getEntries()) longtaskLog.push({
						t: now,
						durationMs: entry.duration,
						source: readLongtaskSource(entry)
					});
					longtaskLog.prune(now);
				}).observe({ entryTypes: ["longtask"] });
			} catch {}
			const poll = async () => {
				let wire;
				try {
					const response = await fetch(API_STATS, { cache: "no-store" });
					if (!response.ok) throw new Error("http " + response.status);
					const body = await response.json();
					if (typeof body === "object" && body !== null) wire = body;
				} catch {}
				if (wire === void 0) {
					cache.failures += 1;
					if (cache.failures >= 3) {
						cache.stale = true;
						root.style.display = "none";
					}
					return;
				}
				cache.failures = 0;
				cache.stats = wire;
				cache.stale = false;
				if (!isEnabled()) {
					root.style.display = "none";
					return;
				}
				try {
					render(root, cache, fps);
				} catch (error) {
					console.debug("[dsh-perf] render degraded:", error);
					root.style.display = "none";
				}
			};
			let renderInto;
			function render(hostEl, state, currentFps) {
				const s = state.stats;
				if (s === void 0) return;
				const lines = [];
				const mode = s.mode ?? "?";
				const batch = s.batchDelayMs ?? "?";
				const alert = typeof s.alert === "object" && s.alert !== null ? s.alert : void 0;
				if (alert) {
					const reason = hudAlertReason(alert, t);
					if (reason !== void 0) lines.push("[!] " + reason);
				}
				lines.push("dsH PERF  mode=" + mode + "  batch=" + batch + "ms");
				const ev = s.events ?? {};
				lines.push("events " + (ev.perSec ?? "?") + "/s  active=" + (ev.activeSessions ?? "?") + "  win=" + (ev.window ?? "?"));
				const el = s.elDelay ?? {};
				lines.push("EL p99=" + fmtMs(el.p99Ms) + " mean=" + fmtMs(el.meanMs));
				const nowTs = performance.now();
				lines.push("fps=" + currentFps + "  longtasks(60s)=" + longtaskLog.countSince(nowTs, 6e4) + "  max=" + fmtMs(longtaskLog.maxSince(nowTs, 6e4)));
				try {
					const act = activityAgg.snapshot(nowTs, 3);
					if (act.topPlugins.length > 0 || act.totalNodesPerSec > .05) {
						const parts = act.topPlugins.map((p) => p.name + "=" + fmtRate(p.nodesPerSec));
						if (act.otherNodesPerSec >= .1) parts.push("rest=" + fmtRate(act.otherNodesPerSec));
						lines.push("act " + parts.join(" · "));
					}
				} catch {}
				const mem = s.mem ?? {};
				lines.push("rss=" + (mem.rssMB ?? "?") + "MB  heap=" + (mem.heapUsedMB ?? "?") + "MB");
				const top = Array.isArray(s.topSessions) ? s.topSessions : [];
				for (const session of top.slice(0, 3)) {
					const id = shortId(session.id ?? "?");
					const statusMark = session.status === "idle" ? " ·idle" : "";
					lines.push("  · " + id + "  " + (session.eventsPerSec ?? "?") + "/s [" + (session.lastType ?? "") + "]" + statusMark);
				}
				hostEl.style.borderColor = alert ? "#ff8a65" : "transparent";
				if (peekBtn !== void 0) peekBtn.style.display = currentVisible() ? "none" : "block";
				if (renderInto !== void 0) renderInto.textContent = lines.join("\n");
				else hostEl.textContent = lines.join("\n");
			}
			function fmtMs(value) {
				if (value === void 0) return "?";
				return (value >= 100 ? Math.round(value) : Math.round(value * 10) / 10) + "ms";
			}
			function fmtRate(value) {
				return (value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10)) + "/s";
			}
			function shortId(id) {
				return id.length > 12 ? id.slice(0, 12) + "…" : id;
			}
			function currentVisible() {
				return localStorage.getItem(STORAGE_KEY) !== "hidden";
			}
			root.addEventListener("click", (event) => {
				const target = event.target;
				if (target?.dataset.dshPerfAction === "close") {
					localStorage.setItem(STORAGE_KEY, "hidden");
					applyCollapse();
					return;
				}
				if (target?.dataset.dshPerfAction === "peek") {
					localStorage.setItem(STORAGE_KEY, "shown");
					applyCollapse();
				}
				if (!currentVisible() && target !== null) {
					localStorage.setItem(STORAGE_KEY, "shown");
					applyCollapse();
				}
			});
			const closeBtn = document.createElement("button");
			closeBtn.dataset.dshPerfAction = "close";
			closeBtn.textContent = "×";
			closeBtn.style.cssText = "position:absolute;top:2px;right:4px;border:0;background:none;color:#8fa3b8;cursor:pointer;font:12px/1 monospace;padding:2px";
			const peekBtn = document.createElement("button");
			peekBtn.dataset.dshPerfAction = "peek";
			peekBtn.textContent = "▲";
			peekBtn.style.cssText = "position:absolute;top:2px;right:20px;border:0;background:none;color:#8fa3b8;cursor:pointer;font:12px/1 monospace;padding:2px;display:none";
			root.appendChild(peekBtn);
			root.appendChild(closeBtn);
			const dataEl = document.createElement("pre");
			dataEl.style.cssText = "margin:0;font:inherit;color:inherit";
			root.appendChild(dataEl);
			root.appendChild(closeBtn);
			renderInto = dataEl;
			document.body.appendChild(root);
			const applyCollapse = () => {
				const collapsed = !currentVisible();
				root.style.width = collapsed ? "auto" : "";
				root.style.maxWidth = collapsed ? "none" : "340px";
				if (renderInto !== void 0) renderInto.textContent = collapsed ? "PERF " : renderInto.textContent;
			};
			applyCollapse();
			try {
				if (localStorage.getItem("dsh-perf-debug") === "1") window.__dshPerfAttribution = {
					snapshot: () => activityAgg.snapshot(performance.now(), 12),
					longtasks: () => longtaskLog.list(),
					topSources: (n) => longtaskLog.topSources(performance.now(), 6e4, n)
				};
			} catch {}
			poll();
			const timer = setInterval(poll, POLL_MS);
			return () => {
				clearInterval(timer);
				stopAttribution?.();
			};
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map