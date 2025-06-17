import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mockConsole } from '../setup';
import { Logger } from '../../src/utils/logger';

describe('Logger Utility', () => {
  let consoleMock: ReturnType<typeof mockConsole>;
  let logger: Logger;
  
  beforeEach(() => {
    consoleMock = mockConsole();
    logger = new Logger();
  });
  
  afterEach(() => {
    consoleMock.restore();
  });
  
  test('info method logs with blue info prefix', () => {
    logger.info('Test info message');
    expect(consoleMock.logs.length).toBe(1);
    expect(consoleMock.logs[0]).toContain('info');
    expect(consoleMock.logs[0]).toContain('Test info message');
  });
  
  test('success method logs with green success prefix', () => {
    logger.success('Test success message');
    expect(consoleMock.logs.length).toBe(1);
    expect(consoleMock.logs[0]).toContain('success');
    expect(consoleMock.logs[0]).toContain('Test success message');
  });
  
  test('warn method logs with yellow warning prefix', () => {
    logger.warn('Test warning message');
    expect(consoleMock.logs.length).toBe(1);
    expect(consoleMock.logs[0]).toContain('warning');
    expect(consoleMock.logs[0]).toContain('Test warning message');
  });
  
  test('error method logs with red error prefix', () => {
    logger.error('Test error message');
    expect(consoleMock.errors.length).toBe(1);
    expect(consoleMock.errors[0]).toContain('error');
    expect(consoleMock.errors[0]).toContain('Test error message');
  });
  
  test('debug method logs only in verbose mode', () => {
    // Default is non-verbose
    logger.debug('Test debug message');
    expect(consoleMock.logs.length).toBe(0);
    
    // Enable verbose mode
    logger.setVerbose(true);
    logger.debug('Test debug message');
    expect(consoleMock.logs.length).toBe(1);
    expect(consoleMock.logs[0]).toContain('debug');
    expect(consoleMock.logs[0]).toContain('Test debug message');
  });
  
  test('log method with custom label and color', () => {
    logger.log('custom', 'Test custom message');
    expect(consoleMock.logs.length).toBe(1);
    expect(consoleMock.logs[0]).toContain('custom');
    expect(consoleMock.logs[0]).toContain('Test custom message');
  });
  
  test('section method creates formatted section header', () => {
    logger.section('Test Section');
    // Should have 4 logs: blank line, title, separator, blank line
    expect(consoleMock.logs.length).toBe(4);
    expect(consoleMock.logs[1]).toContain('Test Section');
  });
  
  test('blank method adds an empty line', () => {
    logger.blank();
    expect(consoleMock.logs.length).toBe(1);
    expect(consoleMock.logs[0]).toBe('');
  });
});