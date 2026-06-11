"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data.user) {
        setSuccess(true);
        // Honor ?redirectTo= so invited users return to the invite page.
        // Read from the URL directly to avoid a Suspense boundary requirement.
        const params = new URLSearchParams(window.location.search);
        const redirectTo = params.get("redirectTo") || params.get("redirect");
        const destination = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/";
        // Small delay for the success animation
        setTimeout(() => {
          router.push(destination);
          router.refresh();
        }, 800);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-semibold text-white mb-2"
        >
          Welcome back
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-white/50"
        >
          Sign in to access your workspace
        </motion.p>
      </div>

      {/* Error Message */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
          >
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-200">Login successful! Redirecting...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email Field */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <label className="text-sm font-medium text-white/80 ml-1">
            Email Address
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              disabled={loading || success}
              className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl
                         text-white placeholder:text-white/30
                         focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05]
                         focus:ring-1 focus:ring-indigo-500/30
                         transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {/* Focus glow effect */}
            <div className="absolute inset-0 rounded-xl bg-indigo-500/10 opacity-0 group-focus-within:opacity-100 
                            blur-xl transition-opacity duration-300 -z-10" />
          </div>
        </motion.div>

        {/* Password Field */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <label className="text-sm font-medium text-white/80 ml-1">
            Password
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading || success}
              className="w-full pl-12 pr-12 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl
                         text-white placeholder:text-white/30
                         focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05]
                         focus:ring-1 focus:ring-indigo-500/30
                         transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/30 
                         hover:text-white/60 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
            {/* Focus glow effect */}
            <div className="absolute inset-0 rounded-xl bg-indigo-500/10 opacity-0 group-focus-within:opacity-100 
                            blur-xl transition-opacity duration-300 -z-10" />
          </div>
        </motion.div>

        {/* Remember Me & Forgot Password */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-between"
        >
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading || success}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-md border border-white/20 bg-white/[0.03] 
                              peer-checked:bg-indigo-500 peer-checked:border-indigo-500
                              peer-focus:ring-2 peer-focus:ring-indigo-500/30
                              transition-all duration-200 flex items-center justify-center">
                {rememberMe && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
              Remember me
            </span>
          </label>
          
          <Link 
            href="/forgot-password" 
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors
                       hover:underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button
            type="submit"
            disabled={loading || success}
            className="group relative w-full py-4 px-6 rounded-xl font-medium text-white
                       bg-gradient-to-r from-indigo-500 to-indigo-600
                       hover:from-indigo-400 hover:to-indigo-500
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200
                       shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
          >
            <span className="flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Success!
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </span>
            {/* Button shine effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent 
                            translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </button>
        </motion.div>
      </form>

      {/* Sign Up Link */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 text-center text-white/50"
      >
        Don&apos;t have an account?{" "}
        <Link 
          href="/signup" 
          className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors
                     hover:underline underline-offset-4"
        >
          Create one
        </Link>
      </motion.p>

      {/* Divider */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-8 relative"
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-[#0f0f16] text-white/40">Protected by enterprise-grade security</span>
        </div>
      </motion.div>

      {/* Security badges */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-6 flex items-center justify-center gap-4 text-white/30"
      >
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-xs">SSL Encrypted</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-white/20" />
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-xs">SOC 2 Compliant</span>
        </div>
      </motion.div>
    </div>
  );
}
