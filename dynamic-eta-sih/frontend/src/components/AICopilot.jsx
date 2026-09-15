// frontend/src/components/AICopilot.jsx
// =======================================
// Phase 6 — Floating AI Operations Copilot chat widget.
//
// Provides a modern, professional chat interface for station controllers
// to ask natural-language questions about live train data. Queries are
// sent to POST /api/v1/chat (FastAPI + LangChain SQL agent) and the
// AI's response is rendered in a scrollable chat history.
//
// The widget floats in the bottom-right corner of every dashboard page
// and can be toggled open/closed with a single click.

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  MessageSquare, X, Send, Bot, User, Loader2,
  Sparkles, ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PYTHON_URL = import.meta.env.VITE_PYTHON_URL || "http://localhost:8000";

// ── Suggested starter queries (shown when chat is empty) ─────────────────
const STARTER_QUERIES = [
  "Which trains are currently delayed?",
  "Show me all active events",
  "What is the fastest train right now?",
  "How many trains are running on time?",
  "List all Rajdhani type trains",
];

// ── Chat bubble sub-components ──────────────────────────────────────────

function BotMessage({ text, timestamp }) {
  return (
    <div className="flex gap-2.5 items-start max-w-[92%]">
      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-blue-600/20">
        <Bot size={14} className="text-white" />
      </div>
      <div className="overflow-x-auto max-w-full">
        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-slate-700 leading-relaxed shadow-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="border-collapse border border-slate-200 w-full text-left" {...props} /></div>,
              th: ({node, ...props}) => <th className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800" {...props} />,
              td: ({node, ...props}) => <td className="border border-slate-200 px-3 py-2" {...props} />,
              h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-4 mb-2 text-slate-900" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-base font-bold mt-4 mb-2 text-slate-900" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-sm font-bold mt-3 mb-2 text-slate-900" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
              a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
              strong: ({node, ...props}) => <strong className="font-semibold text-slate-900" {...props} />,
              code: ({node, inline, ...props}) => inline ? <code className="bg-slate-100 text-rose-600 px-1 py-0.5 rounded text-xs" {...props} /> : <pre className="bg-slate-800 text-slate-50 p-3 rounded my-3 overflow-x-auto text-xs"><code {...props} /></pre>
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
        {timestamp && (
          <p className="text-[10px] text-slate-400 mt-1 ml-1">{timestamp}</p>
        )}
      </div>
    </div>
  );
}

function UserMessage({ text, timestamp }) {
  return (
    <div className="flex gap-2.5 items-start max-w-[92%] ml-auto flex-row-reverse">
      <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
        <User size={14} className="text-slate-300" />
      </div>
      <div className="flex flex-col items-end">
        <div className="bg-blue-600 rounded-2xl rounded-tr-md px-4 py-3 text-sm text-white leading-relaxed shadow-sm">
          {text}
        </div>
        {timestamp && (
          <p className="text-[10px] text-slate-400 mt-1 mr-1">{timestamp}</p>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-start max-w-[92%]">
      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-blue-600/20">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Loader2 size={14} className="text-blue-500 animate-spin" />
          <span className="text-xs text-slate-400">Querying database…</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Widget ─────────────────────────────────────────────────────────

export default function AICopilot() {
  const [isOpen,   setIsOpen]   = useState(false);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when widget opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function now() {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  }

  async function sendMessage(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    const userMsg = { role: "user", text: userText, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data } = await axios.post(`${PYTHON_URL}/api/v1/chat`, {
        query: userText,
      });

      const botMsg = {
        role: "bot",
        text: data.response || "I couldn't generate a response.",
        time: now(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const botMsg = {
        role: "bot",
        text: `Sorry, I couldn't reach the AI service. ${err.message}`,
        time: now(),
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Floating Action Button (closed state) ─────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 group"
        title="AI Operations Copilot"
      >
        <Sparkles size={22} className="group-hover:rotate-12 transition-transform" />
        {/* Notification dot */}
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-950 shadow-sm" />
      </button>
    );
  }

  // ── Expanded Chat Widget ──────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] rounded-2xl overflow-hidden shadow-2xl shadow-black/20 border border-slate-200 flex flex-col bg-slate-50 animate-in">
      {/* Header */}
      <div className="bg-blue-700 px-5 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">
              TrackSense AI Copilot
            </p>
            <p className="text-blue-200 text-[10px] flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
              Powered by LangChain + Groq
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Chat History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome message if empty */}
        {messages.length === 0 && !loading && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={24} className="text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              Welcome, Controller!
            </p>
            <p className="text-xs text-slate-400 mb-5 max-w-[280px] mx-auto leading-relaxed">
              Ask me anything about your live train operations —
              delays, speeds, events, routes, and more.
            </p>

            {/* Starter query chips */}
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTER_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-150 shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <UserMessage  key={i} text={msg.text} timestamp={msg.time} />
          ) : (
            <BotMessage   key={i} text={msg.text} timestamp={msg.time} />
          )
        )}

        {/* Typing indicator */}
        {loading && <TypingIndicator />}
      </div>

      {/* Input Bar */}
      <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about trains, delays, events…"
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[9px] text-slate-400 text-center mt-2">
          AI may produce inaccurate results • Read-only database access
        </p>
      </div>

      {/* CSS animation */}
      <style>{`
        .animate-in {
          animation: copilotSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes copilotSlideIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
}
