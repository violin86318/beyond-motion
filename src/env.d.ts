// Narrow declarations for the build-time asset probe in works/[slug].astro.
// @types/node is intentionally not a dependency.
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  const fs: { existsSync: typeof existsSync };
  export default fs;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
  const path: { resolve: typeof resolve };
  export default path;
}

declare const process: {
  cwd(): string;
};
