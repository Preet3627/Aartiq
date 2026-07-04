"use client";

import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { Cloud, X } from "lucide-react";

const CloudSyncConsent = () => {
  const { setCloudSyncConsent } = useAppStore();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-800 rounded-lg p-8 max-w-md w-full text-center"
      >
        <div className="flex justify-center mb-4">
          <Cloud size={48} className="text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Enable Cloud Sync?</h2>
        <p className="text-gray-400 mb-8 text-sm">
          Warning: Enabling sync will send your history, bookmarks, and encrypted passwords to <strong>Firebase Cloud Storage</strong>.
          This allows you to access your data on any device.
          Your sensitive data is encrypted locally before transmission.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setCloudSyncConsent(false)}
            className="px-6 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors"
          >
            No, thanks
          </button>
          <button
            onClick={() => setCloudSyncConsent(true)}
            className="px-6 py-2 rounded-md bg-indigo-500 hover:bg-indigo-600 transition-colors"
          >
            Enable Sync
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CloudSyncConsent;
