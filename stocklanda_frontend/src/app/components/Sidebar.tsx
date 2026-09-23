// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { LayoutDashboard, ArrowRightLeft, PieChart } from "lucide-react";

// export default function Sidebar() {
//   const pathname = usePathname();

//   const navItems = [
//     { name: "Dashboard", href: "/", icon: LayoutDashboard },
//     { name: "Options Desk", href: "/options", icon: ArrowRightLeft },
//     { name: "Basket Composer", href: "/basket", icon: PieChart },
//   ];

//   return (
//     <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 p-6 min-h-screen">
//       <div className="text-2xl font-sans font-bold tracking-tight mb-10">
//         Stock<span className="text-emerald-400">Forge</span>
//         <button className="text-white border border-gray-500 px-3 py-1 rounded font-mono text-xs font-bold">
//               Connect Wallet
//         </button>
//       </div>

//       <nav className="flex flex-col space-y-2 font-mono text-sm">
//         <p className="text-slate-500 mb-2 text-xs uppercase tracking-wider">Navigation</p>
//         {navItems.map((item) => {
//           const Icon = item.icon;
//           const isActive = pathname === item.href;

//           return (
//             <Link
//               key={item.name}
//               href={item.href}
//               className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
//                 isActive
//                   ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/30"
//                   : "text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent"
//               }`}
//             >
//               <Icon size={18} />
//               <span>{item.name}</span>
//             </Link>
//           );
//         })}
//       </nav>
//     </aside>
//   );
// }


"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowRightLeft, PieChart, Rocket } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Options Desk", href: "/options", icon: ArrowRightLeft },
    { name: "Basket Composer", href: "/basket", icon: PieChart },
    { name: "Launchpad", href: "/launchpad", icon: Rocket },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 p-6 min-h-[calc(100vh-65px)]">
      <nav className="flex flex-col space-y-2 font-mono text-sm">
        <p className="text-slate-500 mb-2 text-xs uppercase tracking-wider">Navigation</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent"
              }`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}