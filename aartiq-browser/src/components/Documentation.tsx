"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { motion } from 'framer-motion';
import { FileText, Cpu, Zap, Shield, Bookmark, ChevronRight, Github, ExternalLink } from 'lucide-react';
import { APP_VERSION } from '@/lib/appVersion';

const README_CONTENT = `
# ☄️ Aartiq (v${APP_VERSION})
Made in India 🇮🇳
### The Intelligent Workspace for the Future

**Built by a solo high school developer (Latestinssan)**, running on extreme constraints (i3 4th Gen, 4GB RAM), yet designed to outperform modern browsers in productivity and intelligence.

**Aartiq** is not just a fork; it's a **custom-hardened Chromium environment** designed for:
1.  **Native AI Orchestration**: Seamlessly switch between **Google Gemini 3.1 (Pro & Flash)**, GPT-4o, Claude 3.7, Groq, and **Local Ollama (Deepseek R1)**.
2.  **RAG-Powered Memory**: Your browser remembers your context. It builds a local vector database of your sessions to provide "Perplexity-style" answers offline.
3.  **Hardware Isolation**: Every tab is sandboxed for maximum security and crash resistance.
4.  **Decentralized Sync**: Sync your data (tabs, clipboard, history) across devices using P2P direct connections or Firebase with end-to-end encryption.
5.  **Gemini 3.1 Integration**: Leveraging the latest multimodal capabilities for autonomous browsing and PDF generation.

---

## 🤖 AI Prompt Guide (Top Queries)
Unlock the full potential of Aartiq with these curated search & query examples:
1.  **Latest Tech Info**: "Show me the latest news about Gemini 2.0"
2.  **Language Translation**: "Summarize this page in Hindi"
3.  **Financial Insights**: "What are the best stocks to buy today in India?"
4.  **Developer Assistance**: "Give me a coding recipe for a React weather app"
5.  **Visual OCR**: "Analyze the visual content of this page"
6.  **Deep Search**: "Find all mentions of 'intelligence' on this page"
7.  **Smart Navigation**: "Navigate to google.com and search for AI browsers"
8.  **UI Control**: "Switch to Dark mode"
9.  **History Retrieval**: "What is my browsing history for today?"
10. **Data Extraction**: "Read this page and tell me the main price"
11. **Linguistic Support**: "Translate my last message to Tamil"
12. **Workspace Management**: "List all my open tabs and summarize them"

### 🧠 Intelligence & RAG
*   **Perplexity-Style Answers**: Ask complex questions to your sidebar. Comet scans your current page and retrieves relevant context from your history.
*   **Local Vector DB**: Automatically indexes your browsing for offline semantic search.
*   **Deepseek R1 Integration**: Optimized for the 1.5B model running locally via Ollama.
*   **OCR & Vision**: Automatic screenshot analysis and text extraction via multi-tier OCR chain (uniOCR → RustO! → Platform Native → Tesseract.js).

### ⚡ Performance & Core
*   **Chromium Rendering Engine**: We use the raw power of Chromium for 100% web compatibility, stripped of bloatware.
*   **Optimized for Low-End PCs**: Validated on 4GB RAM machines. Aggressive tab suspension technology.
*   **Google Navigation Fixed**: Resolved infinite loop issues with search engine redirects.

### 🛡️ Security & Sync
*   **Capability-Scoped Execution**: Actions gated by allowlist, not regex denylist (CapabilityController)
*   **AES-256-GCM Encryption**: + PBKDF2 (600K iterations), no silent base64 fallback
*   **DOMPurify HTML Sanitization**: Replaced legacy regex sanitization — eliminates known bypass techniques
*   **P2P File Drop**: Send files between Mobile and Desktop instantly.
*   **Admin Console**: (Enterprise) Manage user access and monitor sync status.

---

## 🚀 AI Integration & Usage in Aartiq

Aartiq deeply integrates AI into your browsing experience, acting as an intelligent co-pilot that understands your context and assists with various tasks. Our AI is designed to work seamlessly with native browser settings and web navigation, providing insights and capabilities directly where you need them.

### How Our AI Works

The **AI Analyst Sidebar** is your primary interface for interacting with Aartiq's intelligence. It leverages a powerful **LLM Orchestrator** capable of switching between multiple leading AI models (Google Gemini 3, GPT-4o, Claude 3.5, Groq, and local Ollama). This orchestrator works in conjunction with:

1.  **RAG-Powered Memory:** Your browsing history and active page content are continuously indexed into a local vector database. This local vector database serves as the foundation for our Retrieval-Augmented Generation (RAG) system. When you interact with the AI, it first retrieves relevant contextual information from your personal browsing data (both current page and historical sessions) stored in this database. This retrieved context is then provided to the chosen Large Language Model (local or cloud-based) alongside your query, enabling the AI to generate "Perplexity-style" answers that are highly tailored, relevant, and grounded in your own information landscape, even when offline.
2.  **Web Navigation Context:** The AI is acutely aware of your current tab's URL, title, and content. This allows it to perform context-aware actions like summarizing lengthy articles, extracting specific data points, generating related search queries, or even directly navigating to suggested links based on your conversation. You can prompt the AI with "Summarize this page," "Find alternatives to this product," or "Navigate to the official documentation for this library."
3.  **Native Browser Settings:** The AI can be configured and controlled directly through your browser's settings. This includes selecting your preferred LLM provider (e.g., Gemini, GPT-4o, Claude), managing API keys securely, and customizing AI behavior such as response verbosity or default actions. For instance, you can instruct the AI to "Change my theme to dark mode" or "Open settings to configure my LLM provider."

---

## 🛠️ The Story Behind Aartiq
Building a browser is considered "impossible" for a solo dev. Doing it on a laggy i3 laptop while studying for high school exams? **Insanity.**

**Comet was born out of frustration.** Modern browsers are RAM hogs that spy on you. I wanted a workspace that:
1.  Loads instantly.
2.  Understands what I'm reading.
3.  Works offline.

Despite constant crashes, build failures (Electron is heavy!), and school pressure, **v${APP_VERSION}** is here. It stands as a testament to what \"Agentic Coding\" and sheer willpower can achieve.

---

## 📦 Installation
\`\`\`bash
# Clone the repository
git clone https://github.com/Preet3627/Aartiq.git

# Install dependencies
npm install

# Run (Dev Mode)
npm run dev

# Build for Windows
npm run build-electron
\`\`\`

---

## 📄 Licensing

Aartiq is built with open-source technologies. For a comprehensive list of all third-party libraries used and their respective licenses, please refer to the [Licence.md](Licence.md) file.

---
*Dedicated to the builders who code on potato PCs.* ❤️
`;

