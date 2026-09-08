import type { ServerResponse } from 'node:http';
/** Write a JSON response with a stable envelope and no-store caching. */
export declare function writeJson(res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>): void;
