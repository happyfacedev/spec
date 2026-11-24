// Replaced by esbuild's define in dist/spec; undefined when run from source.
declare const __SPEC_VERSION__: string | undefined;

export const VERSION: string = typeof __SPEC_VERSION__ === 'string' ? __SPEC_VERSION__ : '0.0.0-dev';
