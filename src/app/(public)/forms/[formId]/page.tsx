"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { getFormByIdPublic, type HyperForm } from "@/app/actions/forms";
import { FormRenderer } from "@/components/forms/form-renderer";
import { FontLoader } from "@/components/forms/font-loader";
import { resolveTheme } from "@/lib/forms/theme";

export default function PublicFormPage() {
  const params = useParams();
  const formId = params.formId as string;

  const [form, setForm] = useState<HyperForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getFormByIdPublic(formId).then(({ data, error }) => {
      if (error || !data) setNotFound(true);
      else setForm(data);
      setLoading(false);
    });
  }, [formId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h1 className="text-lg font-semibold">Form not found</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This form doesn&apos;t exist or is no longer accepting responses.
          </p>
        </div>
      </div>
    );
  }

  const theme = resolveTheme(form.theme);

  return (
    <>
      <FontLoader family={theme.fontFamily} />
      <FormRenderer form={form} mode="live" />
    </>
  );
}
