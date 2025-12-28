import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Zap, Clock, CheckCircle } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'completed' | 'error';
}

const AIAssistant: React.FC = () => {
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
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: getAIResponse(inputValue),
        timestamp: new Date(),
        status: 'completed'
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const getAIResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('deploy')) {
      return "I'll help you deploy your application. I can see you have a React app ready. Would you like me to:\n\n- Deploy to AWS with auto-scaling\n- Set up CI/CD pipeline with GitHub Actions\n- Configure load balancing and SSL\n\nWhich cloud provider would you prefer?";
    } else if (lowerInput.includes('scale')) {
      return "I can help optimize your scaling strategy. Based on your current traffic patterns, I recommend:\n\n- Enable auto-scaling for your EC2 instances\n- Set up CloudWatch alarms for CPU > 70%\n- Configure scale-down during low traffic hours\n\nThis could save you approximately 30% on compute costs.";
    } else if (lowerInput.includes('cost')) {
      return "I've analyzed your infrastructure costs. Here are my recommendations:\n\n- Switch to Reserved Instances (save $234/month)\n- Right-size your databases (save $89/month)\n- Enable S3 lifecycle policies (save $45/month)\n\nTotal potential savings: $368/month. Should I implement these optimizations?";
    } else {
      return "I understand you're looking for help with your DevOps workflow. I can assist with:\n\n- Application deployment and scaling\n- Infrastructure provisioning\n- Cost optimization\n- CI/CD pipeline setup\n- Monitoring and alerting\n\nCould you tell me more about what you'd like to achieve?";
    }
  };

  const quickActions = [
    "Deploy my React app to AWS",
    "Scale my application for high traffic",
    "Optimize my cloud costs",
    "Set up monitoring for my services"
  ];

  return (
    <div className="h-[600px] flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div className={`p-2 rounded-lg ${
              message.type === 'user' 
                ? 'bg-amber-500' 
                : 'bg-gradient-to-r from-teal-500 to-amber-500'
            }`}>
              {message.type === 'user' ? (
                <User className="h-4 w-4 text-white" />
              ) : (
                <Bot className="h-4 w-4 text-white" />
              )}
            </div>
            
            <div className={`max-w-2xl ${message.type === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block p-4 rounded-2xl ${
                message.type === 'user'
                  ? 'bg-amber-500/20 text-white'
                  : 'bg-white/10 text-white'
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
            <div className="p-2 rounded-lg bg-gradient-to-r from-teal-500 to-amber-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white/10 p-4 rounded-2xl">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
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
              onClick={() => setInputValue(action)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left text-sm text-slate-300 hover:text-white transition-all border border-white/10 hover:border-amber-400/50"
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

