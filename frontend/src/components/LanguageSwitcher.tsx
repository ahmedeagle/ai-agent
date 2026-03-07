'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = (locale: string) => {
    const currentPath = pathname.replace(/^\/(en|ar)/, '');
    router.push(`/${locale}${currentPath}`);
  };

  const currentLocale = pathname.startsWith('/ar') ? 'ar' : 'en';

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-400" />
      <select
        value={currentLocale}
        onChange={(e) => switchLanguage(e.target.value)}
        className="bg-gray-800 text-white text-sm rounded px-2 py-1 border-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="en">English</option>
        <option value="ar">العربية</option>
      </select>
    </div>
  );
}
