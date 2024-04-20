/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { ContentDOMReference } = ChromeUtils.importESModule(
	"resource://gre/modules/ContentDOMReference.sys.mjs"
);

export class DotContextMenuParent extends JSWindowActorParent {
	/**
	 * Handles incoming messages to the context menu parent
	 * @param {import("third_party/dothq/gecko-types/lib").ReceiveMessageArgument} message
	 */
	receiveMessage(message) {
		// Attempt to resolve the target in the event,
		// otherwise, check if we're inside a browser,
		// otehrwise, use the top chrome window.
		const target = /** @type {Element} */ (
			ContentDOMReference.resolve(message.data.target) ||
				this.browsingContext.embedderElement ||
				this.browsingContext.topChromeWindow
		);

		const win = target.ownerGlobal;
		const doc = target.ownerDocument;

		console.log("ParentReceive", target, message.data.context);

		const menuEvent = new /** @type {any} */ (win).CustomEvent(
			"ContextMenu::Launch",
			{
				detail: message.data,
				composed: true,
				bubbles: true
			}
		);

		console.log("ParentSend", target, menuEvent);

		target.dispatchEvent(menuEvent);

	}
}
