/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Sandbox } from "./Sandbox";

export interface Cu {
	import: <T extends any>(module: string) => { [key: string]: T };
	exportFunction: (
		fn: Function,
		scope: object,
		options?: object
	) => any;
	cloneInto: (value: any, scope: object, options?: object) => void;
	isInAutomation: boolean;
	now: () => number;
	getGlobalForObject(obj: any): any;

	/**
	 * Cu.Sandbox is used to create a sandbox object
	 *
	 *     let sandbox = Cu.Sandbox(principal[, options]);
	 *
	 * Using new Cu.Sandbox(...) to create a sandbox has the same effect as
	 * calling Cu.Sandbox(...) without new.
	 */
	readonly Sandbox: Sandbox;

	nukeSandbox(obj: any): void;

	createObjectIn(obj: any): any;

	/**
	 * Waive Xray on a given value. Identity op for primitives.
	 */
	waiveXrays(val: any): any;

	/*
	 * evalInSandbox is designed to be called from JavaScript only.
	 *
	 * evalInSandbox evaluates the provided source string in the given sandbox.
	 * It returns the result of the evaluation to the caller.
	 *
	 * var s = new C.u.Sandbox("http://www.mozilla.org");
	 * var res = C.u.evalInSandbox("var five = 5; 2 + five", s);
	 * var outerFive = s.five;
	 * s.seven = res;
	 * var thirtyFive = C.u.evalInSandbox("five * seven", s);
	 */
	evalInSandbox(
		source: string,
		sandbox: object,
		version?: any,
		filename?: string,
		lineNo?: number,
		enforceFilenameRestrictions?: boolean
	): any;
}
