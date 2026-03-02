declare module 'chrome-remote-interface' {
	interface Client {
		close (): Promise<void>;
		Runtime: {
			evaluate (params: {
				expression: string;
				returnByValue?: boolean;
				awaitPromise?: boolean;
			}): Promise<{
				result?: { value?: unknown };
				exceptionDetails?: { exception?: { description?: string } };
			}>;
		};
	}

	interface CDPOptions {
		host?: string;
		port?: number;
	}

	function CDP (options: CDPOptions): Promise<Client>;

	export = CDP;
}
