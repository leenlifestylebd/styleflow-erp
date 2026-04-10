'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, BarChart3,
  Users, CreditCard, Settings, FileSpreadsheet, Tag,
  ChevronLeft, ChevronRight, LogOut, ShoppingBag
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { href: '/dashboard',         label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/pos',               label: 'POS',         icon: ShoppingCart, badge: 'NEW' },
  { href: '/inventory',         label: 'Inventory',   icon: Package },
  { href: '/courier',           label: 'Courier',     icon: Truck },
  { href: '/courier/import',    label: 'Bulk Import', icon: FileSpreadsheet },
  { href: '/inventory/barcode', label: 'Barcodes',    icon: Tag },
  { href: '/purchases',         label: 'Purchases',   icon: ShoppingBag },
  { href: '/staff',             label: 'Staff',       icon: Users },
  { href: '/accounting',        label: 'Accounting',  icon: CreditCard },
  { href: '/reports',           label: 'Reports',     icon: BarChart3 },
  { href: '/settings',          label: 'Settings',    icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-gray-900 flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className={`flex items-center h-14 px-4 border-b border-gray-800 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {!collapsed && (
            <>
              <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">SF</div>
              <span className="font-bold text-white text-sm">StyleFlow</span>
            </>
          )}
          {collapsed && <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">SF</div>}
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg mb-0.5 text-sm transition-colors
                  ${active ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
                  ${collapsed ? 'justify-center px-2' : ''}`}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && badge && (
                  <span className="text-xs bg-purple-500 text-white px-1.5 py-0.5 rounded-full">{badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-800 p-3 space-y-1">
          <button
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white text-sm transition-colors ${collapsed ? 'justify-center' : ''}`}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
          </button>
          <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-red-900 hover:text-red-300 text-sm transition-colors ${collapsed ? 'justify-center' : ''}`}>
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
