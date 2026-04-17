"use client"

import { useState, useEffect, useRef } from 'react';

type ScanResponse =
    | {
          success: true;
          aiPercent: number;
          humanPercent: number;
          isAi: boolean;
      }
    | {
          error: string;
      };

// --- Reusable SVG Components ---
const LoadingFace = () => (
    <svg className="h-5 w-auto animate-float-fast text-current" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <ellipse cx="40" cy="30" rx="8" ry="8">
            <animate attributeName="ry" values="8;8;0.5;8;8" keyTimes="0;0.8;0.85;0.9;1" dur="1.5s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="80" cy="30" rx="8" ry="8">
            <animate attributeName="ry" values="8;8;0.5;8;8" keyTimes="0;0.8;0.85;0.9;1" dur="1.5s" repeatCount="indefinite" />
        </ellipse>
        <path d="M25 50 Q60 75 95 50 Q60 60 25 50Z" fill="#E85A5A" />
    </svg>
);

type ToastMessage = { id: number; message: string; type: 'default' | 'success' | 'error' };

export default function HumanizerPage() {
    const LOCAL_STORAGE_KEY = 'aihumanize_saved_token';
    
    const [isDark, setIsDark] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return localStorage.getItem('theme') === 'dark';
    });
    const [token, setToken] = useState(() => {
        if (typeof window === 'undefined') {
            return '';
        }

        return localStorage.getItem(LOCAL_STORAGE_KEY) ?? '';
    });
    const [promptText, setPromptText] = useState('');
    const [outputText, setOutputText] = useState('');
    
    // Loading States
    const [isFetchingToken, setIsFetchingToken] = useState(false);
    const [isHumanizing, setIsHumanizing] = useState(false);
    const [isScanningInput, setIsScanningInput] = useState(false);
    const [isScanningOutput, setIsScanningOutput] = useState(false);
    
    // Scan Results
    const [inputScanBadge, setInputScanBadge] = useState<{ text: string; isAi: boolean } | null>(null);
    const [outputScanBadge, setOutputScanBadge] = useState<{ text: string; isAi: boolean } | null>(null);
    
    // Toasts
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const outputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
    }, [isDark]);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
        if (newTheme) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    // --- Toast Logic ---
    const showToast = (message: string, type: 'default' | 'success' | 'error' = 'default') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    // --- Actions ---
    const fetchToken = async () => {
        setIsFetchingToken(true);
        try {
            const response = await fetch('https://aihumanize.io/dev/webuser/getLoginData', {
                method: 'GET',
                headers: { 'Accept': '*/*', 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            const result = await response.json();

            if (result.code === 0 && result.data?.token) {
                setToken(result.data.token);
                localStorage.setItem(LOCAL_STORAGE_KEY, result.data.token);
                showToast('New token generated and saved.', 'success');
            } else {
                throw new Error('Invalid token response format.');
            }
        } catch (error: unknown) {
            showToast(`Failed to fetch token: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        } finally {
            setIsFetchingToken(false);
        }
    };

    const handleScan = async (text: string, isInput: boolean) => {
        if (!text.trim()) {
            showToast("No text to scan!", "error");
            return;
        }

        const setLoader = isInput ? setIsScanningInput : setIsScanningOutput;
        const setBadge = isInput ? setInputScanBadge : setOutputScanBadge;

        setLoader(true);
        setBadge(null); // Clear previous

        try {
            const response = await fetch('/api/gptzero', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            });

            const result = (await response.json()) as ScanResponse;

            if (!response.ok || 'error' in result) {
                throw new Error('error' in result ? result.error : `Server returned ${response.status}`);
            }

            if ('success' in result && result.success) {
                setBadge({
                    text: result.isAi ? `🤖 ${result.aiPercent}% AI` : `🧑 ${result.humanPercent}% Human`,
                    isAi: result.isAi
                });
            }
        } catch (error: unknown) {
            showToast(`Scan Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        } finally {
            setLoader(false);
        }
    };

    const handleHumanize = async () => {
        if (!token) return showToast("Please provide an authentication token.", "error");
        if (!promptText) return showToast("Please enter some text to humanize.", "error");

        localStorage.setItem(LOCAL_STORAGE_KEY, token);
        setOutputText('');
        setOutputScanBadge(null);
        setIsHumanizing(true);

        const payload = { prompt: promptText, token, auto: 0, cjtype: 0, model: 1 };

        try {
            const response = await fetch('https://aihumanize.io/dev/outstream', {
                method: 'POST',
                headers: { 'Accept': '*/*', 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            if (!response.body) throw new Error('Stream not supported by browser.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let done = false;
            let buffer = '';
            let currentText = '';

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;

                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; 

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const dataObj = JSON.parse(trimmedLine.substring(6));
                                if (dataObj.type === 'success' && dataObj.msg) {
                                    currentText += dataObj.msg;
                                    setOutputText(currentText);
                                    if (outputRef.current) {
                                        outputRef.current.scrollTop = outputRef.current.scrollHeight;
                                    }
                                } else if (dataObj.type === 'DONE') {
                                    done = true;
                                    showToast("Process completed successfully.", "success");
                                }
                            } catch {
                                // Ignore partial JSON chunks
                            }
                        }
                    }
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            showToast(`Request Failed: ${message}`, 'error');
            setOutputText(prev => prev + `\n\n[Process Interrupted: ${message}]`);
        } finally {
            setIsHumanizing(false);
        }
    };

    const copyText = () => {
        if (outputText) {
            navigator.clipboard.writeText(outputText)
                .then(() => showToast('Text copied to clipboard!', 'success'))
                .catch(() => showToast('Failed to copy text.', 'error'));
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-300">
            {/* Navbar */}
            <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-between items-center transition-colors duration-300 shadow-sm relative z-10">
                <div className="flex items-center gap-2">
                    <svg className="h-9 w-auto text-slate-800 dark:text-slate-100 drop-shadow-sm" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <g className="animate-float">
                            <ellipse cx="40" cy="30" rx="7" ry="7">
                                <animate attributeName="ry" values="7;7;0.5;7;7" keyTimes="0;0.9;0.93;0.96;1" dur="3.5s" repeatCount="indefinite" />
                            </ellipse>
                            <ellipse cx="80" cy="30" rx="7" ry="7">
                                <animate attributeName="ry" values="7;7;0.5;7;7" keyTimes="0;0.9;0.93;0.96;1" dur="3.5s" repeatCount="indefinite" />
                            </ellipse>
                            <path d="M25 50 Q60 75 95 50 Q60 60 25 50Z" fill="#E85A5A" />
                        </g>
                    </svg>
                    <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">Humanizer</span>
                </div>
                
                <div className="flex items-center gap-4">
                    <a href="https://veerrajpoot.com" target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                        Made by Veer
                    </a>
                    <button onClick={toggleTheme} className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        {isDark ? '☀️ My Eyes! (Light)' : '🦇 Vampire Mode (Dark)'}
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-grow w-full max-w-4xl mx-auto p-6 flex flex-col gap-6 relative z-0">
                {/* Input Section */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col overflow-hidden transition-colors duration-300 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Configure & Input
                    </div>
                    
                    <div className="p-6 flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="tokenInput" className="text-sm font-medium">Those magical words? ❤️ (Token)</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input 
                                    type="text" id="tokenInput" 
                                    value={token} onChange={(e) => setToken(e.target.value)}
                                    placeholder="eyJhbGciOiJIUzUxMiJ9..." 
                                    className="flex-grow px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:focus:ring-indigo-400/20 dark:focus:border-indigo-400"
                                />
                                <button onClick={fetchToken} disabled={isFetchingToken} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap disabled:opacity-60">
                                    {isFetchingToken ? <LoadingFace /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"/></svg>}
                                    {isFetchingToken ? 'Fetching...' : 'Refresh Token'}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <label htmlFor="promptInput" className="text-sm font-medium">Original Text</label>
                                {inputScanBadge && (
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${inputScanBadge.isAi ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'}`}>
                                        {inputScanBadge.text}
                                    </span>
                                )}
                            </div>
                            <textarea 
                                id="promptInput" 
                                value={promptText} onChange={(e) => setPromptText(e.target.value)}
                                placeholder="Paste your AI-generated text here to humanize it..." 
                                className="w-full min-h-[200px] px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y dark:focus:ring-indigo-400/20 dark:focus:border-indigo-400"
                            />
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button onClick={() => handleScan(promptText, true)} disabled={isScanningInput || !promptText} className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 rounded-lg font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed">
                                {isScanningInput ? <LoadingFace /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>}
                                {isScanningInput ? 'Scanning...' : 'Scan AI'}
                            </button>
                            <button onClick={handleHumanize} disabled={isHumanizing || !promptText} className="flex-grow flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                                {isHumanizing ? <LoadingFace /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                                {isHumanizing ? 'Processing...' : 'Humanize Text'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Output Section */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col overflow-hidden transition-colors duration-300 shadow-sm min-h-[300px]">
                    <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Result</span>
                        <div className="flex items-center gap-4">
                            {outputScanBadge && (
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${outputScanBadge.isAi ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'}`}>
                                    {outputScanBadge.text}
                                </span>
                            )}
                            <button onClick={() => handleScan(outputText, false)} disabled={isScanningOutput || !outputText || isHumanizing} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 rounded-md text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                {isScanningOutput ? <LoadingFace /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>}
                                Scan AI
                            </button>
                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600"></div>
                            <button onClick={copyText} disabled={!outputText || isHumanizing} className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                Copy Text
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-6 flex-grow flex flex-col relative">
                        <div ref={outputRef} className="text-sm leading-relaxed whitespace-pre-wrap flex-grow overflow-y-auto">
                            {!outputText && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3">
                                    <svg className="h-16 w-auto opacity-30 text-current" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                        <ellipse cx="40" cy="30" rx="7" ry="1" />
                                        <ellipse cx="80" cy="30" rx="7" ry="1" />
                                        <path d="M25 50 Q60 65 95 50 Q60 55 25 50Z" fill="currentColor" />
                                    </svg>
                                    <p>Your humanized text will appear here.</p>
                                </div>
                            )}
                            {outputText}
                        </div>
                    </div>
                </div>
            </main>

            {/* Toasts Container */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50 pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className={`animate-slide-in flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border-l-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium pointer-events-auto border-t border-r border-b border-t-slate-100 border-r-slate-100 border-b-slate-100 dark:border-t-slate-700 dark:border-r-slate-700 dark:border-b-slate-700 ${toast.type === 'error' ? 'border-l-red-500' : toast.type === 'success' ? 'border-l-green-500' : 'border-l-indigo-500'}`}>
                        {toast.type === 'error' && <svg width="18" height="18" className="text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>}
                        {toast.type === 'success' && <svg width="18" height="18" className="text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
                        {toast.type === 'default' && <svg width="18" height="18" className="text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
            <footer className="text-center text-xs text-slate-500 dark:text-slate-400 py-4 mt-6">
                &copy; {new Date().getFullYear()} Humanizer.
            </footer>
        </div>
    );
}