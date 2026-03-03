/**
 * CDP Client Library for Remote Commands
 * 
 * This module provides CDP connection functionality for commands in commands-remote/
 * Commands can use this to connect to the Node.js inspector and evaluate code
 */

class CDPClient {
	constructor () {
		this.ws = null;
		this.connected = false;
		this.messageId = 0;
		this.pendingMessages = new Map();
	}

	async connect (host = 'localhost', port = 9229) {
		const WebSocket = process.mainModule.require('ws');
		const http = process.mainModule.require('http');

		// Get WebSocket URL from JSON endpoint
		const jsonUrl = `http://${host}:${port}/json`;
		
		return new Promise((resolve, reject) => {
			http.get(jsonUrl, (res) => {
				let data = '';
				res.on('data', chunk => data += chunk);
				res.on('end', () => {
					try {
						const targets = JSON.parse(data);
						if (!targets.length) {
							reject(new Error('No debug targets available'));
							return;
						}

						const wsUrl = targets[0].webSocketDebuggerUrl;
						this.ws = new WebSocket(wsUrl);

						this.ws.on('open', () => {
							this.connected = true;
							resolve({ success: true, target: targets[0].title });
						});

						this.ws.on('message', (data) => {
							const message = JSON.parse(data);
							if (message.id && this.pendingMessages.has(message.id)) {
								const { resolve, reject } = this.pendingMessages.get(message.id);
								this.pendingMessages.delete(message.id);
								
								if (message.error) {
									reject(new Error(message.error.message));
								} else {
									resolve(message.result);
								}
							}
						});

						this.ws.on('error', (err) => {
							reject(err);
						});

					} catch (e) {
						reject(e);
					}
				});
			}).on('error', reject);
		});
	}

	async evaluate (expression) {
		if (!this.connected || !this.ws) {
			throw new Error('Not connected to CDP');
		}

		const id = ++this.messageId;
		
		return new Promise((resolve, reject) => {
			this.pendingMessages.set(id, { resolve, reject });
			
			this.ws.send(JSON.stringify({
				id: id,
				method: 'Runtime.evaluate',
				params: {
					expression: expression,
					returnByValue: true
				}
			}));

			// Timeout after 30 seconds
			setTimeout(() => {
				if (this.pendingMessages.has(id)) {
					this.pendingMessages.delete(id);
					reject(new Error('CDP evaluation timeout'));
				}
			}, 30000);
		});
	}

	disconnect () {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
			this.connected = false;
		}
	}
}

// Export for use by other commands
module.exports = { CDPClient };
