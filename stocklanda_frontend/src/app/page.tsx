// "use client";

// interface DashboardState {
//   totalValue: number;
//   valueChange30d: number;
//   currency: string;
//   activeOptions: { total: number; calls: number; puts: number };
//   myBaskets: { total: number; minted: number; draft: number };
//   unrealizedPnL: number;
//   expiringSoon: number;
//   recentActivity: Array<{
//     id: string;
//     title: string;
//     action: string;
//     time: string;
//     value: string;
//     isPositive: boolean;
//     isNeutral?: boolean;
//   }>;
// }

// const mockState: DashboardState = {
//   totalValue: 248390.00,
//   valueChange30d: 12.4,
//   currency: "USDC",
//   activeOptions: { total: 7, calls: 3, puts: 4 },
//   myBaskets: { total: 3, minted: 2, draft: 1 },
//   unrealizedPnL: 18240,
//   expiringSoon: 2,
//   recentActivity: [
//     { id: "1", title: "SpaceX CALL", action: "Bought", time: "2h ago", value: "+$4.20", isPositive: true },
//     { id: "2", title: "OpenAI PUT", action: "Written", time: "5h ago", value: "-$7.85", isPositive: false },
//     { id: "3", title: "FORGE-001 minted", action: "Basket", time: "1d ago", value: "3 assets", isPositive: true },
//     { id: "4", title: "Anthropic CALL", action: "Expired", time: "2d ago", value: "$0.00", isPositive: false, isNeutral: true },
//     { id: "5", title: "Stripe PUT", action: "Bought", time: "3d ago", value: "-$12.50", isPositive: false },
//     { id: "6", title: "TECH-ETF minted", action: "Basket", time: "4d ago", value: "5 assets", isPositive: true },
//   ]
// };

// export default function Dashboard() {
//   const data = mockState; // Swap this variable with your Zustand store later

//   const formatCurrency = (val: number) => 
//     new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

//   return (
//     <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
      
//       <h1 className="hidden md:block text-sm font-mono text-slate-400 tracking-widest uppercase mb-4">
//         Portfolio Overview
//       </h1>

//       {/* Total Value Card */}
//       <section className="border border-emerald-400 rounded-xl p-6 bg-slate-900/40 relative overflow-hidden">
//         <p className="text-slate-400 text-sm font-mono mb-2">Total Value</p>
//         <h2 className="text-4xl md:text-5xl font-sans font-bold mb-2 tracking-tight">
//           {formatCurrency(data.totalValue)}
//         </h2>
//         <p className="text-emerald-400 font-mono text-sm flex items-center space-x-1">
//           <span>▲</span>
//           <span>+{data.valueChange30d}% (30d)</span>
//         </p>
//         <div className="absolute right-4 bottom-4 text-xs font-mono text-slate-600 hidden md:block">
//           {data.currency}
//         </div>
//       </section>

//       {/* Desktop Two-Column Layout */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        
//         {/* Left Column: Metrics Grid */}
//         <div className="md:col-span-2 grid grid-cols-2 gap-3 md:gap-4">
//           <div className="bg-slate-900 rounded-xl p-4 md:p-5 border border-slate-800 flex flex-col justify-between">
//             <p className="text-slate-400 text-xs md:text-sm font-mono mb-2">Active Options</p>
//             <div>
//               <p className="text-2xl md:text-3xl font-sans font-bold mb-1">{data.activeOptions.total}</p>
//               <p className="text-slate-500 text-xs font-mono">
//                 {data.activeOptions.calls} calls • {data.activeOptions.puts} puts
//               </p>
//             </div>
//           </div>
          
//           <div className="bg-slate-900 rounded-xl p-4 md:p-5 border border-slate-800 flex flex-col justify-between">
//             <p className="text-slate-400 text-xs md:text-sm font-mono mb-2">My Baskets</p>
//             <div>
//               <p className="text-2xl md:text-3xl font-sans font-bold mb-1">{data.myBaskets.total}</p>
//               <p className="text-slate-500 text-xs font-mono">
//                 {data.myBaskets.minted} minted • {data.myBaskets.draft} draft
//               </p>
//             </div>
//           </div>
          
//           <div className="bg-slate-900 rounded-xl p-4 md:p-5 border border-slate-800 flex flex-col justify-between">
//             <p className="text-slate-400 text-xs md:text-sm font-mono mb-2">Unrealized P&L</p>
//             <p className="text-xl md:text-2xl font-sans font-bold text-emerald-400">
//               +{formatCurrency(data.unrealizedPnL)}
//             </p>
//           </div>
          
//           <div className="bg-slate-900 rounded-xl p-4 md:p-5 border border-slate-800 flex flex-col justify-between">
//             <p className="text-slate-400 text-xs md:text-sm font-mono mb-2">Expiring Soon</p>
//             <p className="text-xl md:text-2xl font-sans font-bold text-red-400">
//               {data.expiringSoon} options
//             </p>
//           </div>
//         </div>

//         {/* Right Column: Recent Activity */}
//         <section className="md:col-span-1 bg-slate-900/40 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col h-87.5">
//           <h3 className="text-slate-500 text-xs font-mono tracking-widest uppercase mb-4 shrink-0">
//             Recent Activity
//           </h3>
          
//           <div className="space-y-4 overflow-y-auto pr-2 pb-2 flex-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
//             {data.recentActivity.slice(0, 6).map((activity) => (
//               <div key={activity.id} className="flex justify-between items-center border-b border-slate-800  last:border-0 last:pb-0">
//                 <div>
//                   <p className="font-sans text-sm font-medium">{activity.title}</p>
//                   <p className="text-slate-500 text-xs font-mono mt-1">
//                     {activity.action} • {activity.time}
//                   </p>
//                 </div>
//                 <p className={`font-mono text-sm ${activity.isNeutral ? 'text-slate-400' : activity.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
//                   {activity.value}
//                 </p>
//               </div>
//             ))}
//           </div>
//         </section>

