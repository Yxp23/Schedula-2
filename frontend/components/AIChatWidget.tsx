'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

export default function AIChatWidget({ activeSchedule }: { activeSchedule: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Completely Native Streaming Fetch (Bypassing AI SDK hooks)
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    
    const userMessage = { id: Date.now().toString(), role: 'user', content: customInput };
    setMessages((prev) => [...prev, userMessage]);
    setCustomInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], context: activeSchedule })
      });

      if (!response.ok) throw new Error('API Error');

      setMessages((prev) => [...prev, { id: 'ai-resp', role: 'assistant', content: '' }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      let aiResponseText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          
          // toTextStreamResponse outputs raw plaintext chunks!
          aiResponseText += chunk;
          
          setMessages((prev) => {
             const newArr = [...prev];
             newArr[newArr.length - 1].content = aiResponseText;
             return newArr;
          });
        }
      }
    } catch(err) {
      console.error(err);
      setMessages((prev) => [...prev, { id: 'err', role: 'assistant', content: 'Connection Error. Please check your API key.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-[90] w-14 h-14 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center border border-black/10 dark:border-white/10 hover:scale-110 active:scale-95 transition-all"
      >
        <span className="text-xl">✨</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[400px] z-[101] bg-white dark:bg-[#020202] border-l border-black/10 dark:border-white/[0.05] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-black/10 dark:border-white/[0.05] bg-zinc-50 dark:bg-white/[0.01] flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-sm font-medium text-black dark:text-white/90">Schedula Copilot</h3>
                  <p className="text-[10px] text-neutral-500 dark:text-white/40 uppercase tracking-widest mt-1">Context-Aware AI</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-neutral-400 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 && (
                  <div className="text-center mt-20 opacity-40">
                    <span className="text-4xl mb-4 block">✨</span>
                    <p className="text-xs">Ask me about your generated schedule,<br/>or request a Gen Ed swap!</p>
                  </div>
                )}
                
                {messages.map((m: any, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-black dark:bg-white text-white dark:text-black font-medium' 
                        : 'bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.05] text-neutral-800 dark:text-white/80'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.05] rounded-2xl px-4 py-3 w-16">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 rounded-full bg-black/40 dark:bg-white/40" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="p-6 border-t border-black/5 dark:border-white/[0.05] bg-zinc-50 dark:bg-white/[0.01] shrink-0">
                <form onSubmit={onSubmit} className="relative">
                  <input
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={activeSchedule ? "Ask about this 18-credit load..." : "Type your request..."}
                    className="w-full bg-white dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-xl px-4 py-4 pr-12 text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-white/30 focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors shadow-sm dark:shadow-none"
                  />
                  <button 
                    type="submit" 
                    disabled={isLoading || !customInput.trim()}
                    className="absolute right-2 top-2 bottom-2 aspect-square bg-black dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-black/80 dark:hover:bg-white/90 transition-colors"
                  >
                    ↑
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
