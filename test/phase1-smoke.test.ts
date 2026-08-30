import { listCommands, getCommandHelp, getCommandPath } from '../src/command-loader';
import { StrategyRuntime } from '../src/strategy-types';

/**
 * Phase 1 smoke suite: the pruned/prefixed command tree, the mnemonica
 * define() architecture, and one real command execution through a
 * mnemonica CommandContext instance.
 *
 * Live-CDP spine commands (rpc_connection, rpc_analyze_type_hierarchy, ...)
 * are verified against a real runtime via the infer-debug harness; see
 * reports/audit-2026-08-22.md. Jest has no debug target, so those paths
 * are covered by the audit, not here.
 */

const EXPECTED: Record<string, string[]> = {
	MCP: [
		'mcp_compare_with_tactica',
		'mcp_get_local_cwd',
		'mcp_load_remote_tactica_types',
		'ws_define',
		'ws_eval',
		'ws_instantiate',
		'ws_session',
		'ws_swap',
	],
	RPC: [
		'rpc_analyze_type_hierarchy',
		'rpc_compare_graphs',
		'rpc_connection',
		'rpc_create_type',
		'rpc_dive_trace',
		'rpc_eval',
		'rpc_say_hi',
		'rpc_test',
		'rpc_trace_push',
		'rpc_trace_stream',
		'ws_bootstrap',
	],
	RUN: [
		'run_update_agents_md',
	],
};

describe('Phase 1 command tree', () => {
	test('lists exactly the surviving command set', () => {
		const byContext: Record<string, string[]> = { MCP: [], RPC: [], RUN: [] };
		for (const cmd of listCommands()) {
			byContext[cmd.context].push(cmd.name);
		}
		for (const context of Object.keys(EXPECTED)) {
			expect(byContext[context].sort()).toEqual(EXPECTED[context].slice().sort());
		}
	});

	test('command names are unique per context', () => {
		for (const context of ['MCP', 'RPC', 'RUN'] as const) {
			const names = listCommands(context).map(cmd => cmd.name);
			expect(new Set(names).size).toBe(names.length);
		}
	});

	test('active command names carry their site prefix', () => {
		const prefixed = listCommands().filter(cmd => /^(mcp|rpc|run)_/.test(cmd.name));
		expect(prefixed.length).toBe(14);
	});

	test('ws_ channel commands are exactly the Phase 3 set', () => {
		const wsCommands = listCommands().filter(cmd => /^ws_/.test(cmd.name));
		expect(wsCommands.map(cmd => cmd.name).sort()).toEqual([
			'ws_bootstrap',
			'ws_define',
			'ws_eval',
			'ws_instantiate',
			'ws_session',
			'ws_swap',
		]);
	});

	test('help resolves for every command', () => {
		for (const cmd of listCommands()) {
			const help = getCommandHelp(cmd.context, cmd.name);
			expect(help).not.toBeNull();
			expect(help?.name).toBe(cmd.name);
		}
	});
});

describe('mnemonica architecture', () => {
	test('runtime instance carries version and subtype constructors', () => {
		const runtime = new StrategyRuntime('1.0');
		expect(runtime.version).toBe('1.0');
		expect(runtime.initialized).toBeLessThanOrEqual(Date.now());
		expect(typeof runtime.CommandContext).toBe('function');
		expect(typeof runtime.StrategyConnection).toBe('function');
		expect(typeof runtime.WSChannel).toBe('function');
	});

	test('CommandContext carries require/store/args through the proxy layer', () => {
		const runtime = new StrategyRuntime('1.0');
		const store = new Map<string | symbol, unknown>();
		const ctx = new runtime.CommandContext(require, store, { hello: 'world' }, runtime);
		expect(ctx.args).toEqual({ hello: 'world' });
		expect(ctx.store).toBe(store);
		expect(typeof ctx.require).toBe('function');
		expect(ctx.runtime).toBe(runtime);
	});

	test('StrategyConnection node matches the store shape commands expect', () => {
		const runtime = new StrategyRuntime('1.0');
		const conn = new runtime.StrategyConnection('127.0.0.1', 9229);
		expect(conn.host).toBe('127.0.0.1');
		expect(conn.port).toBe(9229);
		expect(conn.isConnected).toBe(false);
		conn.isConnected = true;
		conn.connection = { fake: 'client' };
		expect(conn.isConnected).toBe(true);
		expect(conn.connection).toEqual({ fake: 'client' });
	});

	test('WSChannel node matches the store shape ws commands expect', () => {
		const runtime = new StrategyRuntime('1.0');
		const channel = new runtime.WSChannel(4371, 1234, 'tok', { fake: 'session' });
		expect(channel.port).toBe(4371);
		expect(channel.pid).toBe(1234);
		expect(channel.token).toBe('tok');
		expect(channel.session).toEqual({ fake: 'session' });
		expect(channel.connectedAt).toBeLessThanOrEqual(Date.now());
	});
});

describe('command execution smoke', () => {
	test('mcp_get_local_cwd runs via module.exports with a mnemonica ctx', async () => {
		const runtime = new StrategyRuntime('1.0');
		const store = new Map<string | symbol, unknown>();
		const ctx = new runtime.CommandContext(require, store, {}, runtime);
		const filePath = getCommandPath('MCP', 'mcp_get_local_cwd');
		expect(filePath).toBeTruthy();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const commandModule = require(filePath as string);
		const result = await commandModule.run(ctx);
		expect(result).toBeDefined();
	});
});
