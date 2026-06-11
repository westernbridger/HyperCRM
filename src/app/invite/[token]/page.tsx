"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Users, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  acceptInvitation,
  getInvitationInfo,
  setPasswordAndAccept,
} from "@/app/actions/team";

type State = "loading" | "setPassword" | "success" | "error" | "unauthenticated";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string>("");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);

  // Set-password form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    getInvitationInfo(token).then((info) => {
      if (!info.valid) {
        setState("error");
        setMessage(info.error ?? "This invitation is no longer valid.");
        return;
      }

      setWorkspaceName(info.workspaceName);
      setInviterName(info.inviterName);
      setInviteEmail(info.email);

      if (info.needsPasswordSetup) {
        // New user — show the set-password form.
        setState("setPassword");
      } else {
        // Existing account — try to accept (requires an active session).
        acceptInvitation(token).then(({ workspaceName: ws, error }) => {
          if (error) {
            if (error.includes("signed in")) {
              setState("unauthenticated");
              setMessage(error);
            } else {
              setState("error");
              setMessage(error);
            }
          } else {
            setWorkspaceName(ws);
            setState("success");
          }
        });
      }
    });
  }, [token]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { email, workspaceName: ws, error } = await setPasswordAndAccept(token, password);
    if (error || !email) {
      setFormError(error ?? "Could not set your password. Please try again.");
      setSubmitting(false);
      return;
    }

    // Sign the user in with their new password to establish a session.
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setFormError(signInError.message);
      setSubmitting(false);
      return;
    }

    setWorkspaceName(ws);
    setState("success");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl text-center space-y-6"
      >
        {/* Logo / brand */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-2">
            <Users className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">HyperCRM</span>
        </div>

        {state === "loading" && (
          <div className="space-y-3 py-4">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Verifying your invitation…</p>
          </div>
        )}

        {state === "setPassword" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 text-left">
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-bold">Set up your account</h2>
              <p className="text-sm text-muted-foreground">
                {inviterName ? <><span className="font-medium text-foreground">{inviterName}</span> invited you</> : "You've been invited"}
                {workspaceName ? <> to join <span className="font-medium text-foreground">{workspaceName}</span></> : null}
                . Choose a password to activate your account.
              </p>
              {inviteEmail && (
                <p className="text-xs text-muted-foreground pt-1">{inviteEmail}</p>
              )}
            </div>

            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    disabled={submitting}
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    disabled={submitting}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
              >
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating…</> : "Activate account & join"}
              </Button>
            </form>
          </motion.div>
        )}

        {state === "success" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">You're in!</h2>
              <p className="text-sm text-muted-foreground">
                You've joined{" "}
                {workspaceName ? (
                  <span className="font-medium text-foreground">{workspaceName}</span>
                ) : (
                  "your new workspace"
                )}
                .
              </p>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
              onClick={() => {
                // Force full reload to refresh workspace list
                window.location.href = "/";
              }}
            >
              Go to Dashboard
            </Button>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Invitation Invalid</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => router.push("/")}>
              Back to Dashboard
            </Button>
          </motion.div>
        )}

        {state === "unauthenticated" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
              <Users className="h-8 w-8 text-amber-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Sign in to accept</h2>
              <p className="text-sm text-muted-foreground">
                {inviterName ? (
                  <><span className="font-medium text-foreground">{inviterName}</span> invited you</>
                ) : (
                  "You've been invited"
                )}
                {workspaceName ? (
                  <> to join <span className="font-medium text-foreground">{workspaceName}</span>.</>
                ) : null}
                {" "}Sign in with <span className="font-medium text-foreground">{inviteEmail}</span> to accept.
              </p>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
              onClick={() => router.push(`/login?redirectTo=/invite/${token}`)}
            >
              Sign In
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
