/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class ActionsIPC {
	ACTIONS_DISPATCH_EVENT = "Actions::Dispatch";

	/** @type {ReturnType<typeof BrowserCustomizableContextMixin<typeof Element>>["prototype"]} */
	area = null;

	/** @param {ReturnType<typeof BrowserCustomizableContextMixin<typeof Element>>["prototype"]} area */
	constructor(area) {
		this.area = area;
	}
}
