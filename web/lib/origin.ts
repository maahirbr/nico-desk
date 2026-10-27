import { AsyncLocalStorage } from 'node:async_hooks';

// Where a change came from. The app writes 'app'; the MCP route (app/api/mcp/) runs each tool call inside
// via.run('claude', ...), so every event it writes is marked and the history shows "via Claude".
export type Via = 'claude';
export const via = new AsyncLocalStorage<Via>();
export const originNow = (): 'app' | Via => via.getStore() ?? 'app';
