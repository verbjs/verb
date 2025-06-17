import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import path from 'path';

// Direct mock of fs-extra
const mockFsExtra = {
  existsSync: mock(() => true),
  statSync: mock(() => ({
    isFile: () => true,
    isDirectory: () => true
  })),
  readFileSync: mock(() => 'mock file content'),
  writeFileSync: mock(() => {}),
  ensureDirSync: mock(() => {}),
  copyFileSync: mock(() => {}),
  copySync: mock(() => {}),
  removeSync: mock(() => {}),
  readJsonSync: mock(() => ({ mock: 'data' })),
  writeJsonSync: mock(() => {}),
  readdirSync: mock(() => ['file1.txt', 'subdir'])
};

// Mock the fs-extra module
mock.module('fs-extra', () => {
  return {
    ...mockFsExtra,
    default: mockFsExtra
  };
});

// Import FileSystem after mocking
import { FileSystem } from '../../src/utils/fs';

describe('FileSystem Utility', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockFsExtra.existsSync.mockReset().mockImplementation(() => true);
    mockFsExtra.statSync.mockReset().mockImplementation(() => ({
      isFile: () => true,
      isDirectory: () => true
    }));
    mockFsExtra.readFileSync.mockReset().mockImplementation(() => 'mock file content');
    mockFsExtra.writeFileSync.mockReset();
    mockFsExtra.ensureDirSync.mockReset();
    mockFsExtra.copyFileSync.mockReset();
    mockFsExtra.copySync.mockReset();
    mockFsExtra.removeSync.mockReset();
    mockFsExtra.readJsonSync.mockReset().mockImplementation(() => ({ mock: 'data' }));
    mockFsExtra.writeJsonSync.mockReset();
    mockFsExtra.readdirSync.mockReset().mockImplementation(() => ['file1.txt', 'subdir']);
  });
  
  test('fileExists returns true when file exists', () => {
    mockFsExtra.statSync.mockImplementation(() => ({
      isFile: () => true,
      isDirectory: () => false
    }));
    
    const result = FileSystem.fileExists('/path/to/file.txt');
    expect(result).toBe(true);
    expect(mockFsExtra.statSync).toHaveBeenCalledWith('/path/to/file.txt');
  });
  
  test('fileExists returns false when file does not exist', () => {
    mockFsExtra.statSync.mockImplementation(() => {
      throw new Error('File not found');
    });
    
    const result = FileSystem.fileExists('/path/to/nonexistent.txt');
    expect(result).toBe(false);
  });
  
  test('dirExists returns true when directory exists', () => {
    mockFsExtra.statSync.mockImplementation(() => ({
      isFile: () => false,
      isDirectory: () => true
    }));
    
    const result = FileSystem.dirExists('/path/to/dir');
    expect(result).toBe(true);
    expect(mockFsExtra.statSync).toHaveBeenCalledWith('/path/to/dir');
  });
  
  test('dirExists returns false when directory does not exist', () => {
    mockFsExtra.statSync.mockImplementation(() => {
      throw new Error('Directory not found');
    });
    
    const result = FileSystem.dirExists('/path/to/nonexistent');
    expect(result).toBe(false);
  });
  
  test('ensureDir creates directory if it does not exist', () => {
    FileSystem.ensureDir('/path/to/dir');
    expect(mockFsExtra.ensureDirSync).toHaveBeenCalledWith('/path/to/dir');
  });
  
  test('readFile reads file content', () => {
    mockFsExtra.readFileSync.mockImplementation(() => 'file content');
    
    const content = FileSystem.readFile('/path/to/file.txt');
    expect(content).toBe('file content');
    expect(mockFsExtra.readFileSync).toHaveBeenCalledWith('/path/to/file.txt', 'utf8');
  });
  
  test('writeFile writes content to file', () => {
    FileSystem.writeFile('/path/to/file.txt', 'new content');
    expect(mockFsExtra.ensureDirSync).toHaveBeenCalledWith('/path/to');
    expect(mockFsExtra.writeFileSync).toHaveBeenCalledWith('/path/to/file.txt', 'new content');
  });
  
  test('copyFile copies a file', () => {
    FileSystem.copyFile('/source/file.txt', '/dest/file.txt');
    expect(mockFsExtra.ensureDirSync).toHaveBeenCalledWith('/dest');
    expect(mockFsExtra.copyFileSync).toHaveBeenCalledWith('/source/file.txt', '/dest/file.txt');
  });
  
  test('copyDir copies a directory', () => {
    FileSystem.copyDir('/source/dir', '/dest/dir');
    expect(mockFsExtra.ensureDirSync).toHaveBeenCalledWith('/dest/dir');
    expect(mockFsExtra.copySync).toHaveBeenCalledWith('/source/dir', '/dest/dir');
  });
  
  test('remove deletes a file or directory', () => {
    FileSystem.remove('/path/to/remove');
    expect(mockFsExtra.removeSync).toHaveBeenCalledWith('/path/to/remove');
  });
  
  test('readJson reads and parses JSON file', () => {
    const mockData = { key: 'value' };
    mockFsExtra.readJsonSync.mockImplementation(() => mockData);
    
    const data = FileSystem.readJson('/path/to/file.json');
    expect(data).toEqual(mockData);
    expect(mockFsExtra.readJsonSync).toHaveBeenCalledWith('/path/to/file.json');
  });
  
  test('writeJson writes object as JSON file', () => {
    const data = { key: 'value' };
    FileSystem.writeJson('/path/to/file.json', data);
    expect(mockFsExtra.ensureDirSync).toHaveBeenCalledWith('/path/to');
    expect(mockFsExtra.writeJsonSync).toHaveBeenCalledWith('/path/to/file.json', data, { spaces: 2 });
  });
  
  test('getAllFiles gets all files recursively', () => {
    // Mock implementation for recursive directory reading
    mockFsExtra.readdirSync.mockImplementationOnce(() => ['file1.txt', 'subdir']);
    mockFsExtra.statSync.mockImplementationOnce(() => ({
      isFile: () => true,
      isDirectory: () => false
    })).mockImplementationOnce(() => ({
      isFile: () => false,
      isDirectory: () => true
    }));
    
    // For the recursive call to subdir
    mockFsExtra.readdirSync.mockImplementationOnce(() => ['file2.txt']);
    mockFsExtra.statSync.mockImplementationOnce(() => ({
      isFile: () => true,
      isDirectory: () => false
    }));
    
    const files = FileSystem.getAllFiles('/test/dir');
    expect(files.length).toBe(2);
    expect(files).toContain(path.join('/test/dir', 'file1.txt'));
    expect(files).toContain(path.join('/test/dir/subdir', 'file2.txt'));
  });
  
  test('relativePath returns relative path', () => {
    const result = FileSystem.relativePath('/base/dir', '/base/dir/subdir/file.txt');
    expect(result).toBe('subdir/file.txt');
  });
  
  test('joinPath joins path segments', () => {
    const result = FileSystem.joinPath('dir', 'subdir', 'file.txt');
    expect(result).toBe('dir/subdir/file.txt');
  });
  
  test('resolvePath resolves to absolute path', () => {
    const result = FileSystem.resolvePath('dir', 'subdir', 'file.txt');
    expect(result).toContain('dir/subdir/file.txt');
  });
});