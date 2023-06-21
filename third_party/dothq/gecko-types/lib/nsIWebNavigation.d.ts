/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsIURI } from "components/tabs/BrowserTabs.sys.mjs";

export interface LoadURIOptions {
	/**
	 * The principal that initiated the load.
	 */
	triggeringPrincipal: any /* @todo nsIPrincipal */;

	/**
	 * The CSP to be used for the load. That is *not* the CSP that will
	 * be applied to subresource loads within that document but the CSP
	 * for the document load itself. E.g. if that CSP includes
	 * upgrade-insecure-requests, then the new top-level load will
	 * be upgraded to HTTPS.
	 */
	csp?: any /* @todo ContentSecurityPolicy */;

	/**
	 * Flags modifying load behaviour.  This parameter is a bitwise
	 * combination of the load flags defined in nsIWebNavigation.idl.
	 */
	loadFlags: number;

	/**
	 * The referring info of the load.  If this argument is null, then the
	 * referrer URI and referrer policy will be inferred internally.
	 */
	referrerInfo?: any /* @todo ReferrerInfo */;

	/**
	 * If the URI to be loaded corresponds to a HTTP request, then this stream is
	 * appended directly to the HTTP request headers.  It may be prefixed
	 * with additional HTTP headers.  This stream must contain a "\r\n"
	 * sequence separating any HTTP headers from the HTTP request body.
	 */
	postData?: any /* @todo InputStream */;

	/**
	 * If the URI corresponds to a HTTP request, then any HTTP headers
	 * contained in this stream are set on the HTTP request.  The HTTP
	 * header stream is formatted as:
	 *     ( HEADER "\r\n" )*
	 */
	headers?: any /* @todo InputStream */;

	/**
	 * Set to indicate a base URI to be associated with the load. Note
	 * that at present this argument is only used with view-source aURIs
	 * and cannot be used to resolve aURI.
	 */
	baseURI?: nsIURI;

	/**
	 * Set to indicate that the URI to be loaded was triggered by a user
	 * action. (Mostly used in the context of Sec-Fetch-User).
	 */
	hasValidUserGestureActivation: boolean;

	/**
	 * The SandboxFlags of the entity thats
	 * responsible for causing the load.
	 */
	triggeringSandboxFlags: number;

	/**
	 * The RemoteType of the entity that's responsible for the load. Defaults to
	 * the current process.
	 *
	 * When starting a load in a content process, `triggeringRemoteType` must be
	 * either unset, or match the current remote type.
	 */
	triggeringRemoteType?: string;

	/**
	 * If non-0, a value to pass to nsIDocShell::setCancelContentJSEpoch
	 * when initiating the load.
	 */
	cancelContentJSEpoch: number;

	/**
	 * If this is passed, it will control which remote type is used to finish this
	 * load. Ignored for non-`about:` loads.
	 *
	 * NOTE: This is _NOT_ defaulted to `null`, as `null` is the value for
	 * `NOT_REMOTE_TYPE`, and we need to determine the difference between no
	 * `remoteTypeOverride` and a `remoteTypeOverride` of `NOT_REMOTE_TYPE`.
	 */
	remoteTypeOverride?: string;

    [key: string]: any;
}

export interface nsIWebNavigation {
	/**
	 * Indicates if the object can go back.  If true this indicates that
	 * there is back session history available for navigation.
	 */
	readonly canGoBack: boolean;

	/**
	 * Indicates if the object can go forward.  If true this indicates that
	 * there is forward session history available for navigation
	 */
	readonly canGoForward: boolean;

	/**
	 * Tells the object to navigate to the previous session history item.  When a
	 * page is loaded from session history, all content is loaded from the cache
	 * (if available) and page state (such as form values and scroll position) is
	 * restored.
	 *
	 * @param {boolean} requireUserInteraction
	 *        Tells goBack to skip history items that did not record any user
	 *        interaction on their corresponding document while they were active.
	 *        This means in case of multiple entries mapping to the same document,
	 *        each entry has to have been flagged with user interaction separately.
	 *        If no items have user interaction, the function will fall back
	 *        to the first session history entry.
	 *
	 * @param {boolean} userActivation
	 *        Tells goBack that the call was triggered by a user action (e.g.:
	 *        The user clicked the back button).
	 *
	 * @throw NS_ERROR_UNEXPECTED
	 *        Indicates that the call was unexpected at this time, which implies
	 *        that canGoBack is false.
	 */
	goBack(
		requireUserInteraction?: boolean,
		userActivation?: boolean
	);

	/**
	 * Tells the object to navigate to the next session history item.  When a
	 * page is loaded from session history, all content is loaded from the cache
	 * (if available) and page state (such as form values and scroll position) is
	 * restored.
	 *
	 * @param {boolean} requireUserInteraction
	 *        Tells goForward to skip history items that did not record any user
	 *        interaction on their corresponding document while they were active.
	 *        This means in case of multiple entries mapping to the same document,
	 *        each entry has to have been flagged with user interaction separately.
	 *        If no items have user interaction, the function will fall back
	 *        to the latest session history entry.
	 *
	 * @param {boolean} userActivation
	 *        Tells goForward that the call was triggered by a user action (e.g.:
	 *        The user clicked the forward button).
	 *
	 * @throw NS_ERROR_UNEXPECTED
	 *        Indicates that the call was unexpected at this time, which implies
	 *        that canGoForward is false.
	 */
	goForward(
		requireUserInteraction?: boolean,
		userActivation?: boolean
	);

