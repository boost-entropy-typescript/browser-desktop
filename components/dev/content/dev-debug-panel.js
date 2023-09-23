/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var { AddonManager } = ChromeUtils.importESModule(
	"resource://gre/modules/AddonManager.sys.mjs"
);

var { AppConstants } = ChromeUtils.importESModule(
	"resource://gre/modules/AppConstants.sys.mjs"
);

var { DotAppConstants } = ChromeUtils.importESModule(
	"resource://gre/modules/DotAppConstants.sys.mjs"
);

var { NativeTitlebar } = ChromeUtils.importESModule(
	"resource:///modules/NativeTitlebar.sys.mjs"
);

/**
 * Utility function to convert bytes to a human-readable format
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2, k = 1024) {
	if (!+bytes) return "0 Bytes";

	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "kB", "MB", "GB", "TB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Utility function to work out percentage difference between a value and its maximum
 * @param {number} val
 * @param number max
 * @returns
 */
function perDiff(val, max) {
	return ((1.0 - (max - val) / max) * 100).toFixed(2);
}

class DeveloperDebugPanel extends MozHTMLElement {
	constructor() {
		super();
	}

	elements = {
		app_info: html("span"),
		proc_info: html("div"),
		user_agent: html("span"),

		graph: /** @type {DeveloperDebugGraph} */ (html("dev-debug-graph")),

		active_theme: /** @type {HTMLSelectElement} */ (
			html("select", { class: "dev-active-theme" })
		),

		native_titlebar: /** @type {HTMLInputElement} */ (
			html("input", { type: "checkbox", id: "dev-native-theme-enabled" })
		),

		customizableui_data: /** @type {HTMLTextAreaElement} */ (
			html("textarea", { readonly: "", rows: 5 })
		)
	};

	resourceUsageInt = null;

	onAddonEnabled(addon) {
		if (!addon || addon.type != "theme") return;

		this.renderThemes().then((_) => {
			this.elements.active_theme.value = addon.id;
		});
	}

	async calculateResourceUsage() {
		const procInfo = await ChromeUtils.requestProcInfo();

		/** @type {any[]} */
		let data = [
			html("span", {}, `PID: ${procInfo.pid}`),
			html("span", {}, `Memory: ${formatBytes(procInfo.memory)}`),
			html("span", {}, `Processes: ${procInfo.children.length}`),
			html("span", {}, `Threads: ${procInfo.threads.length}`)
		];

		if (
			procInfo.memory >=
			Math.max(...(this.elements.graph.points.default || []))
		) {
			this.elements.graph.max =
				Math.ceil((procInfo.memory + 50000000) /* 50mb */ / 50000000) *
				50000000;
		}
		this.elements.graph.addPoint(procInfo.memory);

		if (procInfo.children.length) {
			data.push(html("br"));

			for (const child of procInfo.children.sort(
				(a, b) => b.memory - a.memory
			)) {
				this.elements.graph.addPoint(
					child.memory,
					child.pid.toString()
				);

				const groupColour =
					this.elements.graph.pointGroupColours[child.pid.toString()];

				const groupDot = /** @type {HTMLSpanElement} */ (
					html("div", { class: "dev-graph-group-dot" })
				);
				groupDot.style.setProperty("--color", groupColour);

				data.push(
					html(
						"div",
						{ class: "dev-graph-group" },
						groupDot,
						html(
							"span",
							{},
							`${child.type} (id=${child.childID} pid=${
								child.pid
							}, mem=${formatBytes(child.memory)}, thds=${
								child.threads.length
							}, wins=${child.windows.length})`
						)
					)
				);
			}
		}

		this.elements.proc_info.textContent = "";
		this.elements.proc_info.append(...data);

		// Lazy way of updating this value
		this.elements.native_titlebar.checked = NativeTitlebar.enabled;
	}

	async renderThemes() {
		const allThemes = await AddonManager.getAddonsByTypes(["theme"]);

		// Clear children
		this.elements.active_theme.replaceChildren();

		for (const theme of allThemes.sort((a, b) =>
			a.id.localeCompare(b.id)
		)) {
			const option = html(
				"option",
				{ value: theme.id },
				`${theme.name} (${theme.id})`
			);

			this.elements.active_theme.appendChild(option);
		}
	}

