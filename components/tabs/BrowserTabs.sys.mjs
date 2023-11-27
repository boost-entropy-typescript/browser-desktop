/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { TabProgressListener } = ChromeUtils.importESModule(
	"resource://gre/modules/TabProgressListener.sys.mjs"
);

const { E10SUtils } = ChromeUtils.importESModule(
	"resource://gre/modules/E10SUtils.sys.mjs"
);

const { NavigationHelper } = ChromeUtils.importESModule(
	"resource://gre/modules/NavigationHelper.sys.mjs"
);

const { BrowserTabsUtils } = ChromeUtils.importESModule(
	"resource://gre/modules/BrowserTabsUtils.sys.mjs"
);

/**
 * Clamps a number between a min and max value
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

const {
	LOAD_FLAGS_NONE,
	LOAD_FLAGS_FROM_EXTERNAL,
	LOAD_FLAGS_FIRST_LOAD,
	LOAD_FLAGS_DISALLOW_INHERIT_PRINCIPAL,
	LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP,
	LOAD_FLAGS_FIXUP_SCHEME_TYPOS,
	LOAD_FLAGS_FORCE_ALLOW_DATA_URI,
	LOAD_FLAGS_DISABLE_TRR
} = Ci.nsIWebNavigation;

const kTabMaxWidthPref = "dot.tabs.max-width";
const kTabMinWidthPref = "dot.tabs.min-width";

/**
 * @typedef {import("third_party/dothq/gecko-types/lib").ChromeBrowser} ChromeBrowser
 * @typedef {import("third_party/dothq/gecko-types/lib").nsIURI} nsIURI
 * @typedef {import("third_party/dothq/gecko-types/lib").nsIWebProgress} nsIWebProgress
 * @typedef {import("components/tabs/TabProgressListener.sys.mjs").TabProgressListener} TabProgressListener
 */

/**
 * @param {Window} win
 */
export function BrowserTabs(win) {
	this.init(win);
}

/**
 * Oversees control over all tabs in the current browser window
 */
