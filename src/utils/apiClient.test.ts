import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage in Node.js test environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

import { apiClient } from './apiClient';

test('ApiClient - default server URL behavior', () => {
  const defaultUrl = apiClient.getDefaultServerUrl();
  assert.ok(defaultUrl.endsWith('/api'), 'Default server URL should end with /api');
});

test('ApiClient - server URL set, get and reset', () => {
  apiClient.resetServerUrl();
  const initial = apiClient.getServerUrl();
  assert.equal(initial, apiClient.getDefaultServerUrl());

  apiClient.setServerUrl('http://192.168.1.100:3000/api/');
  assert.equal(apiClient.getServerUrl(), 'http://192.168.1.100:3000/api');

  apiClient.resetServerUrl();
  assert.equal(apiClient.getServerUrl(), apiClient.getDefaultServerUrl());
});

test('ApiClient - auto-cleans trailing slash', () => {
  apiClient.setServerUrl('http://10.0.0.5:8080/api///');
  assert.equal(apiClient.getServerUrl(), 'http://10.0.0.5:8080/api');
  apiClient.resetServerUrl();
});

test('ApiClient - handles mixed content security detection on HTTPS', () => {
  (globalThis as any).window = {
    location: {
      protocol: 'https:',
      origin: 'https://ais-dev.run.app'
    }
  };

  // Setting insecure HTTP LAN IP while on HTTPS origin
  apiClient.setServerUrl('http://192.168.1.50:4000/api');
  const resolved = apiClient.getServerUrl();
  
  // Should auto-fallback to origin default instead of insecure HTTP that browsers block
  assert.equal(resolved, 'https://ais-dev.run.app/api');

  apiClient.resetServerUrl();
  delete (globalThis as any).window;
});
