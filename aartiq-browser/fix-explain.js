const fs = require('fs');
const file = 'src/components/AIChatSidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /case 'EXPLAIN_CAPABILITIES':[\s\S]*?result = 'Capabilities explained comprehensively';[\s\S]*?break;/;

const newCode = `case 'EXPLAIN_CAPABILITIES':
            setMessages(prev => [...prev, { role: 'model', content: "🚀 **I am the Aartiq Agent.** Let me demonstrate my advanced capabilities for you!" }]);
            await delay(1500);
            
            setMessages(prev => [...prev, { role: 'model', content: "📄 **1. Document Generation:** I can create PDFs dynamically. Let me generate a capabilities overview PDF for you now..." }]);
            if (window.electronAPI) {
              try {
                const pdfContent = "<h1>Aartiq Capabilities</h1><p>Here is a summary of what I can do:</p><ul><li>Autonomous Browsing</li><li>Desktop Automation</li><li>File Generation</li><li>Omnipresent AI Assistant</li><li>Local Memory Integration</li></ul>";
                const pdfRes = await window.electronAPI.generatePDF("Aartiq_Capabilities_Demo", pdfContent);
                if (pdfRes.success) {
                   setMessages(prev => [...prev, { role: 'model', content: \`✅ [PDF_GENERATED]: Document "Aartiq_Capabilities_Demo.pdf" has been saved to your Downloads.\` }]);
                }
              } catch (e) {
                console.error('Failed to generate PDF in capabilities demo', e);
              }
            }
            await delay(2000);

            setMessages(prev => [...prev, { role: 'model', content: "⚙️ **2. OS Automation:** I can interact with your operating system. I will now open your system calculator..." }]);
            if (window.electronAPI) {
              try {
                 const platform = navigator.platform;
                 let calcApp = platform.includes('Win') ? 'calc.exe' : (platform.includes('Mac') ? 'Calculator.app' : 'gnome-calculator');
                 const appRes = await window.electronAPI.openExternalApp(calcApp);
                 if (appRes?.success) {
                   setMessages(prev => [...prev, { role: 'model', content: \`✅ [APP_OPENED]: The Calculator application has been launched.\` }]);
                 }
              } catch (e) {
                console.error('Failed to open app in capabilities demo', e);
              }
            }
            await delay(2000);

            setMessages(prev => [...prev, { role: 'model', content: "🧠 **3. Local Intelligence:** I remember what you do in the browser and can retrieve it later, functioning even offline." }]);
            await delay(2000);

            setMessages(prev => [...prev, { role: 'model', content: "🎯 **4. Action-Oriented:** I don't just chat, I *do*. I can change browser themes, adjust your volume, manage emails, or navigate pages autonomously. Just ask!" }]);
            
            result = 'Capabilities explained comprehensively';
            break;`;

if (content.match(regex)) {
    content = content.replace(regex, newCode);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Successfully replaced EXPLAIN_CAPABILITIES");
} else {
    console.log("REGEX NOT MATCHED");
}

// And also replace the user interception
const interceptRegex = /if \(!store\.hasSeenAiMistakeWarning && messages\.length === 0\) \{\s*store\.setShowAiMistakeWarning\(true\);\s*\}/;

const interceptCode = `if (!store.hasSeenAiMistakeWarning && messages.length === 0) {
      store.setShowAiMistakeWarning(true);
    }

    // Intercept EXPLAIN_CAPABILITIES typed by user directly
    if (contentToUseFinal.toUpperCase().includes('[EXPLAIN-CAPABILITIES]') || contentToUseFinal.toUpperCase().includes('[EXPLAIN_CAPABILITIES]')) {
      const fakeCommand = {
        id: \`cmd-\${Date.now()}-explain\`,
        type: 'EXPLAIN_CAPABILITIES',
        value: '',
        status: 'pending',
        timestamp: Date.now()
      };
      setCommandQueue([fakeCommand as any]);
      setCurrentCommandIndex(0);
      processingQueueRef.current = true;
      processCommandQueue([fakeCommand as any]);
      setIsLoading(false);
      return;
    }`;

if (content.match(interceptRegex)) {
    content = content.replace(interceptRegex, interceptCode);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Successfully added intercept code");
} else {
    console.log("INTERCEPT REGEX NOT MATCHED");
}
