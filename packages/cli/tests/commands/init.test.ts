import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mockConsole, mockFsExtra, mockChildProcess } from '../setup';
import { Command } from 'commander';

// Mock inquirer
mock.module('inquirer', () => {
  const promptMock = mock(async () => ({
    name: 'test-project',
    description: 'Test project description',
    template: 'basic',
    packageManager: 'bun',
    features: ['typescript', 'static-files']
  }));
  
  return {
    prompt: promptMock,
    default: {
      prompt: promptMock
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

describe('Init Command', () => {
  let consoleMock: ReturnType<typeof mockConsole>;
  let fsMock: ReturnType<typeof mockFsExtra>;
  let cpMock: ReturnType<typeof mockChildProcess>;
  let command: Command;
  let actionHandler: Function;
  
  beforeEach(async () => {
    consoleMock = mockConsole();
    fsMock = mockFsExtra();
    cpMock = mockChildProcess();
    
    // Create a new Command instance
    command = new Command();
    command.command = mock(() => command);
    command.description = mock(() => command);
    command.argument = mock(() => command);
    command.option = mock(() => command);
    command.action = mock((handler) => {
      actionHandler = handler;
      return command;
    });
    
    // Import the init command
    const { initCommand } = await import('../../src/commands/init');
    
    // Register the command
    initCommand(command);
  });
  
  afterEach(() => {
    consoleMock.restore();
    fsMock.restore();
    cpMock.restore();
  });
  
  test('init command registers with correct options', () => {
    expect(command.command).toHaveBeenCalledWith('init');
    expect(command.description).toHaveBeenCalledWith('Initialize a new Verb project');
    expect(command.argument).toHaveBeenCalledWith('[name]', 'Project name');
    expect(command.option).toHaveBeenCalledWith('-t, --template <template>', 'Project template (basic, api, fullstack, static)', 'basic');
    expect(command.option).toHaveBeenCalledWith('-y, --yes', 'Skip prompts and use defaults');
    expect(command.option).toHaveBeenCalledWith('--package-manager <manager>', 'Package manager to use (bun, npm, yarn, pnpm)', 'bun');
    expect(command.action).toHaveBeenCalled();
  });
  
  test('init command with name and --yes flag skips prompts', async () => {
    expect(actionHandler).toBeDefined();
    
    // Call the action handler with name and --yes flag
    await actionHandler('test-project', { yes: true, template: 'api', packageManager: 'npm' });
    
    // Inquirer should not be called for prompts
    const { prompt } = await import('inquirer');
    expect(prompt).not.toHaveBeenCalled();
    
    // Check if project creation functions were called
    expect(fsMock.mocks.mkdirSync).toHaveBeenCalled();
    expect(fsMock.mocks.writeFileSync).toHaveBeenCalled();
    expect(cpMock.execSync).toHaveBeenCalled();
  });
  
  test('init command with interactive mode prompts for options', async () => {
    expect(actionHandler).toBeDefined();
    
    // Call the action handler without --yes flag
    await actionHandler(undefined, {});
    
    // Inquirer should be called for prompts
    const { prompt } = await import('inquirer');
    expect(prompt).toHaveBeenCalled();
    
    // Check if project creation functions were called
    expect(fsMock.mocks.mkdirSync).toHaveBeenCalled();
    expect(fsMock.mocks.writeFileSync).toHaveBeenCalled();
    expect(cpMock.execSync).toHaveBeenCalled();
  });
  
  test('init command handles existing directory', async () => {
    expect(actionHandler).toBeDefined();
    
    // Mock existsSync to return true (directory exists)
    fsMock.mocks.existsSync.mockImplementation(() => true);
    
    // Mock inquirer to confirm overwrite
    const { prompt } = await import('inquirer');
    (prompt as any).mockImplementationOnce(async () => ({
      name: 'test-project',
      description: 'Test project description',
      template: 'basic',
      packageManager: 'bun',
      features: ['typescript']
    })).mockImplementationOnce(async () => ({
      overwrite: true
    }));
    
    // Call the action handler
    await actionHandler('test-project', {});
    
    // Check if removeSync was called to remove existing directory
    expect(fsMock.mocks.removeSync).toHaveBeenCalled();
    expect(fsMock.mocks.mkdirSync).toHaveBeenCalled();
  });
  
  test('init command creates files based on template', async () => {
    expect(actionHandler).toBeDefined();
    
    // Call the action handler
    await actionHandler('test-project', { yes: true });
    
    // Check if files were created
    expect(fsMock.mocks.writeFileSync).toHaveBeenCalledTimes(expect.any(Number));
    
    // Check for specific files
    const writeFileCalls = fsMock.mocks.writeFileSync.mock.calls;
    const filePathsWritten = writeFileCalls.map(call => call[0]);
    
    // Check for essential files
    expect(filePathsWritten.some(path => path.includes('src/index.ts'))).toBe(true);
    expect(filePathsWritten.some(path => path.includes('README.md'))).toBe(true);
    expect(filePathsWritten.some(path => path.includes('package.json'))).toBe(true);
    expect(filePathsWritten.some(path => path.includes('public/index.html'))).toBe(true);
  });
});