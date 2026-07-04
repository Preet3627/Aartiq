"use client";

import React, { useState, useEffect } from 'react';
import {
  RefreshCw, Download, AlertTriangle, Info, ChevronDown, ChevronUp,
  GitBranch, Rocket, Tag, ExternalLink, CheckCircle2, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';

interface Release {
  id: string;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  html_url: string;
  assets: Array<{
    id: number;
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseName?: string;
  releaseNotes?: string;
}

const UpdatesSettings = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [expandedReleaseId, setExpandedReleaseId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState<boolean>(false);
  const [checkingForUpdates, setCheckingForUpdates] = useState<boolean>(false);

  useEffect(() => {
    initializeSettings();
    
    if (window.electronAPI) {
      window.electronAPI.on('update-available', (info: UpdateInfo) => {
        setUpdateAvailable(info);
        setIsDownloading(true);
      });

      window.electronAPI.on('download-progress', (progress: { percent: number }) => {
        setDownloadProgress(Math.round(progress.percent));
      });

      window.electronAPI.on('update-downloaded', () => {
        setIsDownloading(false);
        setUpdateDownloaded(true);
        setDownloadProgress(100);
      });

      window.electronAPI.on('update-not-available', () => {
        setCheckingForUpdates(false);
      });

      window.electronAPI.on('update-error', (error: string) => {
        setError(error);
        setIsDownloading(false);
        setCheckingForUpdates(false);
      });
    }
  }, []);

  const initializeSettings = async () => {
    try {
      if (window.electronAPI) {
        const version = await window.electronAPI.getVersion();
        if (version) setCurrentVersion(version);
      }
      await fetchReleases();
    } catch (err) {
      console.error('Error initializing settings:', err);
      setError('Failed to initialize update settings');
    }
  };

  const fetchReleases = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://api.github.com/repos/Preet3627/Aartiq/releases');
      if (!response.ok) throw new Error(`Failed to fetch releases: ${response.status}`);
      
      const data: Release[] = await response.json();
      const filteredReleases = data
        .filter((release: Release) => !release.prerelease)
        .sort((a: Release, b: Release) => 
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
        );
      
      setReleases(filteredReleases);
    } catch (err) {
      console.error('Error fetching releases:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      setCheckingForUpdates(true);
      setError(null);
      if (window.electronAPI) await window.electronAPI.checkForUpdates();
      await fetchReleases();
    } catch (err) {
      console.error('Error checking for updates:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCheckingForUpdates(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      setIsDownloading(true);
      if (window.electronAPI) {
        await window.electronAPI.clearAuthData();
        await window.electronAPI.quitAndInstall();
      }
    } catch (err) {
      console.error('Error installing update:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsDownloading(false);
    }
  };

  const handleDownloadRelease = async (release: Release) => {
    try {
      let downloadUrl = release.html_url;
      
      if (window.electronAPI) {
        const platform = await window.electronAPI.getPlatform();
        const asset = release.assets.find(a => {
          const name = a.name.toLowerCase();
          if (platform === 'win32') return name.endsWith('.exe') || name.endsWith('.msi');
          if (platform === 'darwin') return name.endsWith('.dmg') || name.endsWith('.zip');
          return name.endsWith('.appimage') || name.endsWith('.deb');
        });
        if (asset) downloadUrl = asset.browser_download_url;
        await window.electronAPI.openExternalUrl(downloadUrl);
      } else {
        window.open(downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Error downloading release:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const isNewerVersion = (releaseTag: string) => {
    const release = releaseTag.replace(/^v/, '').split('.').map(Number);
    const current = (currentVersion || '0.0.0').split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if ((release[i] || 0) > (current[i] || 0)) return true;
      if ((release[i] || 0) < (current[i] || 0)) return false;
    }
    return false;
  };

  if (loading && releases.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="h-8 w-8 text-cyan-400" />
          </motion.div>
          <p className="text-sm text-white/40">Loading release history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.3)]">
          <Rocket className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Updates</h2>
          <p className="text-xs text-white/40">Manage your browser version and updates</p>
        </div>
      </div>

      {/* Version Cards */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all"
        >
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-white/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Current</span>
          </div>
          <p className="text-3xl font-black text-white tracking-tight">{currentVersion || '—'}</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all"
        >
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Latest</span>
          </div>
          <p className="text-3xl font-black text-cyan-400 tracking-tight">
            {releases.length > 0 ? releases[0].tag_name.replace(/^v/, '') : '—'}
          </p>
        </motion.div>
      </div>

      {/* Update Available Banner */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400">v{updateAvailable.version} Available</h3>
                    <p className="text-xs text-white/40">Released {formatDate(updateAvailable.releaseDate)}</p>
                  </div>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  disabled={isDownloading}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  {isDownloading ? `${downloadProgress}%` : 'Install Now'}
                </button>
              </div>
              
              {isDownloading && (
                <div className="mt-4">
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${downloadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Downloaded Banner */}
      <AnimatePresence>
        {updateDownloaded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-blue-400">Ready to Install</h3>
                    <p className="text-xs text-white/40">Restart to complete update</p>
                  </div>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-black rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                >
                  Restart Now
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button 
          onClick={handleCheckForUpdates}
          disabled={checkingForUpdates}
          className="flex items-center gap-2 px-5 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-2xl text-sm font-bold transition-all border border-white/[0.06] hover:border-white/[0.12]"
        >
          <RefreshCw className={`h-4 w-4 ${checkingForUpdates ? 'animate-spin' : ''}`} />
          <span>{checkingForUpdates ? 'Checking...' : 'Check for Updates'}</span>
        </button>
        
        {releases.length > 0 && (
          <button
            onClick={() => handleDownloadRelease(releases[0])}
            className="flex items-center gap-2 px-5 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-2xl text-sm font-bold transition-all border border-cyan-500/20 hover:border-cyan-500/40"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Download Latest</span>
          </button>
        )}
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Release History */}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Release History</h3>
        
        <div className="space-y-3">
          {releases.map((release: Release, index) => {
            const isNewer = isNewerVersion(release.tag_name);
            
            return (
              <motion.div
                key={release.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  expandedReleaseId === release.id 
                    ? 'bg-white/[0.04] border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]' 
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer group"
                  onClick={() => setExpandedReleaseId(expandedReleaseId === release.id ? null : release.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isNewer 
                        ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' 
                        : 'bg-white/[0.05] border border-white/[0.08]'
                    }`}>
                      <GitBranch className={`h-4 w-4 ${isNewer ? 'text-cyan-400' : 'text-white/40'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{release.tag_name.replace(/^v/, '')}</h4>
                        {isNewer && (
                          <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] font-bold uppercase tracking-wider rounded-full">
                            Update
                          </span>
                        )}
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider rounded-full">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">{formatDate(release.published_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {release.assets.length > 0 && (
                      <span className="px-3 py-1 bg-white/[0.05] text-white/60 text-[10px] font-bold rounded-full border border-white/[0.08]">
                        {release.assets.length} assets
                      </span>
                    )}
                    
                    <motion.div
                      animate={{ rotate: expandedReleaseId === release.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-6 h-6 rounded-full bg-white/[0.05] flex items-center justify-center group-hover:bg-white/[0.1] transition-colors"
                    >
                      <ChevronDown className="h-3 w-3 text-white/40" />
                    </motion.div>
                  </div>
                </div>
                
                <AnimatePresence>
                  {expandedReleaseId === release.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-5 pt-0 border-t border-white/[0.06]">
                        {/* Release Notes */}
                        {release.body && (
                          <div className="mb-5 mt-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">
                              Release Notes
                            </h4>
                            <div className="p-4 rounded-xl bg-black/30 border border-white/[0.06] max-h-60 overflow-y-auto">
                              <div 
                                className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed"
                                dangerouslySetInnerHTML={{ 
                                  __html: DOMPurify.sanitize(release.body
                                      .replace(/### /g, '<h3 class="text-xs font-bold text-cyan-400 mt-4 mb-2 uppercase tracking-wider">')
                                      .replace(/## /g, '<h2 class="text-sm font-bold text-white mt-5 mb-2">')
                                      .replace(/# /g, '<h1 class="text-base font-black text-white mt-5 mb-3">')
                                      .replace(/\n- /g, '<div class="flex gap-2 mt-1"><span class="text-cyan-500">•</span><span>')
                                      .replace(/\n\* /g, '<div class="flex gap-2 mt-1"><span class="text-cyan-500">•</span><span>')
                                      .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-cyan-300">$1</code>')
                                      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
                                      .replace(/\*([^*]+)\*/g, '<em class="text-white/80">$1</em>')
                                  )}}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Download Assets */}
                        {release.assets && release.assets.length > 0 && (
                          <div className="mb-5">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">
                              Downloads
                            </h4>
                            <div className="space-y-2">
                              {release.assets.map((asset) => (
                                <div 
                                  key={asset.id} 
                                  className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/[0.06] hover:border-white/[0.12] transition-colors group"
                                >
                                  <div className="flex items-center gap-3">
                                    <Download className="h-4 w-4 text-white/40 group-hover:text-cyan-400 transition-colors" />
                                    <div>
                                      <p className="text-sm font-medium text-white">{asset.name}</p>
                                      <p className="text-xs text-white/40">{formatFileSize(asset.size)}</p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadRelease(release);
                                    }}
                                    className="px-4 py-1.5 bg-white/[0.06] hover:bg-cyan-500/20 text-white hover:text-cyan-400 rounded-lg text-xs font-bold transition-all border border-white/[0.06] hover:border-cyan-500/30"
                                  >
                                    Download
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Action */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadRelease(release);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                          >
                            <Download className="h-4 w-4" />
                            <span>Download {release.name || release.tag_name}</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          
          {releases.length === 0 && !loading && !error && (
            <div className="text-center py-16">
              <Info className="h-8 w-8 mx-auto mb-4 text-white/20" />
              <p className="text-sm text-white/40">No releases found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdatesSettings;