"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import type { HyperForm } from "@/app/actions/forms";
import { submitHyperForm } from "@/app/actions/forms";
import type { HyperFormField } from "@/lib/supabase/database.types";
import {
  resolveTheme,
  resolveBranding,
  themeToCssVars,
  buttonStyleProps,
} from "@/lib/forms/theme";

type RendererMode = "live" | "preview";

interface FormRendererProps {
  form: HyperForm;
  mode?: RendererMode;
  embedded?: boolean;
}

export function FormRenderer({ form, mode = "live", embedded = false }: FormRendererProps) {
  const theme = resolveTheme(form.theme);
  const branding = resolveBranding(form.branding);
  const layout = form.layout ?? "card";

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const cssVars = useMemo(() => themeToCssVars(theme), [theme]);

  function setAnswer(fieldId: string, value: any) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const e = { ...prev };
        delete e[fieldId];
        return e;
      });
    }
  }

  function validateField(field: HyperFormField): string | null {
    const val = answers[field.id];
    if (field.required && (val === undefined || val === null || String(val).trim() === "")) {
      return `${field.label || "This field"} is required.`;
    }
    if (field.type === "email" && val) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(String(val))) return "Please enter a valid email address.";
    }
    return null;
  }

  function validateAll(): boolean {
    const newErrors: Record<string, string> = {};
    for (const field of form.fields) {
      const err = validateField(field);
      if (err) newErrors[field.id] = err;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (mode === "preview") return;
    if (!validateAll()) return;

    setSubmitting(true);
    setSubmitError(null);
    const { error } = await submitHyperForm(form.id, answers);
    setSubmitting(false);
    if (error) setSubmitError(error);
    else setSubmitted(true);
  }

  // Multi-step navigation
  function nextStep() {
    const field = form.fields[step];
    if (field) {
      const err = validateField(field);
      if (err) {
        setErrors((prev) => ({ ...prev, [field.id]: err }));
        return;
      }
    }
    if (step < form.fields.length - 1) setStep((s) => s + 1);
    else handleSubmit();
  }

  // ── Success state ──────────────────────────────────────
  if (submitted) {
    return (
      <ThemeShell cssVars={cssVars} branding={branding} layout={layout} embedded={embedded} center>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--hf-primary) 18%, transparent)" }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: "var(--hf-primary)" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--hf-text)" }}>
            {branding.successTitle}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--hf-muted)" }}>
            {branding.successMessage}
          </p>
        </motion.div>
      </ThemeShell>
    );
  }

  const isMultiStep = layout === "multi-step" && form.fields.length > 0;

  return (
    <ThemeShell cssVars={cssVars} branding={branding} layout={layout} embedded={embedded}>
      <FormCard branding={branding} layout={layout}>
        {/* Logo */}
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt="logo"
            className="h-10 w-auto object-contain mb-5"
          />
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: "var(--hf-text)" }}>
            {form.name}
          </h1>
          {form.description && (
            <p className="mt-1.5 text-sm" style={{ color: "var(--hf-muted)" }}>
              {form.description}
            </p>
          )}
        </div>

        {isMultiStep ? (
          <MultiStepBody
            form={form}
            step={step}
            answers={answers}
            errors={errors}
            setAnswer={setAnswer}
            onNext={nextStep}
            onBack={() => setStep((s) => Math.max(0, s - 1))}
            submitting={submitting}
            submitText={branding.submitText}
            buttonStyle={theme.buttonStyle}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {form.fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                value={answers[field.id] ?? ""}
                onChange={(v) => setAnswer(field.id, v)}
                error={errors[field.id]}
              />
            ))}

            {submitError && <p className="text-sm text-red-500">{submitError}</p>}

            <ThemedButton type="submit" disabled={submitting} buttonStyle={theme.buttonStyle}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Submitting…" : branding.submitText}
            </ThemedButton>
          </form>
        )}

        {submitError && isMultiStep && (
          <p className="mt-3 text-sm text-red-500">{submitError}</p>
        )}
      </FormCard>

      {branding.showBadge && (
        <p className="text-center text-xs mt-6" style={{ color: "var(--hf-muted)" }}>
          Powered by{" "}
          <span className="font-medium" style={{ color: "var(--hf-primary)" }}>
            HyperCRM
          </span>
        </p>
      )}
    </ThemeShell>
  );
}

// ── Theme shell (background + centering) ───────────────────────────────────

