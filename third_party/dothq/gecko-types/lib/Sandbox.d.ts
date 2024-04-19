/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export interface SandboxCreationOptions {
    /** 
     * Allows the caller to waive Xrays, in case Xrays were used. Defaults to true.
     */
    allowWaivers?: boolean;
    
    /** 
     * For certain globals, we know enough about the code that will run in them 
     * that we can discard script source entirely. A discarded source will be 
     * re-read when stringifying functions. Defaults to false.
     */
    discardSource?: boolean;
    
    /** 
     * Determines whether content windows and workers are marked as "Secure Context"s. 
     * If principal is the system principal, the value is forced to true. 
     * Otherwise defaults to false.
     */
    forceSecureContext?: boolean;
    
    /** 
     * Whether the sandbox should be created using a new compartment. Defaults to false.
     */
    freshCompartment?: boolean;
    
    /** 
     * If true creates a new GC region separate from both the calling context's 
     * and the sandbox prototype's region. Defaults to false.
     */
    freshZone?: boolean;
    
    /** 
     * Whether this sandbox and its scripts can be accessed by the JavaScript Debugger. 
     * Defaults to false.
     */
    invisibleToDebugger?: boolean;
    
    /** 
     * Whether this sandbox corresponds to a WebExtension content script, 
     * and should receive various bits of special compatibility behavior. 
     * Defaults to false.
     */
    isWebExtensionContentScript?: boolean;
    
    /** 
     * Object to use as the metadata for the sandbox. See setSandboxMetadata.
     */
    metadata?: object;
    
    /** 
     * Dictionary of origin attributes to use if the principal was provided as a string.
     */
    originAttributes?: object;
    
    /** 
     * Javascript Object in whose garbage collection region the sandbox should be created. 
     * This helps to improve memory usage by allowing sandboxes to be discarded when 
     * that zone goes away. It also improves performance and memory usage by allowing 
     * strings to be passed between the compartments without copying or using wrappers. 
     * Content scripts should pass the window they're running in as this parameter, 
     * in order to ensure that the script is cleaned up at the same time as the content 
     * itself.
     */
    sameZoneAs?: object;
    
    /** 
     * Identifies the sandbox in about:memory. This property is optional, but very
     * useful for tracking memory usage. A recommended value for this property is 
     * an absolute path to the script responsible for creating the sandbox. If you 
     * don't specify a sandbox name it will default to the caller's filename.
     */
    sandboxName?: string;
    
    /** 
     * Prototype object for the sandbox. The sandbox will inherit the contents 
     * of this object if it's provided. Passing a content window object, setting 
     * wantXrays:true (default) and using an extended principal provides a clean, 
     * isolated execution environment in which javascript code that needs Web APIs 
     * (such as accessing the window's DOM) can be executed without interference 
     * from untrusted content code.
     */
    sandboxPrototype?: object;
    
    /** 
     * The id of the user context this sandbox is inside. Defaults to 0.
     */
    userContextId?: number;
    
    /** 
     * Indicates whether the Components object is available or not in the sandbox. 
     * If the sandbox interacts with untrusted content this should be set to false 
     * when possible to further reduce possible attack surface. Defaults to true.
     */
    wantComponents?: boolean;

    /** 
     * If true, then createObjectIn(), evalInWindow(), and exportFunction() are available
     * in the sandbox. Defaults to false.
     */
    wantExportHelpers?: boolean;
    
    /** 
     * Each string is the name of an object that you want to make available as a global 
     * to code running in the sandbox. Possible values: Blob, ChromeUtils, CSS, CSSRule, 
     * Directory, DOMParser, Element, Event, File, FileReader, FormData, InspectorUtils, 
     * MessageChannel, Node, NodeFilter, PromiseDebugging, TextDecoder, TextEncoder, URL, 
     * URLSearchParams, XMLHttpRequest, XMLSerializer, atob, btoa, caches, crypto, fetch, 
     * indexedDB, rtcIdentityProvider
     */
    wantGlobalProperties?: string[];
    
    /** 
     * Whether the sandbox wants Xray vision with respect to same-origin objects outside 
     * the sandbox. Defaults to true.
     *
     * Note that wantXrays is essentially deprecated. The preferred method of handling 
     * this now is to give the sandbox an expanded principal which inherits from the 
     * principal of the content compartment the sandbox will interact with. That lets 
     * the sandbox see the content compartment through X-ray wrappers, and gives any 
     * object passed from the sandbox to the content compartment opaque security wrappers 
     * unless export helpers are explicitly used.
     * 
     * "Xray vision" is exactly the same Xray behavior that script always gets, by default, 
     * when working with DOM objects across origin boundaries. This is primarily visible 
     * for chrome code accessing content. However, it also occurs during cross-origin 
     * access between two content pages, since each page sees a "vanilla" view of the other. 
     * The protection is bidirectional: the caller sees the bonafide DOM objects without 
     * being confused by sneakily-redefined properties, and the target receives appropriate 
     * privacy from having its expandos inspected by untrusted callers. In situations where 
     * only unidirectional protection is needed, callers have the option to waive the X-ray 
     * behavior using wrappedJSObject or XPCNativeWrapper.unwrap().
     * 
     * In general, when accessing same-origin content, script gets a Transparent wrapper 
     * rather than an Xray wrapper. However, sandboxes are often used when chrome wants 
     * to run script as another origin, possibly to interact with the page. In this case, 
     * same-origin Xrays are desirable, and wantXrays should be set to true.
     */
    wantXrays?: boolean;
}

export interface Sandbox {
    new(principal: any /** todo: nsIPrincipal */, options: SandboxCreationOptions): Sandbox;
}