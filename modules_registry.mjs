/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Modules registry used to define the origin file for typing modules imported using Cu.
 */
const registry = {
	DotCustomizableUI: "components/customizableui/DotCustomizableUI.sys.mjs",
	DotWindowTracker: "modules/DotWindowTracker.sys.mjs",
	BrowserCompatibility: "components/compat/BrowserCompatibility.sys.mjs",
	BrowserTabs: "components/tabs/BrowserTabs.sys.mjs",
	BrowserTabsUtils: "components/tabs/BrowserTabsUtils.sys.mjs",
	BrowserSearch: "components/search/BrowserSearch.sys.mjs",
	NativeTitlebar: "components/csd/NativeTitlebar.sys.mjs",
	NavigationHelper: "components/navigation/NavigationHelper.sys.mjs",
	ModifierKeyManager: "components/keyboard/ModifierKeyManager.sys.mjs",
	StartPage: "components/startpage/StartPage.sys.mjs",
	TabIdentityHandler: "components/tabs/TabIdentityHandler.sys.mjs",
	TabProgressListener: "components/tabs/TabProgressListener.sys.mjs"
};

export default registry;