	// https://stackoverflow.com/a/54931396
	prettyStringify(obj) {
		return JSON.stringify(
			obj,
			function (k, v) {
				if (v instanceof Array) return JSON.stringify(v);
				return v;
			},
			2
		);
	}

	getCustomizableUIData() {
		this.elements.customizableui_data.value = JSON.stringify(
			JSON.parse(
				Services.prefs.getStringPref("dot.customizable.state", "{}")
			)
		);
	}

	async init() {
		const activeTheme = (
			await AddonManager.getAddonsByTypes(["theme"])
		).find((ext) => ext.isActive);

		AddonManager.addAddonListener({
			onEnabled: this.onAddonEnabled.bind(this)
		});

		this.resourceUsageInt = setInterval(() => {
			this.calculateResourceUsage();
		}, 1000);

		this.onAddonEnabled(activeTheme);
		this.calculateResourceUsage();

		setInterval(() => {
			this.getCustomizableUIData();
		}, 500);

		const dotVersion = document.createElement("strong");
		dotVersion.textContent = `Dot Browser v${DotAppConstants.DOT_APP_VERSION} (${AppConstants.MOZ_BUILDID})`;

		this.elements.app_info.append(
			html(
				"div",
				{ class: "dev-branding-lockup" },
				html("img", { src: "chrome://branding/content/icon32.png" }),
				html("img", {
					src: "chrome://branding/content/about-wordmark.svg",
					height: "48"
				})
			),
			html("br"),
			dotVersion,
			html("br"),
			`Firefox v${AppConstants.MOZ_APP_VERSION}`
		);

		this.elements.user_agent.textContent = `user_agent = ${
			Cc["@mozilla.org/network/protocol;1?name=http"].getService(
				Ci.nsIHttpProtocolHandler
			).userAgent
		}`;

		this.elements.active_theme.addEventListener("change", async (event) => {
			const { value } = /** @type {HTMLSelectElement} */ (event.target);

			const addon = await AddonManager.getAddonByID(value);

			if (addon) {
				addon.enable();
			}
		});

		this.elements.native_titlebar.addEventListener(
			"change",
			async (event) => {
				const { checked } = /** @type {HTMLInputElement} */ (
					event.target
				);

				NativeTitlebar.set(checked, true);
			}
		);
	}

	insertStylesheet() {
		const sheet = document.createProcessingInstruction(
			"xml-stylesheet",
			`href="chrome://dot/content/widgets/dev-debug-panel.css" type="text/css"`
		);

		document.insertBefore(sheet, document.documentElement);
	}

	connectedCallback() {
		if (this.delayConnectedCallback()) return;
		this.classList.add("dev-panel");

		this.appendChild(this.elements.app_info);
		this.appendChild(this.elements.proc_info);
		this.appendChild(this.elements.user_agent);
		this.appendChild(
			html(
				"div",
				{ class: "dev-active-theme-container" },
				html("label", {}, "Active Theme:"),
				this.elements.active_theme
			)
		);

		this.appendChild(
			html(
				"div",
				{ class: "dev-native-titlebar-container" },
				html(
					"label",
					{ for: "dev-native-theme-enabled" },
					"Native Titlebar:"
				),
				this.elements.native_titlebar
			)
		);
		this.elements.native_titlebar.checked = NativeTitlebar.enabled;

		this.appendChild(
			html(
				"div",
				{ class: "dev-customizable-ui-container" },
				html("label", {}, "Customizable UI State:"),
				this.elements.customizableui_data
			)
		);

		this.appendChild(this.elements.graph);

		this.insertStylesheet();

		if (
			window.location.href ==
			"chrome://dot/content/dev-debug-popout.xhtml"
		) {
			new ResizeObserver(() => {
				window.document.documentElement.style.setProperty(
					"--height",
					this.getBoundingClientRect().height + "px"
				);
			}).observe(this);

			const devtoolsButton = html("button", {}, "Open Browser Toolbox");
			devtoolsButton.addEventListener("click", () => {
				var { BrowserToolboxLauncher } = ChromeUtils.importESModule(
					"resource://devtools/client/framework/browser-toolbox/Launcher.sys.mjs"
				);

				BrowserToolboxLauncher.init();
			});

			this.appendChild(devtoolsButton);
		}
	}

	disconnectedCallback() {
		if (this.delayConnectedCallback()) return;

		clearInterval(this.resourceUsageInt);
	}
}

customElements.define("dev-debug-panel", DeveloperDebugPanel);
