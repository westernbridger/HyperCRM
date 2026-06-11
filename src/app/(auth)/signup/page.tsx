"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mail, 
  Lock, 
  User, 
  Building2, 
  ArrowRight, 
  ArrowLeft,
  Eye, 
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateStep1 = () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return false;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!firstName || !lastName) {
      setError("Please enter your name");
      return false;
    }
    if (!agreedToTerms) {
      setError("Please accept the terms of service");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      handleNext();
      return;
    }

    if (!validateStep2()) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName || `${firstName}'s Company`,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user) {
        setSuccess(true);
        // The database trigger will auto-create the workspace
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          {/* Success animation */}
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 
                            flex items-center justify-center shadow-2xl shadow-emerald-500/30">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
          </div>
          
          <h1 className="text-2xl font-semibold text-white mb-3">
            Welcome to HyperCRM!
          </h1>
          <p className="text-white/60 mb-6">
            Your account has been created successfully. Please check your email to verify your account.
          </p>
          
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-6">
            <p className="text-sm text-white/50 mb-2">What happens next:</p>
            <ul className="text-sm text-white/70 space-y-2 text-left">
              <li className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                </div>
                Verify your email address
              </li>
              <li className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white/50" />
                </div>
                Your workspace will be auto-configured
              </li>
              <li className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                  <Zap className="h-3 w-3 text-white/50" />
                </div>
                Start managing your contacts
              </li>
            </ul>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 
                       font-medium transition-colors"
          >
            Go to login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] 
                     border border-white/[0.08] mb-4"
        >
          <span className="text-xs text-white/50">Step {step} of 2</span>
          <div className="flex gap-1">
            <div className={`w-6 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-indigo-500' : 'bg-white/20'}`} />
            <div className={`w-6 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-indigo-500' : 'bg-white/20'}`} />
          </div>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-semibold text-white mb-2"
        >
          {step === 1 ? "Create your account" : "Complete your profile"}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-white/50"
        >
          {step === 1 
            ? "Start your 14-day free trial" 
            : "Tell us a bit about yourself"}
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 ml-1">
                  Work Email
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
                    disabled={loading}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl
                               text-white placeholder:text-white/30
                               focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05]
                               focus:ring-1 focus:ring-indigo-500/30
                               transition-all duration-200
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="absolute inset-0 rounded-xl bg-indigo-500/10 opacity-0 group-focus-within:opacity-100 
                                  blur-xl transition-opacity duration-300 -z-10" />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
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
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    disabled={loading}
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
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                  <div className="absolute inset-0 rounded-xl bg-indigo-500/10 opacity-0 group-focus-within:opacity-100 
                                  blur-xl transition-opacity duration-300 -z-10" />
                </div>
                {/* Password strength indicator */}
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        password.length >= i * 2 
                          ? password.length >= 8 
                            ? 'bg-emerald-500' 
                            : 'bg-yellow-500'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 ml-1">
                  Confirm Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl
                               text-white placeholder:text-white/30
                               focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05]
                               focus:ring-1 focus:ring-indigo-500/30
                               transition-all duration-200
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="absolute inset-0 rounded-xl bg-indigo-500/10 opacity-0 group-focus-within:opacity-100 
                                  blur-xl transition-opacity duration-300 -z-10" />
                </div>
              </div>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="group relative w-full py-4 px-6 rounded-xl font-medium text-white
                           bg-gradient-to-r from-indigo-500 to-indigo-600
                           hover:from-indigo-400 hover:to-indigo-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200
                           shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                <span className="flex items-center justify-center gap-2">
                  Continue
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent 
                                translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80 ml-1">
                    First Name
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      required
                      disabled={loading}
                      className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl
                                 text-white placeholder:text-white/30
                                 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05]
                                 focus:ring-1 focus:ring-indigo-500/30
                                 transition-all duration-200
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="absolute inset-0 rounded-xl bg-indigo-500/10 opacity-0 group-focus-within:opacity-100 
                                    blur-xl transition-opacity duration-300 -z-10" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80 ml-1">
                    Last Name
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      required
                      disabled={loading}
                      className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl
                                 text-white placeholder:text-white/30
                                 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05]
                                 focus:ring-1 focus:ring-indigo-500/30
                                 transition-all duration-200
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="absolute inset-0 rounded-xl bg-indigo-500/10 opacity-0 group-focus-within:opacity-100 
                                    blur-xl transition-opacity duration-300 -z-10" />
                  </div>
                </div>
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 ml-1">
                  Company Name <span className="text-white/40">(Optional)</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Inc."
                    disabled={loading}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl
                               text-white placeholder:text-white/30
                               focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05]
                               focus:ring-1 focus:ring-indigo-500/30
                               transition-all duration-200
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="absolute inset-0 rounded-xl bg-indigo-500/10 opacity-0 group-focus-within:opacity-100 
                                  blur-xl transition-opacity duration-300 -z-10" />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      disabled={loading}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 rounded-md border border-white/20 bg-white/[0.03] 
                                    peer-checked:bg-indigo-500 peer-checked:border-indigo-500
                                    peer-focus:ring-2 peer-focus:ring-indigo-500/30
                                    transition-all duration-200 flex items-center justify-center">
                      {agreedToTerms && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                      Terms of Service
                    </Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                      Privacy Policy
                    </Link>
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 py-4 px-6 rounded-xl font-medium text-white/70
                             bg-white/[0.03] border border-white/[0.08]
                             hover:bg-white/[0.05] hover:text-white
                             focus:outline-none focus:ring-2 focus:ring-white/20
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all duration-200"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ArrowLeft className="h-5 w-5" />
                    Back
                  </span>
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] relative py-4 px-6 rounded-xl font-medium text-white
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
                        Creating account...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Create Account
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent 
                                  translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Sign In Link */}
      <p className="mt-8 text-center text-white/50">
        Already have an account?{" "}
        <Link 
          href="/login" 
          className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors
                     hover:underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
