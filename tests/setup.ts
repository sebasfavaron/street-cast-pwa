// Jest setup file
import 'jest-dom/extend-expect';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
  cmp: jest.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();