BrowserTabs.prototype = {
	EVENT_TAB_SELECT: "BrowserTabs::TabSelect",
	EVENT_TAB_CREATE: "BrowserTabs::TabCreate",

	EVENT_BROWSER_STATUS_CHANGE: "BrowserTabs::BrowserStatusChange",

	/** @type {Window} */
	_win: null,

	/** @type {number} */
	_uniqueTabIdCounter: null,

	/** @type {number} */
	_uniquePanelIdCounter: null,

	/** A mapping between webContentsId -> BrowserTab
	 * @type {Map<number, BrowserTab>}
	 * */
	_tabs: new Map(),

	/**
	 * A mapping between BrowserTab -> TabProgressListener
	 * @type {Map<BrowserTab, TabProgressListener>}
	 */
	_tabListeners: new Map(),

	/**
	 * A mapping between BrowserTab -> nsIWebProgress
	 * @type {Map<BrowserTab, nsIWebProgress>}
	 */
	_tabFilters: new Map(),

	/**
	 * Determines whether the browser is in a "busy" state
	 */
	isBusy: false,

	/**
	 * All currently visible open tabs in the browser
	 * @returns {BrowserTab[]}
	 */
	get list() {
		// @ts-ignore
		return Array.from(this.collator.children).map((child) => child);
	},

	/**
	 * The number of visible open tabs in the browser
	 */
	get length() {
		return this.list.length;
	},

	/**
	 * All currently visible tabs in the browser
	 * @returns {BrowserTab[]}
	 */
	get visibleTabs() {
		return this.list.filter((tab) => tab.visible);
	},

	_selectedTab: null,

	/**
	 * The currently selected tab
	 * @type {BrowserTab}
	 */
	get selectedTab() {
		return this._selectedTab;
	},

	/**
	 * Updates the currently selected tab in the browser
	 * @param {BrowserTab} tab
	 */
	set selectedTab(tab) {
		/** @type {BrowserTab} */
		const oldTab = this._selectedTab;
		if (oldTab && oldTab.webContentsPanel)
			oldTab.webContentsPanel.removeAttribute("visible");

		if (oldTab) {
			if (this._isWebContentsBrowserElement(oldTab.webContents)) {
				/** @type {ChromeBrowser} */ (
					oldTab.webContents
				).docShellIsActive = false;
				oldTab.webContents.removeAttribute("primary");
			}

			if (oldTab.previousElementSibling)
				oldTab.previousElementSibling.removeAttribute(
					"precedes-selected"
				);
		}

		if (this._isWebContentsBrowserElement(tab.webContents)) {
			const browser = /** @type {ChromeBrowser} */ (tab.webContents);

			console.log("tab.docShellIsActive", true);
			browser.docShellIsActive = true;
			browser.setAttribute("primary", "true");
		}

		this._selectedTab = tab;

		tab.webContentsPanel.toggleAttribute("visible", true);

		if (tab.previousElementSibling)
			tab.previousElementSibling.toggleAttribute(
				"precedes-selected",
				true
			);

		this.shouldUpdateWindowTitle();

		this._dispatchWindowEvent("BrowserTabs::TabSelect", { detail: tab });

		const listener = this._tabListeners.get(tab);
		if (
			listener &&
			this._isWebContentsBrowserElement(tab.webContents) &&
			this._win.gDot.tabs
		) {
			const browser = /** @type {ChromeBrowser} */ (tab.webContents);

			const { STATE_START, STATE_STOP, STATE_IS_NETWORK } =
				Ci.nsIWebProgressListener;

			this._callProgressListenerEvent(
				browser,
				"onStateChange",
				browser.webProgress,
				null,
				tab.progress && !this.isBusy
					? STATE_START | STATE_IS_NETWORK
					: STATE_STOP | STATE_IS_NETWORK,
				""
			);
		}
	},

	/**
	 * The global tabs collator element for this window
	 * @type {BrowserTabsCollator}
	 */
	get collator() {
		return this._win.document.querySelector("browser-tabs-collator");
	},

	get _tabpanelBoxEl() {
		return this._win.document.getElementById("tabspanel");
	},

	_draggingTab: null,

	/**
	 * The tab that is currently being dragged
	 * @type {BrowserTab}
	 */
	get draggingTab() {
		return this._draggingTab;
	},

	/**
	 * Updates the currently dragged tab
	 * @param {BrowserTab} tab
	 */
	set draggingTab(tab) {
		const oldTab = this._draggingTab;

		if (oldTab) {
			oldTab.removeAttribute("dragging");
		}

		if (tab && typeof tab !== "undefined") {
			tab.toggleAttribute("dragging", true);
		}

		this._draggingTab = tab;
	},

	/**
	 * The current browser that is being hovered over
	 *
	 * This value will not change until another browser is hovered on!
	 * Make sure the browser exists before reading or writing!
	 * @type {ChromeBrowser | null}
	 */
	hoveredBrowser: null,

	/**
	 * The maximum allowed width for a tab
	 */
	get tabMaxWidth() {
		return Services.prefs.getIntPref(kTabMaxWidthPref, 240);
	},

	/**
	 * The minimum allowed width for a tab
	 */
	get tabMinWidth() {
		return Services.prefs.getIntPref(kTabMinWidthPref, 70);
	},

	/**
	 * Initialises and creates the <tab> element
	 * @private
	 * @returns {BrowserTab}
	 */
	_createTabElement() {
		/** @type {BrowserTab} */
		// @ts-ignore
		const el = this._win.document.createXULElement("tab", {
			is: "browser-internal-tab"
		});

		el.id = this._generateUniqueTabID();

		return el;
	},

	/**
	 * Dispatches an event to the window.
	 * @param {string} type
	 * @param {CustomEventInit} options
	 */
	_dispatchWindowEvent(type, options) {
		this._dispatchElementEvent(this._win, type, options);
	},

	/**
	 * Dispatches an event to an element.
	 * @param {EventTarget} element
	 * @param {string} type
	 * @param {CustomEventInit} options
	 */
	_dispatchElementEvent(element, type, options) {
		const ev = new CustomEvent(type, options);

		element.dispatchEvent(ev);
	},

	/**
	 * Generates a unique ID to be used on the tab
	 */
	_generateUniqueTabID() {
		if (!this._uniqueTabIdCounter) {
			this._uniqueTabIdCounter = 0;
		}

		const { outerWindowID } = this._win.docShell;

		return `tab-${outerWindowID}-${++this._uniqueTabIdCounter}`;
	},

	/**
	 * Generates a unique ID to be used on the browser panel
	 */
	_generateUniquePanelID() {
		if (!this._uniquePanelIdCounter) {
			this._uniquePanelIdCounter = 0;
		}

		const { outerWindowID } = this._win.docShell;

		return `panel-${outerWindowID}-${++this._uniquePanelIdCounter}`;
	},

	/**
	 * Creates a new MozBrowser
	 *
	 * @param {object} options - Browser Options
	 * @param {boolean} [options.initiallyActive] - Determines whether the browser should be active when initialised
	 * @param {number} [options.userContextId] - Determines what user context (container) to use for this browser
	 * @param {any} [options.openWindowInfo] - Information relating to the opened window?
	 * @param {string} [options.name] - Controls the name of the opened window?
	 * @param {boolean} [options.uriIsAboutBlank] - Determines whether the URI is about:blank
	 * @param {boolean} [options.skipLoad] - Skips initial loading of about:blank
	 * @param {nsIURI} [options.uri] - The URI to load into the browser
	 * @param {string} [options.preferredRemoteType] - The preferred remote type to use when loading this browser
	 * @param {ChromeBrowser} [options.openerBrowser] - The existing browser element that opened this new browser
	 * @param {any} [options.referrerInfo] - Information relating to the referrer of this browser
	 * @param {boolean} [options.forceNotRemote] - Force a not remote state onto the browser
	 * @param {string} [options.initialBrowsingContextGroupId] - The initial browsing context group ID for this new browser
	 */
	_createBrowser(options) {
		if (!options.preferredRemoteType && options.openerBrowser) {
			options.preferredRemoteType = options.openerBrowser.remoteType;
		}

		const originAttributes = E10SUtils.predictOriginAttributes({
			window: this._win,
			userContextId: options.userContextId
		});

		const remoteType = options.forceNotRemote
			? E10SUtils.NOT_REMOTE
			: E10SUtils.getRemoteTypeForURI(
					options.uri.spec,
					this._win.gDot.isMultiProcess,
					this._win.gDot.usesRemoteSubframes,
					options.preferredRemoteType,
					null,
					originAttributes
			  );

		const browser = this._win.document.createXULElement("browser");

		browser.permanentKey = new (Cu.getGlobalForObject(Services).Object)();

		const attributes = {
			message: "true",
			messagemanagergroup: "browsers",
			type: "content"
		};

		for (const key in attributes) {
			browser.setAttribute(key, attributes[key]);
		}

		if (this._win.gDot.isMultiProcess)
			browser.setAttribute("maychangeremoteness", "true");

		if (remoteType) {
			browser.setAttribute("remoteType", remoteType);
			browser.setAttribute("remote", "true");
		}

		if (!options.initiallyActive) {
			browser.setAttribute("initiallyactive", "false");
		}

		if (options.userContextId) {
			browser.setAttribute(
				"usercontextid",
				options.userContextId.toString()
			);
		}

		if (options.openWindowInfo) {
			browser.openWindowInfo = options.openWindowInfo;
		}

		if (options.initialBrowsingContextGroupId) {
			browser.setAttribute(
				"initialBrowsingContextGroupId",
				options.initialBrowsingContextGroupId
			);
		}

		if (options.name) {
			browser.setAttribute("name", options.name);
		}

		if (!options.uriIsAboutBlank || options.skipLoad) {
			browser.setAttribute("nodefaultsrc", "true");
		}

		return browser;
	},

	/**
	 * Creates a new tab
	 *
	 * @param {object} options - Tab Options - most of these options aren't needed, but are here for the sake of compatibility
	 * @param {string} [options.uri] - The URI to load
	 * @param {ChromeBrowser | Element} [options.webContents] - The tab's webContents
	 * @param {any} options.triggeringPrincipal - The triggering principal to use for this tab
	 * @param {ChromeBrowser} [options.openerBrowser] - The browser that opened this new tab
	 * @param {string} [options.title] - The initial title to use for this tab
	 * @param {string} [options.preferredRemoteType] - The preferred remote type to use to load this page
	 * @param {number} [options.userContextId] - The user context ID (container) to use for this tab
	 * @param {boolean} [options.pinned] - Whether the tab should be pinned or not
	 * @param {number} [options.index] - Position of the tab in the tablist
	 * @param {any} [options.referrerInfo] - Information relating to the referrer of this browser
	 * @param {boolean} [options.forceNotRemote] - Force a not remote state onto the browser
	 * @param {any} [options.openWindowInfo] - Information relating to the opened window?
	 * @param {boolean} [options.inBackground] - Determines whether the tab should be opened in the background or foreground
	 * @param {any} [options.originPrincipal] - The origin principal used to load this tab
	 * @param {any} [options.originStoragePrincipal] - The origin storage principal used for this tab
	 * @param {boolean} [options.allowInheritPrincipal] - Whether the tab is allowed to inherit the principal
	 * @param {boolean} [options.skipLoad] - Skip loading anything into the tab
	 * @param {boolean} [options.allowThirdPartyFixup] - Allow transforming the url into a search query
	 * @param {string} [options.triggeringRemoteType] - The remoteType triggering this load
	 * @param {any} [options.csp] - The CSP that should apply to the load
	 * @param {object} [options.globalHistoryOptions] - Used by places to keep track of search related metadata for loads
	 * @param {boolean} [options.fromExternal] - Indicates the load was started outside of the browser, e.g. passed on the commandline or through OS mechanisms
	 * @param {boolean} [options.disableTRR] - Disables TRR for resolving host names
	 * @param {boolean} [options.forceAllowDataURI] - Allows for data: URI navigation
	 * @param {any} [options.postData] - The POST data to submit with the returned URI (see nsISearchSubmission).
	 * @param {string} [options.initialBrowsingContextGroupId] - The initial browsing context group ID to use for the browser.
	 */
	createTab(options) {
		if (!options.triggeringPrincipal) {
			throw new Error(
				"Required 'triggeringPrincipal' in createTab options."
			);
		}

		// If we happen to not have a uriString, default to about:blank
		if (!options.uri) {
			options.uri = "about:blank";
		}

		let uri;

		try {
			uri = Services.io.newURI(options.uri);
		} catch (e) {}

		const tabEl = this._createTabElement();

		const openerTab = options.openerBrowser
			? this.getTabForWebContents(options.openerBrowser)
			: null;

		// If this new tab was opened by another existing tab, make
		// sure we tell the new tab who opened this to dictate the
		// position/index of the tab in the tablist.
		if (openerTab) {
			tabEl._openerTab = openerTab;
		}

		// If we have an openerTab, we will want to pass the opener's
		// user context ID to the new tab to avoid leakage and maintain
		// containerisation across related tabs.
		if (options.userContextId == null && openerTab) {
			options.userContextId =
				parseInt(openerTab.getAttribute("usercontextid")) || 0;
		}

		if (options.userContextId) {
			tabEl.userContextId = options.userContextId;
		}

		if (options.pinned && options.pinned == true) {
			tabEl.pinned = true;
		}

		if (uri) {
			console.log("Setting initial URI to", uri);
			tabEl._initialURI = uri;
		}

		const uriIsAboutBlank = options.uri == "about:blank";

		// Wrap in a try-catch so we can recover in the event of an error
		try {
			// Insert the tab into its position in the tablist
			this.insertTabAt(tabEl, { index: options.index, openerTab });

			// If we didn't provide webContents when creating the tab,
			// we can build a browser element to swap in.
			if (!options.webContents) {
				const {
					openerBrowser,
					preferredRemoteType,
					referrerInfo,
					forceNotRemote,
					openWindowInfo
				} = options;

				options.webContents = this._createBrowser({
					uri,
					preferredRemoteType,
					openerBrowser,
					uriIsAboutBlank,
					referrerInfo,
					forceNotRemote,
					openWindowInfo
				});

				this.setInitialMetadata(tabEl, uri.spec);
			}

			this._insertTabWebContents(tabEl, options.webContents);

			tabEl.registerEventListeners();
			this._setupTabDragListeners();
		} catch (e) {
			console.error("Error while creating tab!");
			console.error(e);
			if (tabEl.webContentsPanel) {
				tabEl.webContentsPanel.remove();
			}
			tabEl.remove();
			// @todo: unload browser and listeners
			return null;
		}

		this._dispatchWindowEvent("BrowserTabs::TabCreate", {
			detail: tabEl
		});

		// We should only consider loading anything into the tab if the webContents are a browser element
		if (this._isWebContentsBrowserElement(tabEl.webContents)) {
			if (
				options.originPrincipal &&
				options.originStoragePrincipal &&
				options.uri
			) {
				// Unless we know for sure we're not inheriting principals,
				// force the about:blank viewer to have the right principal:
				if (
					!uri ||
					Services.io.getDynamicProtocolFlags(uri) &
						Ci.nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT
				) {
					/** @type {ChromeBrowser} */ (
						tabEl.webContents
					).createAboutBlankContentViewer(
						options.originPrincipal,
						options.originStoragePrincipal
					);
				}
			}

			if (
				(!uriIsAboutBlank || !options.allowInheritPrincipal) &&
				!options.skipLoad
			) {
				let flags = LOAD_FLAGS_NONE;
				if (options.allowThirdPartyFixup) {
					flags |=
						LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP |
						LOAD_FLAGS_FIXUP_SCHEME_TYPOS;
				}
				if (options.fromExternal) flags |= LOAD_FLAGS_FROM_EXTERNAL;
				if (!options.allowInheritPrincipal)
					flags |= LOAD_FLAGS_DISALLOW_INHERIT_PRINCIPAL;
				if (options.disableTRR) flags |= LOAD_FLAGS_DISABLE_TRR;
				if (options.forceAllowDataURI)
					flags |= LOAD_FLAGS_FORCE_ALLOW_DATA_URI;

				try {
					/** @type {ChromeBrowser} */ (
						tabEl.webContents
					).fixupAndLoadURIString(options.uri, {
						flags,
						triggeringPrincipal: options.triggeringPrincipal,
						referrerInfo: options.referrerInfo,
						postData: options.postData,
						csp: options.csp,
						globalHistoryOptions: options.globalHistoryOptions,
						triggeringRemoteType: options.triggeringRemoteType
					});
				} catch (e) {
					console.error("Failed to load URI into tab.");
					console.error(e);
				}
			}
		}

		if (!options.inBackground) {
			this.selectedTab = tabEl;
		}

		return tabEl;
	},

	/**
	 * Pushes a tab into a position in the tablist
	 * @param {BrowserTab} tab - The tab to insert
	 * @param {object} options
	 * @param {number} [options.index] - The index (position) to place the tab in the tablist
	 * @param {BrowserTab} [options.openerTab] - The tab that opened `tab`
	 */
	insertTabAt(tab, options) {
		let pos = options.index;

		if (!options.index && typeof options.index != "number") {
			// By default, we want to just send the tab to the end
			pos = Infinity;

			// If this tab was opened by another tab, we need to honour
			// the position of this tab instead of the index.
			if (options && options.openerTab) {
				// If the browser is configured to insert "related" tabs after the current one,
				// we will simply just add one to the openerTab's index.
				if (
					Services.prefs.getBoolPref(
						"browser.tabs.insertRelatedAfterCurrent"
					)
				) {
					pos = options.openerTab.index + 1;
				}
			}
		}

		if (!tab.pinned) {
			pos = clamp(pos, 0, this.list.length);
		}

		const tabAfter = this.list[pos] || null;
		this.collator.insertBefore(tab, tabAfter);
	},

	/**
	 * Update a tab's favicon
	 *
	 * @param {BrowserTab} tab
	 * @param {string} iconURI
	 */
	setIcon(tab, iconURI) {
		tab.updateIcon(iconURI);
	},

	/**
	 * Clear a tab's favicon
	 *
	 * @param {BrowserTab} tab
	 */
	clearIcon(tab) {
		tab.clearIcon();
	},

	/**
	 * Update a tab's title
	 *
	 * @param {BrowserTab} tab
	 * @param {string} title
	 */
	setTitle(tab, title) {
		tab.updateLabel(title);
	},

	/**
	 * Reloads a tab
	 * @param {BrowserTab} tab
	 * @param {boolean} [bypassCache]
	 */
	reloadTab(tab, bypassCache = false) {
		if (this._isWebContentsBrowserElement(tab.webContents)) {
			const { LOAD_FLAGS_NONE, LOAD_FLAGS_BYPASS_CACHE } =
				Ci.nsIWebNavigation;

			let flags = LOAD_FLAGS_NONE;

			if (bypassCache == true) {
				flags |= LOAD_FLAGS_BYPASS_CACHE;
			}

			/** @type {ChromeBrowser} */ (tab.webContents).reloadWithFlags(
				flags
			);
		}
	},

	/**
	 * Stops a tab from loading
	 * @param {BrowserTab} tab
	 */
	stopTab(tab) {
		if (this._isWebContentsBrowserElement(tab.webContents)) {
			const { STOP_ALL } = Ci.nsIWebNavigation;

			/** @type {ChromeBrowser} */ (tab.webContents).stop(STOP_ALL);
		}
	},

	/**
	 * Goes back for a tab
	 * @param {BrowserTab} tab
	 */
	goBack(tab) {
		if (this._isWebContentsBrowserElement(tab.webContents)) {
			/** @type {ChromeBrowser} */ (tab.webContents).goBack();
		}
	},

	/**
	 * Goes forward for a tab
	 * @param {BrowserTab} tab
	 */
	goForward(tab) {
		if (this._isWebContentsBrowserElement(tab.webContents)) {
			/** @type {ChromeBrowser} */ (tab.webContents).goForward();
		}
	},

	/**
	 * Sets the initial metadata of a tab to avoid preloading
	 * @param {BrowserTab} tab
	 * @param {string} uri
	 */
	setInitialMetadata(tab, uri) {
		if (uri && uri in BrowserTabsUtils.INTERNAL_PAGES) {
			const data = BrowserTabsUtils.INTERNAL_PAGES[uri];

			this.setIcon(tab, data.icon);
			this.setTitle(tab, data.title);
		}
	},

	/**
	 * Creates multiple tabs
	 * @param {string[]} uris
	 * @param {object} options
	 * @params {boolean} [options.replaceInitialTab] - Determines whether we are allowed to replace the initial tab with the first URI in the list.
	 */
	createTabs(uris, options) {
		let tabOptions = {
			...options
		};

		// We want to handle this ourselves, rather than
		// update each tab's active state one by one
		tabOptions.inBackground = true;

		let initialTab;

		if (tabOptions.replaceInitialTab && this.selectedTab) {
			initialTab = this.selectedTab;

			this.setInitialMetadata(initialTab, uris[0]);

			const browser = /** @type {ChromeBrowser} */ (
				initialTab.webContents
			);

			let flags = LOAD_FLAGS_NONE;
			if (tabOptions.allowThirdPartyFixup) {
				flags |=
					LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP |
					LOAD_FLAGS_FIXUP_SCHEME_TYPOS;
			}
			if (tabOptions.fromExternal) flags |= LOAD_FLAGS_FROM_EXTERNAL;
			if (!tabOptions.allowInheritPrincipal)
				flags |= LOAD_FLAGS_DISALLOW_INHERIT_PRINCIPAL;
			if (tabOptions.disableTRR) flags |= LOAD_FLAGS_DISABLE_TRR;
			if (tabOptions.forceAllowDataURI)
				flags |= LOAD_FLAGS_FORCE_ALLOW_DATA_URI;

			if (this._isWebContentsBrowserElement(browser)) {
				try {
					browser.fixupAndLoadURIString(uris[0], {
						...tabOptions,
						flags,
						postData:
							tabOptions.postDatas && tabOptions.postDatas[0]
					});
				} catch (e) {
					console.error("Failed to load URI into initial tab", e);
				}
			}
		} else {
			initialTab = this.createTab({
				...tabOptions,
				postData: tabOptions.postDatas && tabOptions.postDatas[0],
				uri: uris[0]
			});
		}

		for (let i = 1; i < uris.length; i++) {
			const uri = uris[i];

			this.createTab({
				...tabOptions,
				postData: tabOptions.postDatas && tabOptions.postDatas[i],
				uri
			});
		}

		if (!options.inBackground) {
			this.selectedTab = initialTab;
		}
	},

	/**
	 * Determines whether a webContents is a browser element
	 * @param {any} webContents
	 * @returns {boolean}
	 */
	_isWebContentsBrowserElement(webContents) {
		return (
			webContents.constructor.name == "MozBrowser" &&
			webContents.browserId
		);
	},

	/**
	 * Inserts the webContents into the tab panel area
	 * @param {BrowserTab} tab
	 * @param {Element} webContents
	 */
	_insertTabWebContents(tab, webContents) {
		tab.webContents = webContents;

		const panel = this._win.document.createElement("browser-panel");
		const panelId = this._generateUniquePanelID();
		panel.id = panelId;

		const frame = this._win.document.createElement("browser-frame");

		tab.webContents.classList.add("browser-web-contents");
		frame.appendChild(tab.webContents);
		tab._webContentsPanelId = panelId;

		panel.appendChild(frame);
		this._tabpanelBoxEl.appendChild(panel);

		if (this._isWebContentsBrowserElement(tab.webContents)) {
			const progressListener = new TabProgressListener(
				tab,
				/** @type {ChromeBrowser} */ (tab.webContents)
			);

			const filter = Cc[
				"@mozilla.org/appshell/component/browser-status-filter;1"
			].createInstance(Ci.nsIWebProgress);

			const { NOTIFY_ALL } = Ci.nsIWebProgress;

			filter.addProgressListener(progressListener, NOTIFY_ALL);

			/** @type {ChromeBrowser} */ (
				webContents
			).webProgress.addProgressListener(filter, NOTIFY_ALL);

			this._tabListeners.set(tab, progressListener);
			this._tabFilters.set(tab, filter);
		}

		/** @type {ChromeBrowser} */ (tab.webContents).droppedLinkHandler =
			this.onBrowserDroppedLink.bind(this, tab.webContents);

		/** @type {ChromeBrowser} */ (tab.webContents).loadURI =
			NavigationHelper.loadURI.bind(NavigationHelper, tab.webContents);

		/** @type {ChromeBrowser} */ (tab.webContents).fixupAndLoadURIString =
			NavigationHelper.fixupAndLoadURIString.bind(
				NavigationHelper,
				tab.webContents
			);

		// If we transitioned from one browser to two browsers, we need to set
		// hasSiblings=false on both the existing browser and the new browser.
		// @todo(EnderDev) What does this mean?
		if (this.list.length == 2) {
			if (this._isWebContentsBrowserElement(this.list[0].webContents)) {
				/** @type {ChromeBrowser} */ (
					this.list[0].webContents
				).browsingContext.hasSiblings = true;
			}

			if (this._isWebContentsBrowserElement(this.list[1].webContents)) {
				/** @type {ChromeBrowser} */ (
					this.list[1].webContents
				).browsingContext.hasSiblings = true;
			}
		} else if (this._isWebContentsBrowserElement(tab.webContents)) {
			/** @type {ChromeBrowser} */ (
				tab.webContents
			).browsingContext.hasSiblings = this.list.length > 1;
		}

		if (tab.userContextId) {
			tab.webContents.setAttribute("usercontextid", tab.userContextId);
		}

		if (this._isWebContentsBrowserElement(tab.webContents)) {
			/** @type {ChromeBrowser} */ (
				tab.webContents
			).browsingContext.isAppTab = tab.pinned;
		}
	},

	/**
	 * Creates a browser for the initial load
	 *
	 * We need a tab to exist right as we boot the browser so we can adopt
	 * tabs in window.arguments or have a browser ready for popup windows.
	 */
	_setupInitialBrowser() {
		const args = this._win.arguments;

		// Get the userContextId from args if we have it
		let userContextId = args && args[5];

		let openWindowInfo = this._win.docShell.treeOwner
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIAppWindow).initialOpenWindowInfo;

		// If we have provided openWindowInfo as an argument, use that instead
		if (!openWindowInfo && args && args[11]) {
			openWindowInfo = args[11];
		}

		// If we are providing a tab for adoption, make sure this is used
		const adoptedTab = this._win.gDotInit.getTabToAdopt();

		// If the adopted tab has a userContextId, we can use that instead
		if (adoptedTab && adoptedTab.hasAttribute("usercontextid")) {
			userContextId = parseInt(
				adoptedTab.getAttribute("usercontextid"),
				10
			);
		}

		let remoteType;
		let initialBrowsingContextGroupId;

		// If we have an adoptedTab and it has a <browser> type webContents
		// Make sure we inherit the remoteType and browsing context group ID.
		if (
			adoptedTab &&
			adoptedTab.webContents &&
			this._isWebContentsBrowserElement(adoptedTab)
		) {
			remoteType = adoptedTab.linkedBrowser.remoteType;
			initialBrowsingContextGroupId =
				adoptedTab.linkedBrowser.browsingContext?.group.id;
		} else if (openWindowInfo) {
			// If we have openWindowInfo, inherit the userContextId from that
			userContextId = openWindowInfo.originAttributes.userContextId;

			// And, if we're remote, make sure we are using the correct remoteType
			if (openWindowInfo.isRemote) {
				remoteType = E10SUtils.DEFAULT_REMOTE_TYPE;
			} else {
				remoteType = E10SUtils.NOT_REMOTE;
			}
		} else {
			let uriToLoad = this._win.gDotInit.uriToLoadPromise;
			// If we have a URI to load, we only need the first item
			if (uriToLoad && Array.isArray(uriToLoad)) {
				uriToLoad = uriToLoad[0];
			}

			// Check if our URI is a string
			if (uriToLoad && typeof uriToLoad == "string") {
				console.log("URI to load is a string", uriToLoad);

				const oa = E10SUtils.predictOriginAttributes({
					window: this._win,
					userContextId
				});

				console.log("origin attributes", oa);

				remoteType = E10SUtils.getRemoteTypeForURI(
					uriToLoad,
					this._win.gDot.isMultiProcess,
					this._win.gDot.usesRemoteSubframes,
					E10SUtils.DEFAULT_REMOTE_TYPE,
					null,
					oa
				);

				console.log("Using", remoteType, "as URI to load remote type");
			} else {
				// If the URI doesn't exist or isn't a string, we can assume
				// it's probably still a promise, since uriToLoadPromise returns
				// a promise waiting to be resolved

				// In this case, we need to assume that the browser will be null
				// Our best guess for the remoteType would be a privilaged about
				// process, which we can use for the time being.
				remoteType = E10SUtils.PRIVILEGEDABOUT_REMOTE_TYPE;
			}
		}
		const triggeringPrincipal =
			Services.scriptSecurityManager.createNullPrincipal({
				userContextId
			});

		this.createTab({
			uri: "about:blank",
			inBackground: false,
			userContextId,
			initialBrowsingContextGroupId,
			preferredRemoteType: remoteType,
			openWindowInfo,
			triggeringPrincipal
		});
	},

	/**
	 * Calls a progress listener's event handler with arguments
	 * @param {ChromeBrowser} browser
	 * @param {string} name
	 * @param {any[]} args
	 */
	_callProgressListenerEvent(browser, name, ...args) {
		const tab = this.getTabForWebContents(browser);

		if (!tab) {
			throw new Error(
				`No tab for browser with ID '${browser.browserId}'.`
			);
		}

		const listener = this._tabListeners.get(tab);

		if (!listener) {
			throw new Error(`No listener for tab with ID '${tab.id}'.`);
		}

		console.log("Dispatched", name, args);

		switch (name) {
			case "onLocationChange":
				listener.onLocationChange.call(listener, ...args);
				break;
			case "onProgressChange":
				listener.onProgressChange.call(listener, ...args);
				break;
			case "onSecurityChange":
				listener.onSecurityChange.call(listener, ...args);
				break;
			case "onStateChange":
				listener.onStateChange.call(listener, ...args);
				break;
			case "onStatusChange":
				listener.onStatusChange.call(listener, ...args);
				break;
			default:
				throw new Error(
					`No progress listener handler for event '${name}'.`
				);
		}
	},

	/**
	 * Fetches an open tab by its tab ID
	 * @param {string} id
	 * @returns {BrowserTab | null}
	 */
	getTabByTabId(id) {
		return this.collator.querySelector(`#tab-${id}`);
	},

	/**
	 * Gets the ID from a webContents
	 * @param {any} webContents
	 * @returns {number}
	 */
	_getWebContentsId(webContents) {
		if (
			ChromeUtils.getClassName(webContents) == "XULFrameElement" &&
			webContents.browserId
		) {
			return webContents.browserId;
		}

		return parseInt(webContents.id);
	},

	/**
	 * Handles incoming tab drag events
	 * @param {MouseEvent} event
	 */
	_onHandleTabDragEvent(event) {
		const target = /** @type {HTMLElement} */ (event.target);
		const tab = /** @type {BrowserTab} */ (
			target &&
				target.nodeType == Node.ELEMENT_NODE &&
				target.closest("tab")
		);

		if (tab) {
			switch (event.type) {
				case "mousedown":
					this.draggingTab = tab;
					this.draggingTab.initialDragX = event.x;
					break;
			}
		}

		switch (event.type) {
			case "mouseup":
				if (this.draggingTab) {
					this.draggingTab.style.removeProperty("translate");
					this.draggingTab = null;
				}
				break;
			case "mousemove":
				if (this.draggingTab) {
					const zero =
						this.draggingTab.parentElement.getBoundingClientRect()
							.x;
					const relativeX =
						zero + (event.x - this.draggingTab.initialDragX);
					const translateX = Math.max(relativeX - zero, zero);

					// console.log(relativeX, this.draggingTab.getBoundingClientRect().width, translateX, this.draggingTab.initialDragX);
					if (relativeX < translateX) {
						this.draggingTab.initialDragX = event.x;
						return;
					}

					if (event.x < zero) {
						this.draggingTab.initialDragX =
							this.draggingTab.getBoundingClientRect().x;
						return;
					}

					if (event.x < zero || relativeX < zero) return;

					this.draggingTab.style.translate = `${relativeX - zero}px`;
				}
				break;
		}

		this._win.document.documentElement.classList.toggle(
			"auxiliary-dragging",
			this.draggingTab &&
				this.draggingTab.constructor.name == "BrowserTab"
		);
	},

	_tabDragListenersInit: false,

	/**
	 * Initialises the tab dragging event listeners
	 */
	_setupTabDragListeners() {
		if (this._tabDragListenersInit) return;

		this._win.addEventListener(
			"mousemove",
			this._onHandleTabDragEvent.bind(this)
		);
		this._win.addEventListener(
			"mouseup",
			this._onHandleTabDragEvent.bind(this)
		);
		this._win.addEventListener(
			"mousedown",
			this._onHandleTabDragEvent.bind(this)
		);

		this._tabDragListenersInit = true;
	},

	/**
	 * Discards a tab and its contents
	 * @param {BrowserTab} tab
	 */
	_discardTab(tab) {
		if (this._isWebContentsBrowserElement(tab.webContents)) {
			const filter = this._tabFilters.get(tab);
			const listener = this._tabListeners.get(tab);

			/** @type {ChromeBrowser} */ (
				tab.webContents
			).webProgress.removeProgressListener(/** @type {any} */ (filter));
			filter.removeProgressListener(listener);

			this._tabListeners.delete(tab);
			this._tabFilters.delete(tab);

			/** @type {ChromeBrowser} */ (tab.webContents).destroy();
		}

		tab.webContentsPanel.remove();

		tab.remove();
	},

	/**
	 * Updates the window's title based on the selectedTab's title
	 */
	shouldUpdateWindowTitle() {
		const doc = this._win.document.documentElement;
		const tab = this.selectedTab;
		let title = "";

		// If we happen to encounter a situation where chrome and
		// URL bar is hidden, we will need to make sure the URL is
		// visible in some form prevent spoofing or phishing,
		// especially from untrusted sources like extensions.
		if (
			doc.hasAttribute("chromehidden") &&
			doc.getAttribute("chromehidden").includes("location")
		) {
			if (this._isWebContentsBrowserElement(tab.webContents)) {
				const uri = Services.io.createExposableURI(
					/** @type {ChromeBrowser} */ (tab.webContents).currentURI
				);

				switch (uri.scheme) {
					case "about":
						title += `${uri.spec}: `;
						break;
					case "moz-extension":
						const ext = WebExtensionPolicy.getByHostname(uri.host);

						if (ext && ext.name) {
							title += `${ext.name}: `;
						}
						break;
				}
			}
		}

		if (tab.getAttribute("label")) {
			// Strip out any null bytes in the content title, since the
			// underlying widget implementations of nsWindow::SetTitle pass
			// null-terminated strings to system APIs.
			title += tab.getAttribute("label").replace(/\0/g, "");
		}

		const dataSuffix =
			doc.getAttribute("privatebrowsingmode") == "temporary"
				? "Private"
				: "Default";

		this._win.document.title =
			title && title.trim().length
				? doc.dataset["contentTitle" + dataSuffix].replace(
						"CONTENTTITLE",
						() => title
				  )
				: doc.dataset["title" + dataSuffix];
	},

	/**
	 * Find a tab using its webContents
	 * @param {ChromeBrowser | Element} webContents
	 */
	getTabForWebContents(webContents) {
		const id = this._getWebContentsId(webContents);
		const idType = this._isWebContentsBrowserElement(webContents)
			? "browserId"
			: "id";

		return this.list.find((tab) => tab.webContents[idType] == id);
	},

	/**
	 * Fired when a link is dropped onto the browser contents
	 *
	 * This function is overloaded:
	 * browser, uris, name, triggeringPrincipal
	 * browser, uris, triggeringPrincipal
	 * @param {ChromeBrowser} browser
	 * @param {string | { url: string, nameOrTriggeringPrincipal: any, type: string }[]} uris
	 * @param {any} nameOrTriggeringPrincipal
	 * @param {any} triggeringPrincipal
	 */
	onBrowserDroppedLink(
		browser,
		uris,
		nameOrTriggeringPrincipal,
		triggeringPrincipal
	) {
		console.log(
			"onBrowserDroppedLink",
			browser,
			uris,
			nameOrTriggeringPrincipal,
			triggeringPrincipal
		);
	},

	/**
	 * Events for BrowserTabs
	 * @param {Event} event
	 */
	handleEvent(event) {
		switch (event.type) {
			case "visabilitychange":
				if (
					this._isWebContentsBrowserElement(
						this.selectedTab.webContents
					)
				) {
					/** @type {ChromeBrowser} */ (
						this.selectedTab.webContents
					).preserveLayers(document.hidden);
					/** @type {ChromeBrowser} */ (
						this.selectedTab.webContents
					).docShellIsActive = !document.hidden;
				}
				break;
			case "mousemove": {
				const el = this._win.document.elementFromPoint(
					/** @type {MouseEvent} */ (event).clientX,
					/** @type {MouseEvent} */ (event).clientY
				);

				const hoveredBrowser =
					el && this._isWebContentsBrowserElement(el)
						? /** @type {ChromeBrowser} */ (el)
						: null;

				if (hoveredBrowser && this.hoveredBrowser !== hoveredBrowser) {
					this.hoveredBrowser = hoveredBrowser;
				}

				break;
			}
		}
	},

	/**
	 * Initialises the BrowserTabs
	 * @param {Window} win
	 */
	init(win) {
		this._win = win;

		this._win.MozXULElement.insertFTLIfNeeded("dot/tabs.ftl");

		this._win.addEventListener("visabilitychange", this);
		this._win.addEventListener("mousemove", this);

		this._setupInitialBrowser();
	},

	destroy() {
		if (!this._win) throw new Error("BrowserTabs is not initted yet!");

		this._win.removeEventListener("visabilitychange", this);
	}
};
