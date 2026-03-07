'use client';

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
  Bell
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col w-64 bg-gray-900">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <span className="text-white text-xl font-bold">AI Call Center</span>
      </div>
      
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center px-3 py-2 text-sm font-medium rounded-md
                ${isActive 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
              `}
            >
              <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Language Switcher & Logout */}
      <div className="px-4 py-4 bg-gray-800 border-t border-gray-700 space-y-3">
        <LanguageSwitcher />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-gray-300 hover:text-white text-sm"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
