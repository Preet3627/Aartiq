const Store = require('electron-store');

const DEFAULT_NETWORK_SECURITY_CONFIG = {
  firewallLevel: 'standard',
  proxyMode: 'system',
  proxyRules: '',
  proxyBypassRules: '<local>;localhost;127.0.0.1;::1',
  enableSecureDns: false,
  dnsProvider: 'cloudflare',
  customDnsTemplate: '',
  blockAds: true,
  blockTrackers: true,
  blockMalware: true,
  upgradeInsecureRequests: false,
  sendDoNotTrack: true,
  preventWebRtcLeaks: true,
  customBlockedDomains: '',
};

const DNS_PROVIDER_TEMPLATES = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/dns-query',
  quad9: 'https://dns.quad9.net/dns-query',
};

const TRACKER_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'hotjar.com',
  'segment.io',
  'mixpanel.com',
  'amplitude.com',
];

const AD_HOSTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'adservice.google.com',
  'ads.yahoo.com',
  'taboola.com',
  'outbrain.com',
];

const MALWARE_HOSTS = [
  'coinhive.com',
  'cryptoloot.pro',
  'coinimp.com',
  'webmine.cz',
];

function normalizeNetworkSecurityConfig(config = {}) {
  const merged = {
    ...DEFAULT_NETWORK_SECURITY_CONFIG,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    ...merged,
    firewallLevel: ['standard', 'strict', 'paranoid'].includes(merged.firewallLevel) ? merged.firewallLevel : 'standard',
    proxyMode: ['system', 'direct', 'fixed_servers', 'auto_detect'].includes(merged.proxyMode) ? merged.proxyMode : 'system',
    dnsProvider: ['cloudflare', 'google', 'quad9', 'custom'].includes(merged.dnsProvider) ? merged.dnsProvider : 'cloudflare',
    proxyRules: `${merged.proxyRules || ''}`.trim(),
    proxyBypassRules: `${merged.proxyBypassRules || ''}`.trim(),
    customDnsTemplate: `${merged.customDnsTemplate || ''}`.trim(),
    customBlockedDomains: `${merged.customBlockedDomains || ''}`.trim(),
    enableSecureDns: !!merged.enableSecureDns,
    blockAds: !!merged.blockAds,
    blockTrackers: !!merged.blockTrackers,
    blockMalware: !!merged.blockMalware,
    upgradeInsecureRequests: !!merged.upgradeInsecureRequests,
    sendDoNotTrack: !!merged.sendDoNotTrack,
    preventWebRtcLeaks: merged.preventWebRtcLeaks !== false,
  };
}

function getSecureDnsTemplate(config) {
  if (!config.enableSecureDns) {
    return '';
  }
  if (config.dnsProvider === 'custom') {
    return config.customDnsTemplate;
  }
  return DNS_PROVIDER_TEMPLATES[config.dnsProvider] || '';
}

function matchesBlockedHost(hostname, patterns = []) {
  const host = `${hostname || ''}`.toLowerCase();
  return patterns.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
}

function getCustomBlockedDomains(config) {
  return `${config.customBlockedDomains || ''}`
    .split(/[\n,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivateHostname(hostname = '') {
  const host = `${hostname || ''}`.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function shouldUpgradeRequestToHttps(targetUrl, config) {
  if (!config.upgradeInsecureRequests) {
    return false;
  }
  try {
    const parsed = new URL(targetUrl);
    return parsed.protocol === 'http:' && !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function buildProxyConfig(config) {
  if (config.proxyMode === 'fixed_servers' && config.proxyRules) {
    return {
      mode: 'fixed_servers',
      proxyRules: config.proxyRules,
      proxyBypassRules: config.proxyBypassRules || DEFAULT_NETWORK_SECURITY_CONFIG.proxyBypassRules,
    };
  }
  if (config.proxyMode === 'direct') {
    return { mode: 'direct' };
  }
  if (config.proxyMode === 'auto_detect') {
    return { mode: 'auto_detect' };
  }
  return { mode: 'system' };
}

class NetworkSecurityManager {
  constructor(store) {
    this.store = store;
    this.config = normalizeNetworkSecurityConfig(store.get('networkSecurityConfig'));
  }

  getConfig() {
    return this.config;
  }

  updateConfig(updates) {
    this.config = normalizeNetworkSecurityConfig({
      ...this.config,
      ...updates,
    });
    this.store.set('networkSecurityConfig', this.config);
    return this.config;
  }

  applyStartupSettings(app) {
    const dnsTemplate = getSecureDnsTemplate(this.config);
    if (dnsTemplate) {
      app.commandLine.appendSwitch('dns-over-https-mode', 'secure');
      app.commandLine.appendSwitch('dns-over-https-templates', dnsTemplate);
    }
    if (this.config.preventWebRtcLeaks) {
      app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
      app.commandLine.appendSwitch('enforce-webrtc-ip-permission-check');
    }
  }

  async applyToSession(targetSession) {
    if (!targetSession || typeof targetSession.setProxy !== 'function') {
      return;
    }
    try {
      await targetSession.setProxy(buildProxyConfig(this.config));
      if (typeof targetSession.closeAllConnections === 'function') {
        targetSession.closeAllConnections().catch(() => {});
      }
    } catch (error) {
      console.error('[NetworkSecurity] Failed to apply proxy config:', error);
    }
  }

  isHostBlocked(hostname) {
    const customBlocked = getCustomBlockedDomains(this.config);
    const allBlocked = [
      ...(this.config.blockAds ? AD_HOSTS : []),
      ...(this.config.blockTrackers ? TRACKER_HOSTS : []),
      ...(this.config.blockMalware ? MALWARE_HOSTS : []),
      ...customBlocked,
    ];
    return matchesBlockedHost(hostname, allBlocked);
  }
}

module.exports = {
  NetworkSecurityManager,
  DEFAULT_NETWORK_SECURITY_CONFIG,
  normalizeNetworkSecurityConfig,
  buildProxyConfig,
  getSecureDnsTemplate,
  isPrivateHostname,
  shouldUpgradeRequestToHttps,
  matchesBlockedHost,
};
