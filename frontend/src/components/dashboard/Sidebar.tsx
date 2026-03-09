'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Phone, 
  Users, 
  BarChart3, 
  Settings,
  FileText,
  CheckCircle,
  Megaphone,
  Code,
  Brain,
  CreditCard,
  LogOut,
  Plug,
  Headphones,
  Eye,
  GitBranch,
  ListOrdered,
  MessageSquare,
  Voicemail,
  Shield,
  ClipboardList,
  Inbox,
  Target,
  Contact2,
  MessageCircle,
  ClipboardCheck,
  Webhook,
  Bell,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Omnichannel Inbox', href: '/inbox', icon: Inbox },
  { name: 'Live Calls', href: '/calls/live', icon: Phone },
  { name: 'Call History', href: '/calls', icon: FileText },
  { name: 'Recordings', href: '/recordings', icon: Headphones },
  { name: 'SMS Inbox', href: '/sms', icon: MessageSquare },
  { name: 'WhatsApp', href: '/whatsapp', icon: MessageCircle },
  { name: 'Voicemail', href: '/voicemail', icon: Voicemail },
  { name: 'Contacts', href: '/contacts', icon: Contact2 },
  { name: 'Leads Pipeline', href: '/leads', icon: Target },
  { name: 'AI Agents', href: '/agents', icon: Users },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Surveys', href: '/surveys', icon: ClipboardCheck },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'QA & Scoring', href: '/qa', icon: CheckCircle },
  { name: 'Monitoring', href: '/monitoring', icon: Eye },
  { name: 'IVR Builder', href: '/ivr', icon: GitBranch },
  { name: 'Queue', href: '/queue', icon: ListOrdered },
  { name: 'Tools', href: '/tools', icon: Code },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: Brain },
  { name: 'Team & Roles', href: '/team', icon: Shield },
  { name: 'Audit Log', href: '/audit-log', icon: ClipboardList },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Webhooks', href: '/webhooks', icon: Webhook },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; email?: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(userData);
    } catch {}
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.email || '';

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div
      className={`flex flex-col bg-gray-900 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="flex items-center h-16 bg-gray-800 px-3 relative">
        {!collapsed && (
          <span className="text-white text-lg font-bold truncate flex-1">
            AI Call Center
          </span>
        )}
        <button
          onClick={toggleCollapse}
          className={`p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors ${
            collapsed ? 'mx-auto' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`
                group flex items-center rounded-lg transition-colors duration-150
                ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'}
                ${isActive
                  ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white border-l-2 border-transparent'}
              `}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${collapsed ? '' : 'mr-3'}`} />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User & Footer */}
      <div className="bg-gray-800 border-t border-gray-700">
        {/* User Profile */}
        <div className={`flex items-center gap-3 px-3 py-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              {user?.firstName && user?.email && (
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              )}
            </div>
          )}
        </div>

        {/* Language & Logout */}
        <div className={`px-3 pb-3 space-y-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {!collapsed && <LanguageSwitcher />}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm transition-colors ${
              collapsed ? 'p-2 rounded-md hover:bg-gray-700' : 'w-full'
            }`}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
