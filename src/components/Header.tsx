import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Menu, X, Home, LayoutDashboard, GitBranch, Cloud, Activity, FileText, Settings, LogOut, LayoutTemplate, Users, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/cicd', label: 'CI/CD', icon: GitBranch },
    { path: '/infrastructure', label: 'Infrastructure', icon: Cloud },
    { path: '/monitoring', label: 'Monitoring', icon: Activity },
    { path: '/templates', label: 'Templates', icon: LayoutTemplate },
    { path: '/collaboration', label: 'Team', icon: Users },
    { path: '/analytics', label: 'Analytics', icon: TrendingUp },
    { path: '/audit', label: 'Audit', icon: FileText },
    { path: '/settings', label: 'Settings', icon: Settings }
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-black/20 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => handleNavigation('/')}
          >
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">DevOps AI</span>
          </div>

          {user && (
            <nav className="hidden lg:flex items-center space-x-2">
              {navigationItems.slice(1).map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-sm ${
                    isActive(item.path)
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="hidden md:flex items-center space-x-3">
                  <span className="text-gray-300 text-sm">{user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg"
                >
                  {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </>
            ) : (
              <button
                onClick={() => handleNavigation('/login')}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
              >
                Get Started
              </button>
            )}
          </div>
        </div>

        {isMenuOpen && user && (
          <div className="lg:hidden mt-4 p-4 bg-black/30 rounded-lg backdrop-blur-sm">
            <nav className="flex flex-col space-y-2">
              {navigationItems.slice(1).map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                    isActive(item.path)
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="border-t border-white/10 pt-2 mt-2">
                <div className="px-4 py-2 text-gray-300 text-sm">{user.email}</div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-red-300 hover:bg-red-500/20 rounded-lg transition-all w-full"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;