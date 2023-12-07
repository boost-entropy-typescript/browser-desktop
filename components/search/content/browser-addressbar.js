/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class BrowserAddressBar extends BrowserCustomizableArea {
	constructor() {
		super();
	}

	/**
	 * The context for this tab
	 */
	get context() {
		const self = this;

		return {
			self,
			audience: "addressbar",

			get window() {
				return self.ownerGlobal;
			},

			get tab() {
				return self.ownerGlobal.gDot.tabs.selectedTab;
			},

			get browser() {
				return this.tab.linkedBrowser;
			}
		};
	}

	handleEvent(event) {}

	connectedCallback() {
		super.connect("addressbar", {
			orientation: "horizontal"
		});

		window.addEventListener("BrowserTabs::BrowserLocationChange", this);
		window.addEventListener("BrowserTabs::TabSelect", this);
	}

	disconnectedCallback() {
		window.removeEventListener("BrowserTabs::BrowserLocationChange", this);
		window.removeEventListener("BrowserTabs::TabSelect", this);
	}
}

customElements.define("browser-addressbar", BrowserAddressBar);
