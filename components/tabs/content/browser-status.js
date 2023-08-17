/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class BrowserStatus extends MozHTMLElement {
    constructor() {
        super();
    }

    static get observedAttributes() {
        return [
            "side"
        ];
    }

    get webContents() {
        // Get the closest browser webContents
        // We only want browser elements as other webContents won't be firing status changes
        return this.closest("browser-panel").querySelector("browser.browser-web-contents");
    }

    get label() {
        return this.querySelector(".browser-status-label");
    }

    connectedCallback() {
        if (this.delayConnectedCallback()) return;

        this.toggleAttribute("inactive", true);
        this.setAttribute("statustype", "");
        this.setAttribute("side", "left");

        this.appendChild(html("span", { class: "browser-status-label" }));

        this.webContents.addEventListener("BrowserTabs::BrowserStatusChange", this);
        document.addEventListener("BrowserTabs::TabSelect", this);
    }

    disconnectedCallback() {
        if (this.delayConnectedCallback()) return;

        this.webContents.removeEventListener("BrowserTabs::BrowserStatusChange", this);
        document.removeEventListener("BrowserTabs::TabSelect", this);
    }

    /**
     * Fired when the status changes for this browser
     * @param {object} status
     * @param {string} status.message
     * @param {"busy" | "overLink"} status.type
     */
    onStatusChanged(status) {
        if (status.message.length) this.label.textContent = status.message;

        let inactive = true;

        if (status.type == "busy") {
            inactive = !gDot.tabs.isBusy;
        } else if (status.type == "overLink") {
            inactive = false;
        }

        this.setAttribute("statustype", status.type);
        this.toggleAttribute("inactive", status.message.length ? inactive : true);
    }

    /**
     * Fired when the active tab is changed
     * @param {BrowserTab} tab 
     */
    onActiveTabChanged(tab) {
        // The tab change wasn't for our linked browser, so we can safely ignore this
        if (tab.webContents !== this.webContents) return;

        this.toggleAttribute("inactive", true);
    }

    /**
     * Handles incoming events to the BrowserStatus element
     * @param {CustomEvent} event 
     */
    handleEvent(event) {
        switch (event.type) {
            case "BrowserTabs::BrowserStatusChange":
                this.onStatusChanged(event.detail);
                break;
            case "BrowserTabs::TabSelect":
                this.onActiveTabChanged(event.detail);
                break;
        }
    }
}

customElements.define("browser-status", BrowserStatus);