function ThemeShell({
  children,
  cssVars,
  branding,
  layout,
  center,
  embedded,
}: {
  children: React.ReactNode;
  cssVars: React.CSSProperties;
  branding: ReturnType<typeof resolveBranding>;
  layout: string;
  center?: boolean;
  embedded?: boolean;
}) {
  const hasBg = !!branding.backgroundUrl;
  return (
    <div
      style={{
        ...cssVars,
        fontFamily: "var(--hf-font)",
        background: "var(--hf-bg)",
        ...(hasBg
          ? {
              backgroundImage: `linear-gradient(color-mix(in srgb, var(--hf-bg) 70%, transparent), color-mix(in srgb, var(--hf-bg) 70%, transparent)), url(${branding.backgroundUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
      }}
      className={`w-full flex flex-col items-center ${
        embedded ? "px-4 py-6" : "min-h-screen px-4 py-10"
      } ${center ? "justify-center" : layout === "single-page" ? "" : "justify-start"}`}
    >
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}

// ── Form card wrapper (respects layout) ────────────────────────────────────

function FormCard({
  children,
  branding,
  layout,
}: {
  children: React.ReactNode;
  branding: ReturnType<typeof resolveBranding>;
  layout: string;
}) {
  const isCard = layout === "card" || layout === "multi-step";

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: "var(--hf-radius)",
        background: isCard ? "var(--hf-input-bg)" : "transparent",
        border: isCard ? "1px solid var(--hf-border)" : "none",
        boxShadow: isCard ? "0 8px 40px rgba(0,0,0,0.25)" : "none",
      }}
    >
      {/* Cover image */}
      {branding.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.coverUrl}
          alt="cover"
          className="w-full h-36 object-cover"
        />
      )}
      <div className={isCard ? "p-6 sm:p-8" : "py-4"}>{children}</div>
    </div>
  );
}

// ── Multi-step body ────────────────────────────────────────────────────────

function MultiStepBody({
  form,
  step,
  answers,
  errors,
  setAnswer,
  onNext,
  onBack,
  submitting,
  submitText,
  buttonStyle,
}: {
  form: HyperForm;
  step: number;
  answers: Record<string, any>;
  errors: Record<string, string>;
  setAnswer: (id: string, v: any) => void;
  onNext: () => void;
  onBack: () => void;
  submitting: boolean;
  submitText: string;
  buttonStyle: HyperForm["theme"]["buttonStyle"];
}) {
  const field = form.fields[step];
  const total = form.fields.length;
  const isLast = step === total - 1;
  const progress = total > 0 ? ((step + 1) / total) * 100 : 0;

  if (!field) return null;

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-6">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--hf-border)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--hf-primary)" }}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--hf-muted)" }}>
          Step {step + 1} of {total}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={field.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <FieldRow
            field={field}
            value={answers[field.id] ?? ""}
            onChange={(v) => setAnswer(field.id, v)}
            error={errors[field.id]}
            large
          />
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 0}
          className="flex items-center gap-1.5 text-sm font-medium disabled:opacity-30 transition-opacity"
          style={{ color: "var(--hf-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
          style={buttonStyleProps(buttonStyle)}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLast ? submitText : "Next"}
          {!isLast && !submitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Field row ──────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  onChange,
  error,
  large,
}: {
  field: HyperFormField;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  large?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className={`block font-medium ${large ? "text-lg" : "text-sm"}`}
        style={{ color: "var(--hf-text)" }}
      >
        {field.label}
        {field.required && <span className="ml-1" style={{ color: "var(--hf-primary)" }}>*</span>}
      </label>
      <ThemedInput field={field} value={value} onChange={onChange} error={!!error} large={large} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ThemedInput({
  field,
  value,
  onChange,
  error,
  large,
}: {
  field: HyperFormField;
  value: any;
  onChange: (v: any) => void;
  error?: boolean;
  large?: boolean;
}) {
  const base: React.CSSProperties = {
    width: "100%",
    background: "var(--hf-bg)",
    color: "var(--hf-text)",
    border: `1px solid ${error ? "#ef4444" : "var(--hf-border)"}`,
    borderRadius: "var(--hf-radius)",
    padding: large ? "12px 16px" : "9px 12px",
    fontSize: large ? "16px" : "14px",
    outline: "none",
  };

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || field.label}
          rows={4}
          style={{ ...base, resize: "none" }}
        />
      );
    case "select":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={base}>
          <option value="">Select…</option>
          {(field.options ?? []).map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4"
            style={{ accentColor: "var(--hf-primary)" }}
          />
          <span className="text-sm" style={{ color: "var(--hf-muted)" }}>
            {field.placeholder || field.label}
          </span>
        </label>
      );
    default:
      return (
        <input
          type={
            field.type === "email"
              ? "email"
              : field.type === "number"
              ? "number"
              : field.type === "date"
              ? "date"
              : field.type === "phone"
              ? "tel"
              : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || field.label}
          style={base}
        />
      );
  }
}

// ── Themed submit button ───────────────────────────────────────────────────

function ThemedButton({
  children,
  buttonStyle,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  buttonStyle: HyperForm["theme"]["buttonStyle"];
}) {
  return (
    <button
      {...props}
      className="inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
      style={buttonStyleProps(buttonStyle)}
    >
      {children}
    </button>
  );
}
