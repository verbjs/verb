import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mockConsole, mockProcessExit } from './setup';
import { Command } from 'commander';

// Mock the commander package
mock.module('commander', () => {
  const mockCommand = {
    name: mock(() => mockCommand),
    description: mock(() => mockCommand),
    version: mock(() => mockCommand),
    option: mock(() => mockCommand),
    on: mock(() => mockCommand),
    commands: [],
    parseAsync: mock(async () => {}),
  };
  
  return {
    Command: mock(() => mockCommand)
  };
});

// Mock the commands module
mock.module('../src/commands', () => {
  return {
    registerCommands: mock(() => {})
  };
});

describe('CLI Main', () => {
  let consoleMock: ReturnType<typeof mockConsole>;
  let exitMock: ReturnType<typeof mockProcessExit>;
  
  beforeEach(() => {
    consoleMock = mockConsole();
    exitMock = mockProcessExit();
    
    // Clear module cache to ensure fresh imports
    delete require.cache[require.resolve('../src/main')];
  });
  
  afterEach(() => {
    consoleMock.restore();
    exitMock.restore();
  });
  
  test('CLI initialization with version', async () => {
    // Import the main module
    const main = await import('../src/main');
    
    // Get the mocked Command instance
    const { Command } = await import('commander');
    const commandInstance = Command();
    
    // Verify the CLI is initialized with the correct name, description, and version
    expect(commandInstance.name).toHaveBeenCalledWith('vrb');
    expect(commandInstance.description).toHaveBeenCalledWith('Verb CLI - A toolkit for Verb framework');
    expect(commandInstance.version).toHaveBeenCalled();
  });
  
  test('Command registration works', async () => {
    // Import the main module
    const main = await import('../src/main');
    
    // Get the mocked registerCommands function
    const { registerCommands } = await import('../src/commands');
    
    // Verify registerCommands was called with the Command instance
    expect(registerCommands).toHaveBeenCalled();
  });
  
  test('Unknown command handling', async () => {
    // Import the main module
    const main = await import('../src/main');
    
    // Get the mocked Command instance
    const { Command } = await import('commander');
    const commandInstance = Command();
    
    // Simulate unknown command event
    const onHandler = commandInstance.on.mock.calls.find(call => call[0] === 'command:*');
    expect(onHandler).toBeDefined();
    
    if (onHandler) {
      // Call the handler with an unknown command
      const handler = onHandler[1];
      handler(['unknown-command']);
      
      // Verify error message was logged
      expect(consoleMock.errors.some(msg => msg.includes("Error: Unknown command 'unknown-command'"))).toBe(true);
      
      // Verify process.exit was called with code 1
      expect(exitMock.exitMock).toHaveBeenCalledWith(1);
    }
  });
});