module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/test'],
	testMatch: ['**/*.test.ts'],
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
	moduleNameMapper: {
		'^@modelcontextprotocol/sdk/(.*)$': '<rootDir>/test/__mocks__/mcp-sdk.js',
		'^@modelcontextprotocol/sdk$': '<rootDir>/test/__mocks__/mcp-sdk.js',
	},
};
