import { useEffect, useState } from 'react';

const fallbackVersion = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../package.json').version as string;
  } catch {
    return '0.0.0';
  }
})();

export function useAppVersion(): string {
  const [version, setVersion] = useState<string>(fallbackVersion);

  useEffect(() => {
    let mounted = true;
    const fetchVersion = async () => {
      try {
        const v = await (window as any)?.electronAPI?.getVersion?.();
        if (mounted && v) setVersion(v);
      } catch {
        // fallback stays
      }
    };
    fetchVersion();
    return () => { mounted = false; };
  }, []);

  return version;
}