	/**
	 * Tells the object to navigate to the session history item at a given index.
	 *
	 * @param {boolean} userActivation
	 *        Tells goForward that the call was triggered by a user action (e.g.:
	 *        The user clicked the forward button).
	 *
	 * @throw NS_ERROR_UNEXPECTED
	 *        Indicates that the call was unexpected at this time, which implies
	 *        that session history entry at the given index does not exist.
	 */
	gotoIndex(index: number, userActivation?: boolean);

	/****************************************************************************
	 * The following flags may be bitwise combined to form the load flags
	 * parameter passed to either the loadURI or reload method.  Some of these
	 * flags are only applicable to loadURI.
	 */

	/**
	 * This flags defines the range of bits that may be specified.  Flags
	 * outside this range may be used, but may not be passed to Reload().
	 */
	LOAD_FLAGS_MASK: 0xffff;

	/**
	 * This is the default value for the load flags parameter.
	 */
	LOAD_FLAGS_NONE: 0x0000;

	/**
	 * Flags 0x1, 0x2, 0x4, 0x8 are reserved for internal use by
	 * nsIWebNavigation implementations for now.
	 */

	/**
	 * This flag specifies that the load should have the semantics of an HTML
	 * Meta-refresh tag (i.e., that the cache should be bypassed).  This flag
	 * is only applicable to loadURI.
	 * XXX the meaning of this flag is poorly defined.
	 * XXX no one uses this, so we should probably deprecate and remove it.
	 */
	LOAD_FLAGS_IS_REFRESH: 0x0010;

	/**
	 * This flag specifies that the load should have the semantics of a link
	 * click.  This flag is only applicable to loadURI.
	 * XXX the meaning of this flag is poorly defined.
	 */
	LOAD_FLAGS_IS_LINK: 0x0020;

	/**
	 * This flag specifies that history should not be updated.  This flag is only
	 * applicable to loadURI.
	 */
	LOAD_FLAGS_BYPASS_HISTORY: 0x0040;

	/**
	 * This flag specifies that any existing history entry should be replaced.
	 * This flag is only applicable to loadURI.
	 */
	LOAD_FLAGS_REPLACE_HISTORY: 0x0080;

	/**
	 * This flag specifies that the local web cache should be bypassed, but an
	 * intermediate proxy cache could still be used to satisfy the load.
	 */
	LOAD_FLAGS_BYPASS_CACHE: 0x0100;

	/**
	 * This flag specifies that any intermediate proxy caches should be bypassed
	 * (i.e., that the content should be loaded from the origin server).
	 */
	LOAD_FLAGS_BYPASS_PROXY: 0x0200;

	/**
	 * This flag specifies that a reload was triggered as a result of detecting
	 * an incorrect character encoding while parsing a previously loaded
	 * document.
	 */
	LOAD_FLAGS_CHARSET_CHANGE: 0x0400;

	/**
	 * If this flag is set, Stop() will be called before the load starts
	 * and will stop both content and network activity (the default is to
	 * only stop network activity).  Effectively, this passes the
	 * STOP_CONTENT flag to Stop(), in addition to the STOP_NETWORK flag.
	 */
	LOAD_FLAGS_STOP_CONTENT: 0x0800;

	/**
	 * A hint this load was prompted by an external program: take care!
	 */
	LOAD_FLAGS_FROM_EXTERNAL: 0x1000;

	/**
	 * This flag specifies that this is the first load in this object.
	 * Set with care, since setting incorrectly can cause us to assume that
	 * nothing was actually loaded in this object if the load ends up being
	 * handled by an external application.  This flag must not be passed to
	 * Reload.
	 */
	LOAD_FLAGS_FIRST_LOAD: 0x4000;

	/**
	 * This flag specifies that the load should not be subject to popup
	 * blocking checks.  This flag must not be passed to Reload.
	 */
	LOAD_FLAGS_ALLOW_POPUPS: 0x8000;

	/**
	 * This flag specifies that the URI classifier should not be checked for
	 * this load.  This flag must not be passed to Reload.
	 */
	LOAD_FLAGS_BYPASS_CLASSIFIER: 0x10000;

	/**
	 * Force relevant cookies to be sent with this load even if normally they
	 * wouldn't be.
	 */
	LOAD_FLAGS_FORCE_ALLOW_COOKIES: 0x20000;

	/**
	 * Prevent the owner principal from being inherited for this load.
	 */
	LOAD_FLAGS_DISALLOW_INHERIT_PRINCIPAL: 0x40000;

	/**
	 * Overwrite the returned error code with a specific result code
	 * when an error page is displayed.
	 */
	LOAD_FLAGS_ERROR_LOAD_CHANGES_RV: 0x80000;

