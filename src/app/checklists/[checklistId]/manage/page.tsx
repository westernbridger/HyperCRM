"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChecklistDetail } from "@/components/documents/checklist-detail";
import { getChecklistById, type ChecklistWithDetails } from "@/app/actions/checklists";

export default function ManageChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const checklistId = params.checklistId as string;
  const [data, setData] = useState<ChecklistWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getChecklistById(checklistId).then(({ data, error }) => {
      if (error || !data) setNotFound(true);
      else setData(data);
      setLoading(false);
    });
  }, [checklistId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold">Checklist not found</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You may not have access to this checklist.
          </p>
          <Button onClick={() => router.push("/documents")} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/documents")}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Button>
        </div>
        <ChecklistDetail
          checklistId={checklistId}
          onDeleted={() => router.push("/documents")}
        />
      </div>
    </div>
  );
}
