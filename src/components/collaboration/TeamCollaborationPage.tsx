import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Bell, Settings, Send, UserPlus, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import io from 'socket.io-client';

interface Message {
  id: string;
  user: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'system';
}

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'online' | 'offline' | 'away';
  last_seen?: string;
}

const TeamCollaborationPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<number>(1);
  
  const { user } = useAuth();

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Join project room
    newSocket.emit('join-project', selectedProject);
    newSocket.emit('join-org', user?.organization_id);

    // Listen for messages
    newSocket.on('message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for typing indicators
    newSocket.on('user-typing', (data: { userId: number; userName: string }) => {
      setTypingUsers(prev => [...prev.filter(u => u !== data.userName), data.userName]);
    });

    newSocket.on('user-stop-typing', (data: { userId: number }) => {
      setTypingUsers(prev => prev.filter(u => u !== data.userName));
    });

    // Mock team members
    setTeamMembers([
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        status: 'online'
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'developer',
        status: 'online'
      },
      {
        id: 3,
        name: 'Bob Wilson',
        email: 'bob@example.com',
        role: 'developer',
        status: 'away'
      },
      {
        id: 4,
        name: 'Alice Brown',
        email: 'alice@example.com',
        role: 'viewer',
        status: 'offline',
        last_seen: '2 hours ago'
      }
    ]);

    // Mock initial messages
    setMessages([
      {
        id: '1',
        user: 'John Doe',
        message: 'Hey team! The new deployment pipeline is ready for testing.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        type: 'message'
      },
      {
        id: '2',
        user: 'System',
        message: 'Deployment to production completed successfully',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        type: 'system'
      },
      {
        id: '3',
        user: 'Jane Smith',
        message: 'Great work! I\'ll run some tests on the staging environment.',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        type: 'message'
      }
    ]);

    return () => {
      newSocket.disconnect();
    };
  }, [selectedProject, user]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    const message: Message = {
      id: Date.now().toString(),
      user: user?.email?.split('@')[0] || 'You',
      message: newMessage,
      timestamp: new Date(),
      type: 'message'
    };

    // Send to socket
    socket.emit('message', {
      projectId: selectedProject,
      ...message
    });

    // Add to local state
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing', {
        projectId: selectedProject,
        userId: user?.id,
        userName: user?.email?.split('@')[0]
      });

      // Stop typing after 3 seconds
      setTimeout(() => {
        socket.emit('stop-typing', {
          projectId: selectedProject,
          userId: user?.id
        });
      }, 3000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-400';
      case 'away':
        return 'bg-yellow-400';
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Team Collaboration</h1>
          <p className="text-gray-400">Collaborate with your team in real-time</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Team Members Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Team Members</h2>
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="relative">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(member.status)} rounded-full border-2 border-slate-900`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1">
                        <p className="text-sm font-medium text-white truncate">{member.name}</p>
                        {getRoleIcon(member.role)}
                      </div>
                      <p className="text-xs text-gray-400 capitalize">{member.role}</p>
                      {member.status === 'offline' && member.last_seen && (
                        <p className="text-xs text-gray-500">Last seen {member.last_seen}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center space-x-2 p-2 text-left text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  <Bell className="h-4 w-4" />
                  <span className="text-sm">Notification Settings</span>
                </button>
                <button className="w-full flex items-center space-x-2 p-2 text-left text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm">Project Settings</span>
                </button>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Project Chat</h2>
                    <p className="text-sm text-gray-400">
                      {teamMembers.filter(m => m.status === 'online').length} members online
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm">
                      <option value="1">Main Project</option>
                      <option value="2">API Service</option>
                      <option value="3">Frontend App</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.type === 'system' ? 'justify-center' : 'justify-start'}`}>
                    {message.type === 'system' ? (
                      <div className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                        {message.message}
                      </div>
                    ) : (
                      <div className="max-w-xs lg:max-w-md">
                        <div className="bg-white/10 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-white">{message.user}</span>
                            <span className="text-xs text-gray-400">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm">{message.message}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 rounded-lg p-3 max-w-xs">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="p-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamCollaborationPage;