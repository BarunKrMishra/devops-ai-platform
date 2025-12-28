import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Home, LayoutDashboard, GitBranch, Cloud, Activity, FileText, Settings, LogOut, LayoutTemplate, Users, TrendingUp, PlugZap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AikyaLogo from './brand/AikyaLogo';

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
    { path: '/app/integrations', label: 'Integrations', icon: PlugZap },
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
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/70 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div 
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => handleNavigation('/')}
          >
            <AikyaLogo textClassName="text-white" />
          </div>

          {user && (
            <nav className="hidden lg:flex items-center flex-1 min-w-0 gap-2 overflow-x-auto whitespace-nowrap">
              {navigationItems.slice(1).map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-sm flex-shrink-0 ${
                    isActive(item.path)
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center space-x-4 shrink-0">
            {user ? (
              <>
                <div className="hidden md:flex items-center space-x-3">
                  <span className="hidden xl:inline text-slate-300 text-sm max-w-[180px] truncate">{user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 px-3 py-2 bg-red-500/20 text-red-200 rounded-lg hover:bg-red-500/30 transition-all"
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
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-teal-500 text-white rounded-lg hover:from-amber-600 hover:to-teal-600 transition-all"
              >
                Get Started
              </button>
            )}
          </div>
        </div>

        {isMenuOpen && user && (
          <div className="lg:hidden mt-4 p-4 bg-slate-900/60 rounded-lg backdrop-blur-sm border border-white/5 max-h-[70vh] overflow-y-auto">
            <nav className="flex flex-col space-y-2">
              {navigationItems.slice(1).map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                    isActive(item.path)
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="border-t border-white/10 pt-2 mt-2">
                <div className="px-4 py-2 text-slate-300 text-sm">{user.email}</div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-red-200 hover:bg-red-500/20 rounded-lg transition-all w-full"
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
