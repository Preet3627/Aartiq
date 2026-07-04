// Simple static version constant sourced from package.json (build-time)
// Use useAppVersion hook when you need runtime-resolved value from Electron.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const APP_VERSION: string = (() => {
  try {
    return require('../../package.json').version as string;
  } catch {
    return '0.0.0';
  }
})();