const Documentation = () => {
    return (
        <div className="min-h-screen bg-[#020205] text-primary-text font-sans selection:bg-sky-500/30">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 bg-deep-space pointer-events-none opacity-40" />
            <div className="fixed inset-0 bg-nebula pointer-events-none opacity-60" />

            <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 lg:py-32">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-vibrant rounded-[2.5rem] p-8 lg:p-16 border border-white/10 shadow-2xl relative overflow-hidden"
                >
                    {/* Decorative Header */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-50" />

                    <div className="flex flex-col gap-8">
                        <header className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-sky-400/10 text-sky-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-sky-400/20">
                                    Official Documentation
                                </span>
                                <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest">
                                    Release {APP_VERSION}
                                </span>
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tighter leading-none italic">
                                AARTIQ<span className="text-sky-400 not-italic">.</span>CORE
                            </h1>
                            <p className="text-xl text-secondary-text max-w-2xl font-medium leading-relaxed">
                                The high-performance, RAG-integrated browsing workspace for developers and power users.
                            </p>
                        </header>

                        <hr className="border-white/5" />

                        <article className="prose prose-invert max-w-none 
                            prose-h2:text-3xl prose-h2:font-black prose-h2:tracking-tight prose-h2:text-white prose-h2:mt-12 prose-h2:mb-6
                            prose-h3:text-xl prose-h3:font-bold prose-h3:text-sky-400 prose-h3:mt-8 prose-h3:mb-4
                            prose-p:text-secondary-text prose-p:leading-relaxed prose-p:text-lg
                            prose-li:text-secondary-text prose-li:text-lg prose-li:mb-2
                            prose-strong:text-white prose-strong:font-black
                            prose-code:text-sky-300 prose-code:bg-sky-400/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                            prose-a:text-sky-400 prose-a:no-underline hover:prose-a:underline
                        ">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    code({ node, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return match ? (
                                            <div className="my-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                                <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{match[1]}</span>
                                                    <div className="flex gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-red-500/40" />
                                                        <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
                                                        <div className="w-2 h-2 rounded-full bg-green-500/40" />
                                                    </div>
                                                </div>
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus as any}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    customStyle={{
                                                        margin: 0,
                                                        padding: '1.5rem',
                                                        background: 'rgba(0,0,0,0.4)',
                                                        fontSize: '0.875rem',
                                                    }}
                                                >
                                                    {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                            </div>
                                        ) : (
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    hr: () => <hr className="my-12 border-white/5" />,
                                    ul: ({ children }) => <ul className="list-none pl-0 space-y-4 my-8">{children}</ul>,
                                    li: ({ children }) => (
                                        <li className="flex gap-3 group">
                                            <ChevronRight size={18} className="text-sky-400 mt-1 shrink-0 group-hover:translate-x-1 transition-transform" />
                                            <span>{children}</span>
                                        </li>
                                    ),
                                }}
                            >
                                {README_CONTENT}
                            </ReactMarkdown>
                        </article>

                        <hr className="border-white/5" />

                        <footer className="flex flex-col lg:flex-row items-center justify-between gap-8 pt-8">
                            <div className="flex items-center gap-6">
                                <a
                                    href="https://github.com/Preet3627/Aartiq"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
                                >
                                    <Github size={20} />
                                    <span className="font-bold text-sm">Source Code</span>
                                </a>
                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                <a
                                    href="https://browser.ponsrischool.in"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
                                >
                                    <ExternalLink size={20} />
                                    <span className="font-bold text-sm">Official Website</span>
                                </a>
                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                <span className="made-in-india-gradient-text font-black tracking-tighter text-sm uppercase">Made in India</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Solo Dev Project</span>
                                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                    <Zap size={16} className="text-yellow-400" />
                                </div>
                            </div>
                        </footer>
                    </div>
                </motion.div>

                {/* Quick Navigation Cards (Optional) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                    {[
                        { icon: <Cpu size={24} />, title: 'RAG Core', desc: 'Neural memory indexing engine.' },
                        { icon: <Shield size={24} />, title: 'Isolation', desc: 'Hardware-level tab sandboxing.' },
                        { icon: <Zap size={24} />, title: 'Speed', desc: 'Optimized for potato computers.' }
                    ].map((card, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -5 }}
                            className="p-6 glass rounded-3xl border border-white/5 hover:border-sky-400/20 transition-all hover:shadow-[0_10px_30px_rgba(56,189,248,0.1)] group"
                        >
                            <div className="text-sky-400 mb-4 group-hover:scale-110 transition-transform">{card.icon}</div>
                            <h4 className="font-black text-white uppercase tracking-widest text-xs mb-2">{card.title}</h4>
                            <p className="text-secondary-text text-sm">{card.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Documentation;
