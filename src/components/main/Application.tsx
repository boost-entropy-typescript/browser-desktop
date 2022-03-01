/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { BrowserToolboxLauncher } from "mozilla";
import React, { PureComponent } from "react";
import ErrorBoundary from "../errors/ErrorBoundary";
import BrowserFrame from "../frame/BrowserFrame";
import TabBar from "../tabbar/TabBar";
import { GlobalStyle } from "./Application.style";

class Application extends PureComponent {
	public constructor(props: {}) {
		super(props);
	}

	public async componentDidMount() {
		BrowserToolboxLauncher.init();
	}

	public render() {
		return (
			<ErrorBoundary>
				<GlobalStyle />

				<TabBar />
				<BrowserFrame />
			</ErrorBoundary>
		);
	}
}

export default Application;
