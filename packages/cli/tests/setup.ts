/**
 * Test setup file for CLI tests
 */
import { beforeEach, afterEach, afterAll, mock } from 'bun:test';
import { type Mock } from 'bun:test';
import { cleanupTempFiles } from './utils/cleanup';

// Mock console methods to capture output
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  const infos: string[] = [];

  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  console.error = (...args: any[]) => {
    errors.push(args.join(' '));
  };

  console.warn = (...args: any[]) => {
    warns.push(args.join(' '));
  };

  console.info = (...args: any[]) => {
    infos.push(args.join(' '));
  };

  return {
    logs,
    errors,
    warns,
    infos,
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    }
  };
}

// Mock process.exit to prevent tests from exiting
export function mockProcessExit() {
  const originalExit = process.exit;
  const exitMock = mock(() => {}) as Mock<() => never>;
  process.exit = exitMock as any;

  return {
    exitMock,
    restore: () => {
      process.exit = originalExit;
    }
  };
}

// Mock fs-extra module
export function mockFsExtra() {
  const mockFsExtraFunctions = {
    existsSync: mock(() => true),
    statSync: mock(() => ({
      isFile: () => true,
      isDirectory: () => true
    })),
    readFileSync: mock(() => 'mock file content'),
    writeFileSync: mock(() => {}),
    mkdirSync: mock(() => {}),
    ensureDirSync: mock(() => {}),
    copyFileSync: mock(() => {}),
    copySync: mock(() => {}),
    removeSync: mock(() => {}),
    readJsonSync: mock(() => ({})),
    writeJsonSync: mock(() => {}),
    readdirSync: mock(() => [])
  };

  // Mock the fs-extra module
  mock.module('fs-extra', () => {
    return {
      ...mockFsExtraFunctions,
      default: mockFsExtraFunctions
    };
  });

  return {
    mocks: mockFsExtraFunctions,
    restore: () => {
      // No need to restore anything as the mock is scoped to the test
    }
  };
}

// Mock child_process module
export function mockChildProcess() {
  const mockSpawn = mock(() => ({
    on: mock(() => {}),
    kill: mock(() => {})
  }));

  const mockExecSync = mock(() => {});

  const mockChildProcessFunctions = {
    spawn: mockSpawn,
    execSync: mockExecSync
  };

  // Mock the child_process module
  mock.module('child_process', () => {
    return {
      ...mockChildProcessFunctions,
      default: mockChildProcessFunctions
    };
  });

  return {
    spawn: mockSpawn,
    execSync: mockExecSync,
    restore: () => {
      // No need to restore anything as the mock is scoped to the test
    }
  };
}

// Ensure all temporary files are cleaned up after all tests
afterAll(() => {
  cleanupTempFiles();
});