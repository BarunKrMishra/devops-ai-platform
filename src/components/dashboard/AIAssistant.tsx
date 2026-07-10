import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, User, Zap, Clock, CheckCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'completed' | 'error';
}

// Self-contained styles for the assistant. All classes are prefixed `aiasst-`
// and the 3D animation is CSS-only (GPU transforms, no libraries), so this
// component can never affect other views, the bundle size, or the backend.
const assistantStyles = `
.aiasst-shell { position: relative; }
.aiasst-header {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px; margin-bottom: 16px; border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(251,191,36,0.14), transparent 55%),
    radial-gradient(120% 140% at 100% 0%, rgba(20,184,166,0.14), transparent 55%),
    rgba(255,255,255,0.04);
  backdrop-filter: blur(6px);
}
.aiasst-core { position: relative; width: 48px; height: 48px; flex: 0 0 auto; perspective: 260px; }
.aiasst-orb {
  position: absolute; inset: 13px; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 38%, #14b8a6 78%, #0f766e 100%);
  box-shadow: 0 0 16px rgba(20,184,166,0.55), inset 0 0 8px rgba(255,255,255,0.35);
  animation: aiasst-pulse 3.2s ease-in-out infinite;
}
.aiasst-ring { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid; will-change: transform; }
.aiasst-ring.r1 { border-color: rgba(251,191,36,0.60); animation: aiasst-o1 4.2s linear infinite; }
.aiasst-ring.r2 { border-color: rgba(45,212,191,0.60); animation: aiasst-o2 5.6s linear infinite; }
.aiasst-ring.r3 { border-color: rgba(255,255,255,0.22); animation: aiasst-o3 7.4s linear infinite; }
.aiasst-core.thinking .aiasst-orb { animation-duration: 1.1s; }
.aiasst-core.thinking .aiasst-ring.r1 { animation-duration: 1.4s; }
.aiasst-core.thinking .aiasst-ring.r2 { animation-duration: 1.8s; }
.aiasst-core.thinking .aiasst-ring.r3 { animation-duration: 2.3s; }

@keyframes aiasst-o1 { from { transform: rotateX(70deg) rotateZ(0deg); } to { transform: rotateX(70deg) rotateZ(360deg); } }
@keyframes aiasst-o2 { from { transform: rotateY(72deg) rotateZ(0deg); } to { transform: rotateY(72deg) rotateZ(360deg); } }
@keyframes aiasst-o3 { from { transform: rotateX(58deg) rotateY(32deg) rotateZ(0deg); } to { transform: rotateX(58deg) rotateY(32deg) rotateZ(360deg); } }
@keyframes aiasst-pulse { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.08); filter: brightness(1.18); } }

.aiasst-avatar { position: relative; perspective: 200px; }
.aiasst-avatar .aiasst-face { transition: transform 0.35s ease; transform-style: preserve-3d; }
.aiasst-avatar:hover .aiasst-face { transform: rotateY(18deg) rotateX(-8deg); }

.aiasst-status { display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; }
.aiasst-status .aiasst-led { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399; animation: aiasst-blink 2s ease-in-out infinite; }
.aiasst-status.thinking .aiasst-led { background: #fbbf24; box-shadow: 0 0 8px #fbbf24; }
@keyframes aiasst-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

.aiasst-bubble { transition: transform 0.25s ease, box-shadow 0.25s ease; }
.aiasst-bubble:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,0.25); }

@media (prefers-reduced-motion: reduce) {
  .aiasst-orb, .aiasst-ring, .aiasst-status .aiasst-led { animation: none !important; }
  .aiasst-avatar:hover .aiasst-face { transform: none; }
}
`;

const AIAssistant: React.FC = () => {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: "Hello! I'm your Aikya assistant. I can help you deploy applications, manage infrastructure, scale resources, and optimize costs. What would you like to do today?",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const command = inputValue.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: command,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const { data } = await axios.post(
        `${API_URL}/api/ai/command`,
        { command },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data?.message || data?.response || 'I processed your request.',
        timestamp: new Date(),
        status: data?.success === false ? 'error' : 'completed'
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (err) {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content:
          "I couldn't reach the AI service right now. Please make sure an AI provider is configured, then try again.",
        timestamp: new Date(),
        status: 'error'
      };
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickActions = [
    "Deploy my React app to AWS",
    "Scale my application for high traffic",
    "Optimize my cloud costs",
    "Set up monitoring for my services"
  ];

  return (
    <div className="aiasst-shell h-[600px] flex flex-col">
      <style>{assistantStyles}</style>

      {/* Modern header with the animated 3D AI core */}
      <div className="aiasst-header">
        <div className={`aiasst-core${isTyping ? ' thinking' : ''}`} aria-hidden="true">
          <div className="aiasst-ring r1"></div>
          <div className="aiasst-ring r2"></div>
          <div className="aiasst-ring r3"></div>
          <div className="aiasst-orb"></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-lg leading-none">Aikya AI</h3>
            <Sparkles className="h-4 w-4 text-amber-300" />
          </div>
          <div className={`aiasst-status mt-1 ${isTyping ? 'thinking text-amber-300' : 'text-emerald-300'}`}>
            <span className="aiasst-led"></span>
            {isTyping ? 'Thinking…' : 'Online · ready to help'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div className={`aiasst-avatar p-2 rounded-xl ${
              message.type === 'user'
                ? 'bg-amber-500'
                : 'bg-gradient-to-br from-teal-500 to-amber-500 shadow-lg shadow-teal-500/20'
            }`}>
              <span className="aiasst-face inline-flex">
                {message.type === 'user' ? (
                  <User className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </span>
            </div>

            <div className={`max-w-2xl ${message.type === 'user' ? 'text-right' : ''}`}>
              <div className={`aiasst-bubble inline-block p-4 rounded-2xl border ${
                message.type === 'user'
                  ? 'bg-amber-500/20 border-amber-400/20 text-white'
                  : 'bg-white/10 border-white/10 text-white backdrop-blur-sm'
              }`}>
                <p className="whitespace-pre-line">{message.content}</p>
                {message.status && (
                  <div className="flex items-center space-x-1 mt-2 text-sm">
                    {message.status === 'pending' && <Clock className="h-3 w-3 text-yellow-400" />}
                    {message.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-400" />}
                    <span className="text-slate-400 capitalize">{message.status}</span>
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-amber-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white/10 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {quickActions.map((action, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setInputValue(action)}
              className="aiasst-bubble p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left text-sm text-slate-300 hover:text-white transition-all border border-white/10 hover:border-amber-400/50"
            >
              <Zap className="h-4 w-4 inline mr-2 text-amber-400" />
              {action}
            </button>
          ))}
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask me anything about your Aikya workflow..."
            className="flex-1 p-4 bg-white/10 rounded-xl text-white placeholder-slate-400 border border-white/20 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="button"
            aria-label="Send message"
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="p-4 bg-gradient-to-r from-amber-500 to-teal-500 rounded-xl hover:from-amber-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
