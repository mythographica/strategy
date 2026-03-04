// This script is executed in NestJS via CDP (Chrome Debug Protocol)
// It runs inside the NestJS runtime, not in MCP

(function() {
	console.log('');
	console.log('=== NESTJS EXECUTION: analyze-hierarchy ===');
	console.log('This code is running INSIDE NestJS via CDP');
	console.log('Timestamp: ' + new Date().toISOString());
	console.log('Process PID: ' + process.pid);
	console.log('======================================');

	try {
		var mnemonica = process.mainModule.require('mnemonica');

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
