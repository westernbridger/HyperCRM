"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Download } from "lucide-react";

interface ImportRowResult {
  rowNumber: number;
  name: string;
  email: string;
  status: "success" | "error" | "skipped";
  action: "created" | "updated" | "failed" | "skipped";
  message: string;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  createdCount: number;
  updatedCount: number;
  rows: ImportRowResult[];
  timestamp: string;
}

export default function ImportResultsPage() {
  const router = useRouter();
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Get import results from localStorage
    const stored = localStorage.getItem("hypercrm_last_import");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setImportResults(parsed);
      } catch {
        // Invalid data, redirect back
        router.push("/contacts");
      }
    } else {
      // No results, redirect back
      router.push("/contacts");
    }
  }, [router]);

  const handleBackToContacts = () => {
    // Clear the stored results
    localStorage.removeItem("hypercrm_last_import");
    router.push("/contacts");
  };

  const handleExportReport = () => {
    if (!importResults) return;
    
    const csvContent = [
      ["Row", "Name", "Email", "Status", "Action", "Message"].join(","),
      ...importResults.rows.map((row) => [
        row.rowNumber,
        `"${row.name.replace(/"/g, '""')}"`,
        `"${row.email.replace(/"/g, '""')}"`,
        row.status,
        row.action,
        `"${row.message.replace(/"/g, '""')}"`,
      ].join(",")),
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!mounted || !importResults) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToContacts}
                className="hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Import Results Report
                </h1>
                <p className="text-sm text-muted-foreground">
                  {importResults.timestamp && new Date(importResults.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportReport}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export Report
              </Button>
              <Button onClick={handleBackToContacts}>
                Back to Contacts
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="relative rounded-xl bg-gradient-to-br from-slate-500/20 to-slate-600/10 border border-white/10 p-6 text-center">
            <p className="text-4xl font-bold text-slate-300">{importResults.totalRows}</p>
            <p className="text-sm font-medium text-slate-400 mt-2">Total Rows</p>
          </div>
          <div className="relative rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 p-6 text-center">
            <p className="text-4xl font-bold text-emerald-400">{importResults.successCount}</p>
            <p className="text-sm font-medium text-emerald-400/80 mt-2">Success</p>
          </div>
          <div className="relative rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 p-6 text-center">
            <p className="text-4xl font-bold text-blue-400">{importResults.createdCount}</p>
            <p className="text-sm font-medium text-blue-400/80 mt-2">Created</p>
          </div>
          <div className="relative rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 p-6 text-center">
            <p className="text-4xl font-bold text-amber-400">{importResults.updatedCount}</p>
            <p className="text-sm font-medium text-amber-400/80 mt-2">Updated</p>
          </div>
          <div className="relative rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 p-6 text-center">
            <p className="text-4xl font-bold text-red-400">{importResults.errorCount + importResults.skippedCount}</p>
            <p className="text-sm font-medium text-red-400/80 mt-2">Issues</p>
          </div>
        </div>

        {/* Results Table */}
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold">Detailed Results</h2>
            <p className="text-sm text-muted-foreground">
              {importResults.rows.length} entries processed
            </p>
          </div>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="divide-y divide-border">
              {importResults.rows.map((row, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors ${
                    row.status === "success"
                      ? "bg-emerald-500/5"
                      : row.status === "error"
                      ? "bg-red-500/5"
                      : ""
                  }`}
                >
                  {/* Status Icon */}
                  <div className="shrink-0 mt-1">
                    {row.status === "success" ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : row.status === "error" ? (
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Row {row.rowNumber}
                      </span>
                      <span className="font-medium">{row.name}</span>
                      <span className="text-sm text-muted-foreground">({row.email})</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          row.action === "created"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : row.action === "updated"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : row.action === "failed"
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                        }`}
                      >
                        {row.action === "created" && "🆕 Created"}
                        {row.action === "updated" && "📝 Updated"}
                        {row.action === "failed" && "❌ Failed"}
                        {row.action === "skipped" && "⏭️ Skipped"}
                      </Badge>
                    </div>
                    <p className={`text-sm ${
                      row.status === "error"
                        ? "text-red-400"
                        : row.status === "success"
                        ? "text-emerald-400/90"
                        : "text-muted-foreground"
                    }`}>
                      {row.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            <span className="text-emerald-400 font-medium">{importResults.successCount}</span> succeeded,{" "}
            <span className={importResults.errorCount > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}>
              {importResults.errorCount}
            </span> failed,{" "}
            <span className="text-slate-400 font-medium">{importResults.skippedCount}</span> skipped
          </div>
          <Button onClick={handleBackToContacts} size="lg">
            Back to Contacts
          </Button>
        </div>
      </div>
    </div>
  );
}
