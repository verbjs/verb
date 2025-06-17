import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mockConsole, mockFsExtra, mockChildProcess, mockProcessExit } from '../setup';
import { Command } from 'commander';

// Mock chokidar
mock.module('chokidar', () => {
  const mockWatcher = {
    on: mock((event, callback) => {
      if (event === 'change') {
        // Store the change callback for testing
        (mockWatcher as any).changeCallback = callback;
      }
      return mockWatcher;
    }),
    close: mock(() => {})
  };
  
  const watchMock = mock(() => mockWatcher);
  
  return {
    watch: watchMock,
    default: {
      watch: watchMock
    }
  };
});

// Mock ora
mock.module('ora', () => {
  const mockSpinner = {
    start: mock(() => mockSpinner),
    stop: mock(() => mockSpinner),
    succeed: mock(() => mockSpinner),
    fail: mock(() => mockSpinner),
    text: ''
  };
  
  const mockOra = mock(() => mockSpinner);
  mockOra.default = mockOra;
  return mockOra;
});

describe('Dev Command', () => {
  let consoleMock: ReturnType<typeof mockConsole>;
  let fsMock: ReturnType<typeof mockFsExtra>;
  let cpMock: ReturnType<typeof mockChildProcess>;
  let exitMock: ReturnType<typeof mockProcessExit>;
  let command: Command;
  let actionHandler: Function;
  
  beforeEach(async () => {
    consoleMock = mockConsole();
    fsMock = mockFsExtra();
    cpMock = mockChildProcess();
    exitMock = mockProcessExit();
    
    // Create a new Command instance
    command = new Command();
    command.command = mock(() => command);
    command.description = mock(() => command);
    command.option = mock(() => command);
    command.action = mock((handler) => {
      actionHandler = handler;
      return command;
    });
    
    // Mock package.json to indicate a Verb project
    fsMock.mocks.readFileSync.mockImplementation(() => JSON.stringify({
      dependencies: {
        verb: '^1.0.0'
      }
    }));
    
    // Mock file existence checks
    fsMock.mocks.existsSync.mockImplementation((path) => {
      if (path.includes('package.json')) return true;
      if (path.includes('src/index.ts')) return true;
      return false;
    });
    
    // Import the dev command
    const { devCommand } = await import('../../src/commands/dev');
    
    // Register the command
    devCommand(command);
  });
  
  afterEach(() => {
    consoleMock.restore();
    fsMock.restore();
    cpMock.restore();
    exitMock.restore();
  });
  
  test('dev command registers with correct options', () => {
    expect(command.command).toHaveBeenCalledWith('dev');
    expect(command.description).toHaveBeenCalledWith('Start development server with hot reload');
    expect(command.option).toHaveBeenCalledWith('-p, --port <port>', 'Port to run the server on', '3000');
    expect(command.option).toHaveBeenCalledWith('-h, --host <host>', 'Host to run the server on', 'localhost');
    expect(command.option).toHaveBeenCalledWith('--no-watch', 'Disable file watching');
    expect(command.option).toHaveBeenCalledWith('-o, --open', 'Open in browser');
    expect(command.action).toHaveBeenCalled();
  });
  
  test('dev command starts server with default options', async () => {
    expect(actionHandler).toBeDefined();
    
    // Call the action handler with default options
    await actionHandler({
      port: '3000',
      host: 'localhost',
      watch: true,
      open: false
    });
    
    // Check if server was started
    expect(cpMock.spawn).toHaveBeenCalled();
    
    // Verify environment variables were set
    expect(process.env.PORT).toBe('3000');
    expect(process.env.HOST).toBe('localhost');
  });
  
  test('dev command fails if not in a Verb project', async () => {
    expect(actionHandler).toBeDefined();
    
    // Mock package.json to indicate not a Verb project
    fsMock.mocks.readFileSync.mockImplementation(() => JSON.stringify({
      dependencies: {}
    }));
    
    // Call the action handler
    await actionHandler({});
    
    // Check if error was logged and process.exit was called
    expect(consoleMock.errors.some(msg => msg.includes('Error: Not a Verb project'))).toBe(true);
    expect(exitMock.exitMock).toHaveBeenCalledWith(1);
  });
  
  test('dev command fails if entry point not found', async () => {
    expect(actionHandler).toBeDefined();
    
    // Mock file existence checks to indicate no entry point
    fsMock.mocks.existsSync.mockImplementation((path) => {
      if (path.includes('package.json')) return true;
      return false;
    });
    
    // Call the action handler
    await actionHandler({});
    
    // Check if error was logged and process.exit was called
    expect(consoleMock.errors.some(msg => msg.includes('Error: Could not find entry point'))).toBe(true);
    expect(exitMock.exitMock).toHaveBeenCalledWith(1);
  });
  
  test('dev command with custom port and host', async () => {
    expect(actionHandler).toBeDefined();
    
    // Call the action handler with custom options
    await actionHandler({
      port: '8080',
      host: '0.0.0.0',
      watch: true,
      open: false
    });
    
    // Check if server was started with custom options
    expect(cpMock.spawn).toHaveBeenCalled();
    
    // Verify environment variables were set
    expect(process.env.PORT).toBe('8080');
    expect(process.env.HOST).toBe('0.0.0.0');
  });
  
  test('dev command sets up file watching when enabled', async () => {
    expect(actionHandler).toBeDefined();
    
    // Call the action handler with watch enabled
    await actionHandler({
      port: '3000',
      host: 'localhost',
      watch: true,
      open: false
    });
    
    // Get the chokidar module
    const { watch } = await import('chokidar');
    
    // Check if watcher was set up
    expect(watch).toHaveBeenCalledWith(['src/**/*', 'public/**/*'], expect.any(Object));
    
    // Get the watcher instance
    const watcher = watch();
    
    // Check if event handlers were registered
    expect(watcher.on).toHaveBeenCalledWith('change', expect.any(Function));
    
    // Simulate a file change
    const changeCallback = (watcher as any).changeCallback;
    if (changeCallback) {
      // Clear previous spawn calls
      cpMock.spawn.mock.calls = [];
      
      // Trigger the change callback
      changeCallback('src/index.ts');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Check if server was restarted
      expect(consoleMock.logs.some(msg => msg.includes('Restarting server'))).toBe(true);
    }
  });
  
  test('dev command detects package manager correctly', async () => {
    expect(actionHandler).toBeDefined();
    
    // Mock different lockfiles
    fsMock.mocks.existsSync.mockImplementation((path) => {
      if (path.includes('package.json')) return true;
      if (path.includes('src/index.ts')) return true;
      if (path.includes('yarn.lock')) return true;
      return false;
    });
    
    // Call the action handler
    await actionHandler({});
    
    // Check if yarn was used
    expect(cpMock.spawn).toHaveBeenCalledWith('yarn', ['dev'], expect.any(Object));
    
    // Reset mock
    cpMock.spawn.mock.calls = [];
    
    // Mock npm lockfile
    fsMock.mocks.existsSync.mockImplementation((path) => {
      if (path.includes('package.json')) return true;
      if (path.includes('src/index.ts')) return true;
      if (path.includes('yarn.lock')) return false;
      if (path.includes('pnpm-lock.yaml')) return false;
      if (path.includes('bun.lockb')) return false;
      return false;
    });
    
    // Call the action handler again
    await actionHandler({});
    
    // Check if npm was used
    expect(cpMock.spawn).toHaveBeenCalledWith('npm', ['run', 'dev'], expect.any(Object));
  });
});