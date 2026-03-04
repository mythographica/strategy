// This script is executed in NestJS via CDP (Chrome Debug Protocol)
// It runs inside the NestJS runtime, not in MCP

(function() {
	console.log('');
	console.log('=== NESTJS EXECUTION: create-type ===');
	console.log('This code is running INSIDE NestJS via CDP');
	console.log('Timestamp: ' + new Date().toISOString());
	console.log('Process PID: ' + process.pid);
	console.log('CWD: ' + (typeof process !== 'undefined' && process.cwd ? process.cwd() : 'N/A'));
	console.log('======================================');

	try {
		var mnemonica = process.mainModule.require('mnemonica');
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
