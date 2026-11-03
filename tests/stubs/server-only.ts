/**
 * Vitest stand-in for the `server-only` marker module. Next resolves the real
 * package at build time to stop server code leaking into client bundles; under
 * Vitest we only need the import to resolve.
 */
export {};
