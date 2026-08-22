// This script is executed in the target Node.js runtime via CDP (Chrome Debug Protocol)
// It runs inside the target process, not in MCP

(async function() {
	console.log('');
	console.log('=== TARGET EXECUTION: analyze-hierarchy ===');
	console.log('This code is running INSIDE the target runtime via CDP');
	console.log('Timestamp: ' + new Date().toISOString());
	console.log('Process PID: ' + process.pid);
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

		console.log('Mnemonica loaded successfully in NestJS!');

		// Get the default types collection
		var defaultCollection = mnemonica.defaultTypes;
		var hierarchy = {};

		// Helper to safely get subtypes
		function getSubtypes (Type) {
			var subtypes = [];
			try {
				// Access subtypes map from the type constructor
				if (Type && Type.subtypes) {
					// subtypes is a Map - iterate safely
					Type.subtypes.forEach(function (SubType, name) {
						try {
							subtypes.push({
								name: name,
								subtypes: getSubtypes(SubType) // Recursive
							});
						} catch (e) {
							subtypes.push({ name: name, error: e.message });
						}
					});
				}
			} catch (e) {
				console.log('Note: Could not access subtypes for ' + (Type && Type.name));
			}
			return subtypes;
		}

		// Get all types from the default collection's subtypes map
		var collectionTypes = [];
		try {
			if (defaultCollection && defaultCollection.subtypes) {
				defaultCollection.subtypes.forEach(function (Type, name) {
					try {
						hierarchy[name] = {
							name: name,
							path: name,
							subtypes: getSubtypes(Type)
						};
						collectionTypes.push(name);
					} catch (e) {
						console.log('Error processing type ' + name + ': ' + e.message);
					}
				});
			}
		} catch (e) {
			console.log('Note: Could not enumerate collection subtypes: ' + e.message);
		}

		var typeCount = Object.keys(hierarchy).length;
		console.log('Total types found: ' + typeCount);

		return {
			success: true,
			hierarchy: hierarchy,
			typeCount: typeCount,
			collectionTypes: collectionTypes,
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
