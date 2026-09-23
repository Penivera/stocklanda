"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowRightLeft, PieChart, Rocket } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", href: "/", icon: LayoutDashboard },
    { name: "Options", href: "/options", icon: ArrowRightLeft },
    { name: "Basket", href: "/basket", icon: PieChart },
    { name: "Launchpad", href: "/launchpad", icon: Rocket },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-void/95 backdrop-blur-md flex justify-around py-3 px-4 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center space-y-1 ${
              isActive ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon size={20} />
            <span
              className={`text-[11px] font-mono transition-all ${
                isActive ? "border-b-2 border-emerald-400 pb-0.5" : "pb-1"
              }`}
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}