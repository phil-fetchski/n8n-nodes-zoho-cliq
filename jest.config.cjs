module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>'],
	testMatch: ['**/__tests__/**/*.test.ts'],
	modulePathIgnorePatterns: ['<rootDir>/dist/'],
	collectCoverageFrom: [
		'credentials/**/*.ts',
		'nodes/**/*.ts',
		'transport/**/*.ts',
		'types/**/*.ts',
		'!**/*.d.ts',
		'!**/node_modules/**',
	],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80,
		},
	},
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	testTimeout: 10000,
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
};
