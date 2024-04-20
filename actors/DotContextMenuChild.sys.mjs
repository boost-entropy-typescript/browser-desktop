/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { ContentDOMReference } = ChromeUtils.importESModule(
	"resource://gre/modules/ContentDOMReference.sys.mjs"
);

const { DOMUtils } = ChromeUtils.importESModule(
	"resource://gre/modules/DOMUtils.sys.mjs"
);

const { BrowserCustomizableShared } = ChromeUtils.importESModule(
	"resource://gre/modules/BrowserCustomizableShared.sys.mjs"
);

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

export class DotContextMenuChild extends JSWindowActorChild {
	/**
	 * Creates a new context object
	 * @param {Event} event
	 * @param {Node} target
	 */
	createContext(event, target) {
		return {};
	}

	/**
	 * Fired when a context menu is requested via the contextmenu DOM event
	 * @param {MouseEvent} event
	 */
	#onContextMenuRequest(event) {
		let { defaultPrevented } = event;

		const composedTarget = /** @type {Element} */ (event.composedTarget);

		// Ignore contextmenu events on a chrome browser, as we'll
		// handle the contextmenu event from inside the child content.
		if (
			composedTarget.namespaceURI == XUL_NS &&
			composedTarget.tagName == "browser"
		)
			return;

		if (
			// If the event originated from a non-chrome document
			// and we have disabled the contextmenu event, ensure
			// our context menu cannot be prevented.
			!composedTarget.nodePrincipal.isSystemPrincipal &&
			!Services.prefs.getBoolPref("dom.event.contextmenu.enabled")
		) {
			defaultPrevented = false;
		}

		if (defaultPrevented) return;

		const context = this.createContext(event, composedTarget);

		console.log("ChildSend", composedTarget, context);

		this.sendAsyncMessage("contextmenu", {
			target: ContentDOMReference.get(composedTarget),

			screenX: event.screenX,
			screenY: event.screenY,

			context
		});
	}

	/**
	 * Fetches the context menu targets for an event
	 * @param {Event} event
	 * @returns {Set<Element>}
	 */
	#getEventContextMenuTargets(event) {
		const eventBubblePath = /** @type {Element[]} */ (event.composedPath());

		const contextMenuTargets = new Set();

		for (const node of eventBubblePath) {
			// Checks if the node is actually an element
			if (!node || !node.getAttribute) continue;

			// If we bubble through an element without a contextmenu,
			// continue to the next element in the bubble path.
			const contextMenuId = node.getAttribute("contextmenu");
			if (!contextMenuId) continue;

			// Checks whether it bubbles through a customizable area implementation
			const implementsContext =
				BrowserCustomizableShared.isCustomizableAreaImplementation(
					node
				);

			/** @type {import("third_party/dothq/gecko-types/lib").XULPopupElement} */
			let contextMenu = null;

			if (contextMenuId && contextMenuId.length) {
				// if contextMenu == _child, look for first <menupopup> child
				if (contextMenuId == "_child") {
					contextMenu = node.querySelector("menupopup");
				} else {
					const contextMenuEl =
						node.ownerDocument.getElementById(contextMenuId);

					if (contextMenuEl) {
						if (contextMenuEl.tagName == "menupopup") {
							contextMenu =
								/** @type {import("third_party/dothq/gecko-types/lib").XULPopupElement} */ (
									contextMenuEl
								);
						}
					}
				}
			}

			if (!contextMenu) continue;

			contextMenuTargets.add(contextMenu);

			// If we hit a non-contextual element, like a button, stop iterating
			// as we cannot inherit any more items from further up in the bubble path.
			if (!implementsContext) {
				break;
			}
		}

		return contextMenuTargets;
	}

	/**
	 * Fired when a context menu is launched
	 * @param {CustomEvent<{ context: Record<string, any>; screenX: number; screenY: number }>} event
	 */
	#onContextMenuLaunch(event) {
		const { screenX, screenY } = event.detail;

		const target = /** @type {Node} */ (event.composedTarget);

		const contextMenuTargets = this.#getEventContextMenuTargets(event);
		if (!contextMenuTargets.size) return;

		const contextMenuItems = Array.from(contextMenuTargets.values())
			.map((t) => Array.from(t.childNodes))
			.reduce((prev, curr) => (prev || []).concat(curr))
			.map((i) => i.cloneNode(true));

		const contextMenu =
			/** @type {import("third_party/dothq/gecko-types/lib").XULPopupElement} */ (
				target.ownerDocument.getElementById(
					"constructed-context-menu"
				) || target.ownerDocument.createXULElement("menupopup")
			);

		contextMenu.id = "constructed-context-menu";
		contextMenu.replaceChildren(...contextMenuItems);

		if (!contextMenu.parentElement) {
			target.ownerDocument
				.querySelector("popupset")
				.appendChild(contextMenu);
		}
		contextMenu.openPopupAtScreen(screenX, screenY, true, event);

		console.log("ChildReceive", target, contextMenuItems);
	}

	/**
	 * Handles incoming events to the context menu child
	 * @param {Event} event
	 */
	handleEvent(event) {
		switch (event.type) {
			case "contextmenu": {
				this.#onContextMenuRequest(/** @type {MouseEvent} */ (event));
				break;
			}
			case "ContextMenu::Launch": {
				this.#onContextMenuLaunch(/** @type {CustomEvent} */ (event));
				break;
			}
		}
	}
}
