/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @template T
 * @typedef {new(...args: any[]) => T} Constructor
 **/

/**
 * Creates a BrowserContextualElement
 *
 * @template {Constructor<Element>} T - The base class constructor.
 * @param {T} BaseClass - The base class to extend.
 */
function BrowserContextualMixin(BaseClass) {
	const BrowserContextualElement = class extends BaseClass {
		/**
		 * The host element for this element
		 * @type {Element}
		 */
		get host() {
			return /** @type {ShadowRoot} */ (this.getRootNode()).host;
		}
	};

	return BrowserContextualElement;
}