	/**
	 * This flag specifies that the URI may be submitted to a third-party
	 * server for correction. This should only be applied to non-sensitive
	 * URIs entered by users.  This flag must not be passed to Reload.
	 */
	LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP: 0x100000;

	/**
	 * This flag specifies that common scheme typos should be corrected.
	 */
	LOAD_FLAGS_FIXUP_SCHEME_TYPOS: 0x200000;

	/**
	 * Allows a top-level data: navigation to occur. E.g. view-image
	 * is an explicit user action which should be allowed.
	 */
	LOAD_FLAGS_FORCE_ALLOW_DATA_URI: 0x400000;

	/**
	 * This load is the result of an HTTP redirect.
	 */
	LOAD_FLAGS_IS_REDIRECT: 0x800000;

	/**
	 * These flags force TRR modes 1 or 3 for the load.
	 */
	LOAD_FLAGS_DISABLE_TRR: 0x1000000;
	LOAD_FLAGS_FORCE_TRR: 0x2000000;

	/**
	 * This load should bypass the LoadURIDelegate.loadUri.
	 */
	LOAD_FLAGS_BYPASS_LOAD_URI_DELEGATE: 0x4000000;

	/**
	 * This load has a user activation. (e.g: reload button was clicked)
	 */
	LOAD_FLAGS_USER_ACTIVATION: 0x8000000;

	/**
	 * Loads a given URI.  This will give priority to loading the requested URI
	 * in the object implementing this interface.  If it can't be loaded here
	 * however, the URI dispatcher will go through its normal process of content
	 * loading.
	 *
	 * @param uri
	 *        The URI to load.
	 * @param loadURIOptions
	 *        A JSObject defined in LoadURIOptions.webidl holding info like e.g.
	 *        the triggeringPrincipal, the referrer info.
	 */
	loadURI(uri: nsIURI, loadURIOptions: Partial<LoadURIOptions>): void;

	/**
	 * Parse / fix up a URI out of the string and load it.
	 * This will give priority to loading the requested URI
	 * in the object implementing this interface.  If it can't be loaded here
	 * however, the URI dispatcher will go through its normal process of content
	 * loading.
	 *
	 * @param uriString
	 *        The URI string to load.  For HTTP and FTP URLs and possibly others,
	 *        characters above U+007F will be converted to UTF-8 and then URL-
	 *        escaped per the rules of RFC 2396.
	 *        This method may use nsIURIFixup to try to fix up typos etc. in the
	 *        input string based on the load flag arguments in aLoadURIOptions.
	 *        It can even convert the input to a search results page using the
	 *        default search service.
	 *        If you have an nsIURI anyway, prefer calling `loadURI`, above.
	 * @param loadURIOptions
	 *        A JSObject defined in LoadURIOptions.webidl holding info like e.g.
	 *        the triggeringPrincipal, the referrer info.
	 */
	fixupAndLoadURIString(
		uriString: string,
		loadURIOptions: Partial<LoadURIOptions>
	): void;

	/**
	 * Tells the Object to reload the current page.  There may be cases where the
	 * user will be asked to confirm the reload (for example, when it is
	 * determined that the request is non-idempotent).
	 *
	 * @param reloadFlags
	 *        Flags modifying load behaviour.  This parameter is a bitwise
	 *        combination of the Load Flags defined above.  (Undefined bits are
	 *        reserved for future use.)  Generally you will pass LOAD_FLAGS_NONE
	 *        for this parameter.
	 *
	 * @throw NS_BINDING_ABORTED
	 *        Indicating that the user canceled the reload.
	 */
	reload(reloadFlags: number): void;

	/****************************************************************************
	 * The following flags may be passed as the stop flags parameter to the stop
	 * method defined on this interface.
	 */

	/**
	 * This flag specifies that all network activity should be stopped.  This
	 * includes both active network loads and pending META-refreshes.
	 */
	STOP_NETWORK: 0x01;

	/**
	 * This flag specifies that all content activity should be stopped.  This
	 * includes animated images, plugins and pending Javascript timeouts.
	 */
	STOP_CONTENT: 0x02;

	/**
	 * This flag specifies that all activity should be stopped.
	 */
	STOP_ALL: 0x03;

	/**
	 * Stops a load of a URI.
	 *
	 * @param stopFlags
	 *        This parameter is one of the stop flags defined above.
	 */
	stop(stopFlags: number): void;

	/**
	 * Retrieves the current DOM document for the frame, or lazily creates a
	 * blank document if there is none.  This attribute never returns null except
	 * for unexpected error situations.
	 */
	readonly document: Document;

	/**
	 * The currently loaded URI or null.
	 */
	readonly currentURI: nsIURI;

	/**
	 * Resume a load which has been redirected from another process.
	 *
	 * A negative |aHistoryIndex| value corresponds to a non-history load being
	 * resumed.
	 */
	resumeRedirectedLoad(
		aLoadIdentifier: number,
		historyIndex: number
	): void;
}
