// This script is executed in the target Node.js runtime via CDP (Chrome Debug Protocol)
// It runs inside the target process, not in MCP

(async function() {
	console.log('');
	console.log('=== TARGET EXECUTION: create-type ===');
	console.log('This code is running INSIDE the target runtime via CDP');
	console.log('Timestamp: ' + new Date().toISOString());
	console.log('Process PID: ' + process.pid);
	console.log('CWD: ' + (typeof process !== 'undefined' && process.cwd ? process.cwd() : 'N/A'));
	console.log('======================================');

	try {
		// Phase 2 prelude: load the TARGET's mnemonica, CJS/ESM-safe.
		// 1. CJS entries have process.mainModule — use its require.
		// 2. ESM entries don't; Runtime.evaluate gets no dynamic-import
		//    callback, so import() fails there — build a require instead
		//    via process.getBuiltinModule (Node >= 20.18 / 22.3).
		// 3. Last resort for older runtimes: dynamic import.
		var mnemonica;
		if (process.mainModule && process.mainModule.require) {
			mnemonica = process.mainModule.require('mnemonica');
		} else if (typeof process.getBuiltinModule === 'function') {
			var nodeModule = process.getBuiltinModule('node:module');
			var cwdRequire = nodeModule.createRequire(process.cwd() + '/__strategy_cwd__.js');
			mnemonica = cwdRequire('mnemonica');
		} else {
			var mnemonicaNs = await import('mnemonica');
			mnemonica = mnemonicaNs.default || mnemonicaNs;
		}
		var typeName = args.typeName || 'TestType';
		
		// Define the type in NestJS runtime
		var TestType = mnemonica.define(typeName, function (data) {
			this.data = data;
			this.createdAt = new Date().toISOString();
		});
		
		console.log('Type "' + typeName + '" created successfully in NestJS!');
		
		return {
			success: true,
			typeName: typeName,
			executedIn: 'NestJS via CDP',
			processPid: process.pid,
			timestamp: new Date().toISOString()
		};
	} catch (e) {
		console.error('Error in NestJS:', e.message);
		return {
			success: false,
			error: e.message,
			executedIn: 'NestJS via CDP'
		};
	}
})();
