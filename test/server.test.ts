import { CDPConnection } from '../src/cdp-connection';
import { TacticaComparison } from '../src/tactica-comparison';

// Import after mocking
import { StrategyServer } from '../src/server';

describe('Strategy Server', () => {
	test('should create server instance', () => {
		const server = new StrategyServer();
		expect(server).toBeDefined();
	});
});

describe('CDPConnection', () => {
	test('should create connection with default params', () => {
		const conn = new CDPConnection();
		expect(conn).toBeDefined();
		expect(conn.isConnected()).toBe(false);
	});

	test('should create connection with custom params', () => {
		const conn = new CDPConnection('127.0.0.1', 9230);
		expect(conn).toBeDefined();
		expect(conn.isConnected()).toBe(false);
	});
});

describe('TacticaComparison', () => {
	let comparison: TacticaComparison;

	beforeEach(() => {
		comparison = new TacticaComparison();
	});

	test('should parse tactica content', () => {
		const content = `
			export type UserEntityInstance = {
				id: string;
				AdminEntity: TypeConstructor<AdminEntityInstance>;
			};
			export type AdminEntityInstance = UserEntityInstance & {
				role: string;
			};
		`;

		// Access private method through any cast for testing
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const types = (comparison as any).parseTacticaContent(content);

		expect(types).toBeDefined();
		expect(Object.keys(types).length).toBeGreaterThan(0);
	});

	test('should compare runtime and tactica types', () => {
		const runtimeTypes = {
			UserEntity: {
				name: 'UserEntity',
				parent: null,
				subtypes: ['AdminEntity'],
			},
			AdminEntity: {
				name: 'AdminEntity',
				parent: 'UserEntity',
				subtypes: [],
			},
		};

		const tacticaTypes = {
			UserEntityInstance: {
				name: 'UserEntityInstance',
				parent: null,
				subtypes: ['AdminEntityInstance'],
			},
			AdminEntityInstance: {
				name: 'AdminEntityInstance',
				parent: 'UserEntityInstance',
				subtypes: [],
			},
		};

		const result = comparison.compare(runtimeTypes, tacticaTypes);

		expect(result).toBeDefined();
		expect(result.missingFromTactica).toBeDefined();
		expect(result.mismatches).toBeDefined();
	});

	test('should generate report', () => {
		const result = {
			runtimeTypes: {
				UserEntity: { name: 'UserEntity', parent: null, subtypes: [] },
			},
			tacticaTypes: {
				UserEntityInstance: { name: 'UserEntityInstance', parent: null, subtypes: [] },
			},
			missingFromTactica: [],
			extraInTactica: [],
			mismatches: [],
		};

		const report = comparison.generateReport(result);

		expect(report).toContain('Mnemonica vs Tactica Comparison Report');
		expect(report).toContain('Summary');
	});
});
