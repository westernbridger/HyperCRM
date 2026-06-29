"use client";

import { ReactNode } from "react";
import { HyperLogo } from "@/components/layout/hyper-logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#0a0a0f]">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary gradient orbs */}
        <div 
          className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.4) 0%, rgba(99,102,241,0) 70%)",
            filter: "blur(80px)",
            animation: "float 20s ease-in-out infinite",
          }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.4) 0%, rgba(16,185,129,0) 70%)",
            filter: "blur(80px)",
            animation: "float 25s ease-in-out infinite reverse",
          }}
        />
        <div 
          className="absolute top-[40%] left-[60%] w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0) 70%)",
            filter: "blur(60px)",
            animation: "float 18s ease-in-out infinite",
          }}
        />
        
        {/* Noise texture overlay for premium feel */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Logo area */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <HyperLogo size={48} showBloom={true} />
              <span className="text-2xl font-bold tracking-tight text-white">
                Hyper<span className="text-amber-500">CRM</span>
              </span>
            </div>
          </div>
          
          {/* Auth card */}
          <div className="relative">
            {/* Card glow effect */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl blur-sm" />
            
            {/* Card content */}
            <div className="relative bg-[#0f0f16]/80 backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
              {/* Top gradient line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
              
              {children}
            </div>
          </div>
          
          {/* Footer */}
          <p className="mt-8 text-center text-sm text-white/40">
            © 2024 HyperCRM. Enterprise-grade CRM platform.
          </p>
        </div>
      </div>

      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.05);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}
