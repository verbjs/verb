import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';

// Direct mock of fs-extra with error-throwing functions
const mockFsExtra = {
  existsSync: mock(() => true),
  statSync: mock(() => { throw new Error('Stat error'); }),
  readFileSync: mock(() => { throw new Error('Read file error'); }),
  writeFileSync: mock(() => { throw new Error('Write file error'); }),
  ensureDirSync: mock(() => { throw new Error('Ensure dir error'); }),
  copyFileSync: mock(() => { throw new Error('Copy file error'); }),
  copySync: mock(() => { throw new Error('Copy dir error'); }),
  removeSync: mock(() => { throw new Error('Remove error'); }),
  readJsonSync: mock(() => { throw new Error('Read JSON error'); }),
  writeJsonSync: mock(() => { throw new Error('Write JSON error'); }),
  readdirSync: mock(() => { throw new Error('Read dir error'); })
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

describe('FileSystem Error Handling', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    Object.values(mockFsExtra).forEach(mockFn => {
      if (typeof mockFn === 'function' && mockFn.mock) {
        mockFn.mockReset();
      }
    });
    
    // Set up default error behaviors
    mockFsExtra.statSync.mockImplementation(() => { throw new Error('Stat error'); });
    mockFsExtra.readFileSync.mockImplementation(() => { throw new Error('Read file error'); });
    mockFsExtra.ensureDirSync.mockImplementation(() => { throw new Error('Ensure dir error'); });
    mockFsExtra.removeSync.mockImplementation(() => { throw new Error('Remove error'); });
    mockFsExtra.readJsonSync.mockImplementation(() => { throw new Error('Read JSON error'); });
    mockFsExtra.readdirSync.mockImplementation(() => { throw new Error('Read dir error'); });
  });
  
  test('fileExists handles errors gracefully', () => {
    const result = FileSystem.fileExists('/path/to/file.txt');
    expect(result).toBe(false);
  });
  
  test('dirExists handles errors gracefully', () => {
    const result = FileSystem.dirExists('/path/to/dir');
    expect(result).toBe(false);
  });
  
  test('readFile throws error on failure', () => {
    expect(() => {
      FileSystem.readFile('/path/to/file.txt');
    }).toThrow();
  });
  
  test('writeFile throws error on failure', () => {
    expect(() => {
      FileSystem.writeFile('/path/to/file.txt', 'content');
    }).toThrow();
  });
  
  test('copyFile throws error on failure', () => {
    expect(() => {
      FileSystem.copyFile('/source/file.txt', '/dest/file.txt');
    }).toThrow();
  });
  
  test('copyDir throws error on failure', () => {
    expect(() => {
      FileSystem.copyDir('/source/dir', '/dest/dir');
    }).toThrow();
  });
  
  test('remove throws error on failure', () => {
    mockFsExtra.removeSync.mockImplementation(() => {
      throw new Error('Remove error');
    });
    
    expect(() => {
      FileSystem.remove('/path/to/remove');
    }).toThrow('Remove error');
  });
  
  test('readJson throws error on failure', () => {
    expect(() => {
      FileSystem.readJson('/path/to/file.json');
    }).toThrow();
  });
  
  test('writeJson throws error on failure', () => {
    expect(() => {
      FileSystem.writeJson('/path/to/file.json', {});
    }).toThrow();
  });
  
  test('getAllFiles handles errors gracefully', () => {
    expect(() => {
      FileSystem.getAllFiles('/test/dir');
    }).toThrow();
  });
});