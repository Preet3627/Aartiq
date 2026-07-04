"use client";

import React, { useState } from 'react';

const userAgents: Record<string, { name: string; ua: string }> = {
    default: { name: 'Comet (Default)', ua: '' },
    chrome_win: { name: 'Chrome 131 on Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.205 Safari/537.36' },
    chrome_mac: { name: 'Chrome 131 on macOS', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.205 Safari/537.36' },
    firefox_win: { name: 'Firefox 133 on Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0' },
    safari_mac: { name: 'Safari 18 on macOS', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15' },
    iphone: { name: 'iPhone 16 (Mobile)', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1' },
    android: { name: 'Chrome on Android', ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36' },
};

const UserAgentSettings = () => {
    const [selected, setSelected] = useState('default');

    const applyUA = async (key: string) => {
        setSelected(key);
        const ua = userAgents[key].ua;
        if (window.electronAPI) {
            await window.electronAPI.setUserAgent(ua);
            alert(`User Agent switched to ${userAgents[key].name}. Please reload the tab.`);
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
                {Object.entries(userAgents).map(([key, info]) => (
                    <button
                        key={key}
                        onClick={() => applyUA(key)}
                        className={`w-full px-4 py-3 flex items-center justify-between rounded-2xl border transition-all ${selected === key
                            ? 'bg-deep-space-accent-neon/10 border-deep-space-accent-neon text-deep-space-accent-neon'
                            : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        <span className="text-sm font-bold">{info.name}</span>
                        {selected === key && <span className="text-[10px] uppercase font-black tracking-widest">Active</span>}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default UserAgentSettings;
