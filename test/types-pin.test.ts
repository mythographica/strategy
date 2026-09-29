// Type-level pin: the strategy-types exports must keep their precise types.
// If any export degrades to TypeClass | undefined (the untyped string-lookup
// overload), the constructor-constraint checks below fail to compile — this
// test exists because that regression once shipped silently.
// Runtime note: subtypes only construct from a parent instance (mnemonica's
// strictChain rule), so the instance-level pins go through `runtime`.
import {
	StrategyTypes,
	StrategyRuntime,
	CommandContext,
	StrategyConnection,
	WSChannel
} from '../src/strategy-types';
import type {
	StrategyRuntimeInstance,
	CommandContextInstance,
	StrategyConnectionInstance,
	WSChannelInstance
} from '../src/strategy-types';

// every export stays a precisely-typed constructor (never TypeClass | undefined)
type MustBeConstructor<T> = T extends { new (...args: never[]): object } ? true : never;
const pinStrategyRuntimeCtor: MustBeConstructor<typeof StrategyRuntime> = true;
const pinCommandContextCtor: MustBeConstructor<typeof CommandContext> = true;
const pinStrategyConnectionCtor: MustBeConstructor<typeof StrategyConnection> = true;
const pinWSChannelCtor: MustBeConstructor<typeof WSChannel> = true;

const runtime = new StrategyRuntime('1.0');
const pinRuntime: StrategyRuntimeInstance = runtime;

// construction from a runtime instance stays typed, with the exact
// child instance types
const ctx = new runtime.CommandContext(require, new Map(), {}, runtime);
const pinCtx: CommandContextInstance = ctx;

const conn = new runtime.StrategyConnection('127.0.0.1', 1);
const pinConn: StrategyConnectionInstance = conn;

const ws = new runtime.WSChannel(1, 2, 'token', null);
const pinWs: WSChannelInstance = ws;

describe('strategy types pin', () => {
	test('every export keeps its precise constructor type', () => {
		expect(pinStrategyRuntimeCtor).toBe(true);
		expect(pinCommandContextCtor).toBe(true);
		expect(pinStrategyConnectionCtor).toBe(true);
		expect(pinWSChannelCtor).toBe(true);
		expect(typeof StrategyTypes.define).toBe('function');
		expect(pinRuntime.version).toBe('1.0');
		expect(pinCtx.store).toBeInstanceOf(Map);
		expect(pinConn.host).toBe('127.0.0.1');
		expect(pinWs.token).toBe('token');
	});
});
