import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Globe, Lock, Server, Shield, ShieldAlert } from 'lucide-react';

type FirewallLevel = 'standard' | 'strict' | 'paranoid';
type ProxyMode = 'system' | 'direct' | 'fixed_servers' | 'auto_detect';
type DnsProvider = 'cloudflare' | 'google' | 'quad9' | 'custom';

type NetworkSecurityConfig = {
    firewallLevel: FirewallLevel;
    proxyMode: ProxyMode;
    proxyRules: string;
    proxyBypassRules: string;
    enableSecureDns: boolean;
    dnsProvider: DnsProvider;
    customDnsTemplate: string;
    blockAds: boolean;
    blockTrackers: boolean;
    blockMalware: boolean;
    upgradeInsecureRequests: boolean;
    sendDoNotTrack: boolean;
    preventWebRtcLeaks: boolean;
    customBlockedDomains: string;
};

type NetworkToggleKey =
    | 'blockAds'
    | 'blockTrackers'
    | 'blockMalware'
    | 'upgradeInsecureRequests'
    | 'sendDoNotTrack'
    | 'preventWebRtcLeaks';

const DEFAULT_CONFIG: NetworkSecurityConfig = {
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

const DNS_OPTIONS = [
    { id: 'cloudflare', label: 'Cloudflare', template: 'https://cloudflare-dns.com/dns-query' },
    { id: 'google', label: 'Google Public DNS', template: 'https://dns.google/dns-query' },
    { id: 'quad9', label: 'Quad9', template: 'https://dns.quad9.net/dns-query' },
    { id: 'custom', label: 'Custom Template', template: 'Enter your DoH endpoint below' },
] as const;

const FIREWALL_LEVELS = [
    { id: 'standard', label: 'Standard', desc: 'Balanced browser protection with sane defaults.' },
    { id: 'strict', label: 'Strict', desc: 'Heavier filtering with HTTPS upgrades and stronger privacy.' },
    { id: 'paranoid', label: 'Paranoid', desc: 'Maximum filtering plus anti-leak settings for sensitive sessions.' },
] as const;

const TOGGLES: Array<{ key: NetworkToggleKey; label: string; desc: string }> = [
    { key: 'blockTrackers', label: 'Block trackers', desc: 'Cancel common analytics and beacon hosts before they load.' },
    { key: 'blockAds', label: 'Block ad networks', desc: 'Drop requests to common ad delivery domains.' },
    { key: 'blockMalware', label: 'Block known malware hosts', desc: 'Refuse requests to unsafe or cryptomining domains in the built-in list.' },
    { key: 'upgradeInsecureRequests', label: 'Upgrade HTTP to HTTPS', desc: 'Redirect plain HTTP pages to HTTPS when the target is not local or private.' },
    { key: 'sendDoNotTrack', label: 'Send privacy headers', desc: 'Attach `DNT: 1` and `Sec-GPC: 1` on outgoing requests.' },
    { key: 'preventWebRtcLeaks', label: 'Reduce WebRTC IP leaks', desc: 'Applies Chromium leak-reduction switches. Restart may be required.' },
] as const;

export default function ProxyFirewallManager() {
    const [config, setConfig] = useState<NetworkSecurityConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [restartFields, setRestartFields] = useState<string[]>([]);
    const [status, setStatus] = useState<string>('Loading network controls...');

    useEffect(() => {
        const loadConfig = async () => {
            if (!window.electronAPI?.getNetworkSecurityConfig) {
                setLoading(false);
                setStatus('Network controls are unavailable in this build.');
                return;
            }

            try {
                const result = await window.electronAPI.getNetworkSecurityConfig();
                if (result.success && result.config) {
                    setConfig({ ...DEFAULT_CONFIG, ...result.config });
                    setRestartFields(result.restartRequiredFor || []);
                    setStatus('Network controls loaded from desktop runtime.');
                } else {
                    setStatus('Failed to load network controls.');
                }
            } catch (error: unknown) {
                setStatus(error instanceof Error ? error.message : 'Failed to load network controls.');
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, []);

    const dnsTemplate = useMemo(() => {
        if (config.dnsProvider === 'custom') {
            return config.customDnsTemplate || 'No custom DNS-over-HTTPS template set';
        }

        return DNS_OPTIONS.find((option) => option.id === config.dnsProvider)?.template || '';
    }, [config.dnsProvider, config.customDnsTemplate]);

    const applyConfig = async (nextConfig: NetworkSecurityConfig, message: string) => {
        setConfig(nextConfig);
        setSaving(true);

        try {
            const result = await window.electronAPI?.updateNetworkSecurityConfig?.(nextConfig);
            if (result?.success && result.config) {
                setConfig({ ...DEFAULT_CONFIG, ...result.config });
                setRestartFields(result.restartRequiredFor || []);
                setStatus(message);
            } else {
                setStatus(result?.error || 'Failed to apply network controls.');
            }
        } catch (error: unknown) {
            setStatus(error instanceof Error ? error.message : 'Failed to apply network controls.');
        } finally {
            setSaving(false);
        }
    };

    const updateField = <K extends keyof NetworkSecurityConfig>(key: K, value: NetworkSecurityConfig[K]) => {
        const nextConfig = { ...config, [key]: value };

        if (key === 'firewallLevel') {
            if (value === 'strict') {
                nextConfig.blockTrackers = true;
                nextConfig.blockAds = true;
                nextConfig.upgradeInsecureRequests = true;
            }

            if (value === 'paranoid') {
                nextConfig.blockTrackers = true;
                nextConfig.blockAds = true;
                nextConfig.blockMalware = true;
                nextConfig.upgradeInsecureRequests = true;
                nextConfig.sendDoNotTrack = true;
                nextConfig.preventWebRtcLeaks = true;
                nextConfig.enableSecureDns = true;
            }
        }

        applyConfig(nextConfig, 'Network controls updated.');
    };

    const toggleBooleanField = (key: NetworkToggleKey) => {
        updateField(key, !config[key]);
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-6 overflow-hidden bg-[var(--primary-bg)] p-6 text-[var(--primary-text)]">
            <div className="absolute right-0 top-0 h-80 w-80 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/5 blur-[110px]" />

            <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                        <Shield className="text-emerald-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-widest italic">Nexus Shield</h2>
                        <p className="text-[10px] font-bold tracking-[0.3em] text-[var(--secondary-text)]/50">PROXY, DNS, AND REQUEST GUARD</p>
                    </div>
                </div>
                <div className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] ${saving ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                    {saving ? 'Applying' : 'Live Config'}
                </div>
            </div>

            <div className="relative z-10 grid flex-1 grid-cols-2 gap-6 overflow-hidden">
                <div className="flex flex-col gap-6 overflow-auto rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Server size={18} className="text-sky-400" />
                        <h3 className="text-xs font-black uppercase tracking-widest">Routing & DNS</h3>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--secondary-text)]/50">Firewall Mode</label>
                        <div className="grid gap-3">
                            {FIREWALL_LEVELS.map((level) => (
                                <button
                                    key={level.id}
                                    type="button"
                                    onClick={() => updateField('firewallLevel', level.id)}
                                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${config.firewallLevel === level.id ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'}`}
                                >
                                    <div className="text-sm font-black text-[var(--primary-text)]">{level.label}</div>
                                    <div className="mt-1 text-[11px] text-[var(--secondary-text)]/70">{level.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--secondary-text)]/50">Proxy Mode</label>
                            <select
                                value={config.proxyMode}
                                onChange={(e) => updateField('proxyMode', e.target.value as ProxyMode)}
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none"
                            >
                                <option value="system">System Proxy</option>
                                <option value="direct">Direct Connection</option>
                                <option value="fixed_servers">Fixed Proxy Rules</option>
                                <option value="auto_detect">Auto Detect (WPAD)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--secondary-text)]/50">Secure DNS</label>
                            <button
                                type="button"
                                onClick={() => updateField('enableSecureDns', !config.enableSecureDns)}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm transition-all ${config.enableSecureDns ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-black/20 text-white/60'}`}
                            >
                                <span>{config.enableSecureDns ? 'Enabled' : 'Disabled'}</span>
                                <Globe size={16} />
                            </button>
                        </div>
                    </div>

                    {config.proxyMode === 'fixed_servers' && (
                        <div className="space-y-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-300">Proxy Rules</label>
                                <input
                                    value={config.proxyRules}
                                    onChange={(e) => setConfig((prev) => ({ ...prev, proxyRules: e.target.value }))}
                                    onBlur={() => applyConfig(config, 'Proxy routing updated.')}
                                    placeholder="http=127.0.0.1:8080;https=127.0.0.1:8080;socks5=127.0.0.1:9050"
                                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-300">Bypass Rules</label>
                                <input
                                    value={config.proxyBypassRules}
                                    onChange={(e) => setConfig((prev) => ({ ...prev, proxyBypassRules: e.target.value }))}
                                    onBlur={() => applyConfig(config, 'Proxy bypass list updated.')}
                                    placeholder="<local>;localhost;127.0.0.1"
                                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-300">DNS Provider</label>
                        <div className="grid gap-2">
                            {DNS_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => updateField('dnsProvider', option.id)}
                                    className={`rounded-xl border px-3 py-3 text-left transition-all ${config.dnsProvider === option.id ? 'border-violet-500/30 bg-violet-500/10' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'}`}
                                >
                                    <div className="text-sm font-bold text-white">{option.label}</div>
                                    <div className="mt-1 break-all text-[11px] text-white/50">{option.template}</div>
                                </button>
                            ))}
                        </div>

                        {config.dnsProvider === 'custom' && (
                            <textarea
                                value={config.customDnsTemplate}
                                onChange={(e) => setConfig((prev) => ({ ...prev, customDnsTemplate: e.target.value }))}
                                onBlur={() => applyConfig(config, 'Custom DNS template updated.')}
                                rows={3}
                                placeholder="https://resolver.example/dns-query"
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none"
                            />
                        )}

                        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-[11px] text-white/60">
                            Active template: {dnsTemplate}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6 overflow-auto rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Lock size={18} className="text-emerald-400" />
                        <h3 className="text-xs font-black uppercase tracking-widest">Request Guard</h3>
                    </div>

                    <div className="grid gap-3">
                        {TOGGLES.map((toggle) => (
                            <button
                                key={toggle.key}
                                type="button"
                                onClick={() => toggleBooleanField(toggle.key)}
                                className={`rounded-2xl border px-4 py-3 text-left transition-all ${config[toggle.key] ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'}`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-black text-white">{toggle.label}</div>
                                        <div className="mt-1 text-[11px] text-white/55">{toggle.desc}</div>
                                    </div>
                                    <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] ${config[toggle.key] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/45'}`}>
                                        {config[toggle.key] ? 'On' : 'Off'}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--secondary-text)]/50">Custom Blocked Domains</label>
                        <textarea
                            value={config.customBlockedDomains}
                            onChange={(e) => setConfig((prev) => ({ ...prev, customBlockedDomains: e.target.value }))}
                            onBlur={() => applyConfig(config, 'Domain blocklist updated.')}
                            rows={6}
                            placeholder={'example-tracker.com\nannoying-cdn.net\nads.example.org'}
                            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                        />
                        <p className="text-[11px] text-white/45">One hostname per line. Subdomains are blocked automatically.</p>
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-emerald-300" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300">Runtime Summary</div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-white/65">
                            <div>Firewall level: <span className="font-bold text-white">{config.firewallLevel}</span></div>
                            <div>Proxy mode: <span className="font-bold text-white">{config.proxyMode}</span></div>
                            <div>Secure DNS: <span className="font-bold text-white">{config.enableSecureDns ? config.dnsProvider : 'off'}</span></div>
                            <div>Privacy headers: <span className="font-bold text-white">{config.sendDoNotTrack ? 'on' : 'off'}</span></div>
                        </div>
                    </div>

                    <div className={`rounded-2xl border p-4 ${restartFields.length ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
                        <div className="flex items-center gap-2">
                            {restartFields.length ? <ShieldAlert size={16} className="text-amber-300" /> : <Shield size={16} className="text-emerald-300" />}
                            <div className={`text-[10px] font-black uppercase tracking-[0.3em] ${restartFields.length ? 'text-amber-300' : 'text-emerald-300'}`}>
                                {restartFields.length ? 'Restart Recommended' : 'Applied Live'}
                            </div>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                            {restartFields.length
                                ? 'Secure DNS and WebRTC leak-reduction switches are persisted immediately, but Chromium may need a desktop restart before every tab fully picks them up.'
                                : 'Proxy and request-filter changes are active for new requests right away.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="relative z-10 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                {status}
            </div>
        </div>
    );
}