//       </div>
//     </div>
//   );
// }

"use client";

interface DashboardState {
  totalValue: number;
  valueChange30d: number;
  currency: string;
  activeOptions: { total: number; calls: number; puts: number };
  myBaskets: { total: number; minted: number; draft: number };
  unrealizedPnL: number;
  expiringSoon: number;
  recentActivity: Array<{
    id: string;
    title: string;
    action: string;
    time: string;
    value: string;
  }>;
}

const mockState: DashboardState = {
  totalValue: 248390.00,
  valueChange30d: 12.4,
  currency: "USDC",
  activeOptions: { total: 7, calls: 3, puts: 4 },
  myBaskets: { total: 3, minted: 2, draft: 1 },
  unrealizedPnL: 18240,
  expiringSoon: 2,
  recentActivity: [
    { id: "1", title: "SpaceX CALL", action: "Bought", time: "2h ago", value: "+$4.20" },
    { id: "2", title: "OpenAI PUT", action: "Written", time: "5h ago", value: "-$7.85" },
    { id: "3", title: "FORGE-001 minted", action: "Basket", time: "1d ago", value: "3 assets" },
    { id: "4", title: "Anthropic CALL", action: "Expired", time: "2d ago", value: "$0.00" },
    { id: "5", title: "Stripe PUT", action: "Bought", time: "3d ago", value: "-$12.50" },
    { id: "6", title: "TECH-ETF minted", action: "Basket", time: "4d ago", value: "5 assets" },
  ]
};

export default function Dashboard() {
  const data = mockState; // Swap this variable with your Zustand store later

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      
      <div>
        <h1 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-4">
          Portfolio Overview
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        
        {/* --- LEFT COLUMN: METRICS --- */}
        <div className="md:col-span-2 space-y-6 md:space-y-8">
          
          {/* Total Value Card */}
          <section className="border border-slate-800 rounded-xl p-6 md:p-8 bg-slate-900/40 relative overflow-hidden transition-colors hover:bg-slate-800/30">
            <p className="text-slate-400 text-sm font-mono mb-2">Total Value</p>
            <h2 className="text-4xl md:text-5xl font-sans font-bold text-white mb-2 tracking-tight">
              {formatCurrency(data.totalValue)}
            </h2>
            <p className="text-slate-300 font-mono text-sm flex items-center space-x-1">
              <span className="text-[10px]">▲</span>
              <span>+{data.valueChange30d}% (30d)</span>
            </p>
            <div className="absolute right-6 bottom-6 text-xs font-mono text-slate-600 hidden md:block uppercase">
              {data.currency}
            </div>
          </section>

          {/* 2x2 Stats Grid */}
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div className="bg-slate-900/40 rounded-xl p-5 md:p-6 border border-slate-800 flex flex-col justify-between transition-colors hover:bg-slate-800/30">
              <p className="text-slate-400 text-xs md:text-sm font-mono mb-4">Active Options</p>
              <div>
                <p className="text-2xl md:text-3xl font-sans font-bold text-white mb-1">{data.activeOptions.total}</p>
                <p className="text-slate-500 text-[10px] md:text-xs font-mono uppercase">
                  {data.activeOptions.calls} calls • {data.activeOptions.puts} puts
                </p>
              </div>
            </div>
            
            <div className="bg-slate-900/40 rounded-xl p-5 md:p-6 border border-slate-800 flex flex-col justify-between transition-colors hover:bg-slate-800/30">
              <p className="text-slate-400 text-xs md:text-sm font-mono mb-4">My Baskets</p>
              <div>
                <p className="text-2xl md:text-3xl font-sans font-bold text-white mb-1">{data.myBaskets.total}</p>
                <p className="text-slate-500 text-[10px] md:text-xs font-mono uppercase">
                  {data.myBaskets.minted} minted • {data.myBaskets.draft} draft
                </p>
              </div>
            </div>
            
            <div className="bg-slate-900/40 rounded-xl p-5 md:p-6 border border-slate-800 flex flex-col justify-between transition-colors hover:bg-slate-800/30">
              <p className="text-slate-400 text-xs md:text-sm font-mono mb-4">Unrealized P&L</p>
              <p className="text-xl md:text-2xl font-sans font-bold text-white">
                +{formatCurrency(data.unrealizedPnL)}
              </p>
            </div>
            
            <div className="bg-slate-900/40 rounded-xl p-5 md:p-6 border border-slate-800 flex flex-col justify-between transition-colors hover:bg-slate-800/30">
              <p className="text-slate-400 text-xs md:text-sm font-mono mb-4">Expiring Soon</p>
              <p className="text-xl md:text-2xl font-sans font-bold text-white">
                {data.expiringSoon} options
              </p>
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: RECENT ACTIVITY --- */}
        <section className="md:col-span-1 bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-6 flex flex-col h-full transition-colors hover:bg-slate-800/30">
          <h2 className="text-slate-500 text-xs font-mono tracking-widest uppercase mb-6 border-b border-slate-800 pb-4 shrink-0">
            Recent Activity
          </h2>
          
          <div className="space-y-6 overflow-y-auto pr-2 pb-2 flex-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {data.recentActivity.slice(0, 6).map((activity) => (
              <div key={activity.id} className="flex justify-between items-start">
                <div>
                  <p className="font-sans text-sm font-bold text-white">{activity.title}</p>
                  <p className="text-slate-500 text-[10px] font-mono mt-0.5 uppercase">
                    {activity.action} • {activity.time}
                  </p>
                </div>
                <p className="font-mono text-sm text-white">
                  {activity.value}
                </p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}