import type { IncomingMessage } from 'node:http';
export declare function isIPv4Loopback(v4: string): boolean;
export declare function isLoopbackAddress(address: string | undefined): boolean;
export declare function isLoopbackHostname(hostname: string): boolean;
export declare function isLoopbackRequest(request: IncomingMessage): boolean;
