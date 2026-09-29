// This script is executed in the target Node.js runtime via CDP (Chrome Debug Protocol)
// It runs inside the target process, not in MCP
//
// Object-linked dive: there is no whole-trace dump — retention is the
// edges' own object links. What stays enumerable in-target is the RUNNING
// set (getRunningEdges — the unfinished fibers) plus the stats counters.
// Completed history is collected by design; full flows belong to the push
// channel (traceSubscribe in cdp-scripts/ws-server.js — leave/settle carry
// completions), and getFlow(target) answers a known object or Error.
// Edges map to { id, parentId, name, kind, status, duration, ts,
// instanceType, instanceSource } — JSON-safe: live instance references
// cannot cross returnByValue. args.sinceId (optional) keeps only edges with
// id > sinceId — the polling delta for a visualization client.

(async function() {
	try {
		// Canonical prelude, generalized to a require factory: same three tiers
		// as every cdp-script (mainModule.require → getBuiltinModule +
		// createRequire → node:module dynamic import last resort). Never a bare
		// require. The TARGET's own @mnemonica/dive copy is the one that holds
		// the edges — dive state is module-level.
		var targetRequire;
		if (process.mainModule && process.mainModule.require) {
			targetRequire = process.mainModule.require.bind(process.mainModule);
		} else if (typeof process.getBuiltinModule === 'function') {
			var nodeModule = process.getBuiltinModule('node:module');
			targetRequire = nodeModule.createRequire(process.cwd() + '/__strategy_cwd__.js');
		} else {
			var moduleNs = await import('node:module');
			var moduleBuiltin = moduleNs.default || moduleNs;
			targetRequire = moduleBuiltin.createRequire(process.cwd() + '/__strategy_cwd__.js');
		}

		var dive = targetRequire('@mnemonica/dive');

		if (typeof dive.getRunningEdges !== 'function') {
			return {
				success: false,
				error: 'target runtime has no dive.getRunningEdges — needs the object-linked @mnemonica/dive',
				diveVersion: null
			};
		}

		// mnemonica is OPTIONAL: dive wraps plain-object contexts too. When the
		// target has it, instanceType names the mnemonica type of the edge's
		// instance; otherwise null.
		var getProps = null;
		try {
			var mnemonicaModule = targetRequire('mnemonica/module');
			getProps = mnemonicaModule.getProps || null;
		} catch (e) {
			getProps = null;
		}

		function instanceTypeOf (instance) {
			if (!instance || !getProps) {
				return null;
			}
			try {
				var props = getProps(instance);
				var type = props && props.__type__;
				return (type && type.TypeName) || null;
			} catch (e) {
				return null;
			}
		}

		var sinceId = (typeof args !== 'undefined' && args && typeof args.sinceId === 'number')
			? args.sinceId
			: 0;

		var edges = dive.getRunningEdges()
			.filter(function (edge) { return edge.id > sinceId; })
			.map(function (edge) {
				return {
					id: edge.id,
					parentId: edge.parentId,
					name: edge.name,
					kind: edge.kind,
					status: edge.status,
					duration: (edge.duration === undefined) ? null : edge.duration,
					ts: edge.ts,
					instanceType: instanceTypeOf(edge.instance),
					// dive >= 0.8.3: explicit vs ambient attribution — the
					// panel distrusts ambient bulbs; null on older dive
					instanceSource: edge.instanceSource || null
				};
			});

		return {
			success: true,
			model: 'object-linked',
			note: 'running edges only — completed edges collect by design; use the push channel (traceSubscribe) for full flows',
			edgeCount: edges.length,
			edges: edges,
			stats: (dive.stats && typeof dive.stats === 'object') ? {
				running: dive.stats.running,
				recorded: dive.stats.recorded,
				alive: dive.stats.alive,
				collectedEdges: dive.stats.collectedEdges,
				collectedInstances: dive.stats.collectedInstances
			} : null,
			processPid: process.pid,
			timestamp: new Date().toISOString()
		};
	} catch (e) {
		return {
			success: false,
			error: e.message
		};
	}
})();
