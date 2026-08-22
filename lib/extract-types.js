// This script is evaluated in the Node.js debug runtime to extract Mnemonica types
// It must use ES5-compatible syntax (var instead of const/let)

(async () => {
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

		// Access defaultCollection (Map) instead of defaultTypes (Proxy)
		var result = {};
		var collection = mnemonica.defaultCollection;

		// Iterate over the Map
		collection.forEach(function(Constructor, name) {
			try {
				if (typeof Constructor === 'function') {
					var subtypes = [];
					var parent = null;

					// Safely get subtypes
					try {
						if (Constructor.subtypes) {
							subtypes = Array.from(Constructor.subtypes.keys());
						}
					} catch (stErr) {}

					// Safely get parent
					try {
						if (Constructor.parent) {
							parent = Constructor.parent.name;
						}
					} catch (pErr) {}

					result[name] = {
						name: Constructor.name || name,
						subtypes: subtypes,
						parent: parent,
					};
				}
			} catch (constructorErr) {
				// Skip types that can't be accessed
			}
		});
		return result;
	} catch (e) {
		return { error: e.message, stack: e.stack };
	}
})()
