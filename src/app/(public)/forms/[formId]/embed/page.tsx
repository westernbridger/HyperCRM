"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { getFormByIdPublic, type HyperForm } from "@/app/actions/forms";
import { FormRenderer } from "@/components/forms/form-renderer";
import { FontLoader } from "@/components/forms/font-loader";
import { resolveTheme } from "@/lib/forms/theme";

export default function EmbeddedFormPage() {
  const params = useParams();
  const formId = params.formId as string;

  const [form, setForm] = useState<HyperForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getFormByIdPublic(formId).then(({ data, error }) => {
      if (error || !data) setNotFound(true);
      else setForm(data);
      setLoading(false);
    });
  }, [formId]);

  // Report height to the parent window so the iframe can auto-resize.
  useEffect(() => {
    if (!form) return;

    function postHeight() {
      const height = document.body.scrollHeight;
      window.parent.postMessage(
        { type: "hypercrm-form-resize", formId, height },
        "*"
      );
    }

    postHeight();
    const ro = new ResizeObserver(postHeight);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("load", postHeight);
    const interval = setInterval(postHeight, 1000);

    return () => {
      ro.disconnect();
      window.removeEventListener("load", postHeight);
      clearInterval(interval);
    };
  }, [form, formId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="flex items-center justify-center py-16 px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">This form is unavailable.</p>
        </div>
      </div>
    );
  }

  const theme = resolveTheme(form.theme);

  return (
    <div ref={containerRef}>
      <FontLoader family={theme.fontFamily} />
      <FormRenderer form={form} mode="live" embedded />
    </div>
  );
}
