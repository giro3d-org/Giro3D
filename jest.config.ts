import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
    roots: ['test/unit'],
    preset: 'ts-jest',
    testEnvironment: 'jest-environment-jsdom',
    transformIgnorePatterns: [
        'node_modules/(?!ol|three|quick-lru|color-space|color-rgba|color-parse|color-name|proj4|3d-tiles-renderer)',
    ],
    transform: {
        // We must use Babel to transform files because of the inlined GLSL files
        '\\.[jt]sx?$': 'babel-jest',
    },
    setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
    // Used to avoid relative import paths to the source files:
    // import ""../../../src/foo.js" can be simplified to import "src/foo.js"
    moduleNameMapper: {
        '^@giro3d/giro3d/(.*)$': '<rootDir>/src/$1',
    },
};

export default jestConfig;
