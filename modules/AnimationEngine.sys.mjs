/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @typedef {{
 *     targets?: Element | Element[];
 *     easing?: string;
 *     duration?: number;
 *     delay?: number;
 *     [key: string]: any;
 * }} AnimationOptions
 */

const AnimationEasings = {
	/**
	 * Linear easing
	 */
	Linear: () => "linear",

	/**
	 * Cubic beizer easing
	 * @param {number} x1
	 * @param {number} y1
	 * @param {number} x2
	 * @param {number} y2
	 */
	CubicBeizer: (x1, y1, x2, y2) => `cubicBezier(${x1}, ${y1}, ${x2}, ${y2})`,

	/**
	 * Step easing
	 * @param {number} steps
	 */
	Step: (steps) => `steps(${steps})`
};

export class AnimationEngine {
	static Easings = AnimationEasings;

	/**
	 * The sandbox instance containing anime.js
	 */
	#internal = null;

	#animationOptions = {};

	/**
	 * The global animation options shared with all running animations
	 * @type {AnimationOptions}
	 */
	get animationOptions() {
		return this.#animationOptions;
	}

	/**
	 * @param {Window} originatingWin
	 * @param {AnimationOptions} [animationOptions]
	 */
	constructor(originatingWin, animationOptions) {
		this.#internal = new Cu.Sandbox(originatingWin.document.nodePrincipal, {
			sandboxName: "Animation Engine (anime.js)",
			sandboxPrototype: originatingWin,
			sameZoneAs: originatingWin,
			wantXrays: true,
			wantGlobalProperties: [],
			wantComponents: false
		});

		try {
			Services.scriptloader.loadSubScript(
				"resource://third-party/libs/anime.js",
				this.#internal
			);
		} catch (e) {
			console.error("Failed to init anime.js sandbox: ", e);

			Cu.nukeSandbox(this.#internal);
		}

		this.#animationOptions = animationOptions || {};
	}

	/**
	 * Performs a new animation animation
	 * @param {AnimationOptions} animation
	 * @returns {{ finished: Promise<any>, play: () => void, pause: () => void }}
	 */
	animate(animation) {
		return this.#internal.anime({
			...this.animationOptions,
			...animation
		});
	}
}
