"use client";

import { useState } from "react";
import { Check, Copy, Code2, Link2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmbedPanelProps {
  formId: string;
  formUrl: string;
}

export function EmbedPanel({ formId, formUrl }: EmbedPanelProps) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const embedUrl = `${origin}/forms/${formId}/embed`;

  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // Auto-resizing JS snippet — listens for height messages from the iframe.
  const scriptSnippet = `<div id="hypercrm-form-${formId}"></div>
<script>
(function () {
  var c = document.getElementById("hypercrm-form-${formId}");
  var f = document.createElement("iframe");
  f.src = "${embedUrl}";
  f.style.width = "100%";
  f.style.border = "0";
  f.style.minHeight = "500px";
  f.setAttribute("title", "HyperCRM Form");
  c.appendChild(f);
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "hypercrm-form-resize" && e.data.formId === "${formId}") {
      f.style.height = e.data.height + "px";
    }
  });
})();
</script>`;

  const iframeSnippet = `<iframe
  src="${embedUrl}"
  style="width:100%;border:0;min-height:600px;"
  title="HyperCRM Form"
></iframe>`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Embed this form on your website</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Copy a snippet and paste it into your site&apos;s HTML. The auto-resizing option keeps the
          frame height in sync with the form content.
        </p>
      </div>

      {/* Auto-resizing script (recommended) */}
      <SnippetBlock
        icon={Zap}
        title="Auto-resizing embed"
        badge="Recommended"
        description="Injects the form and automatically adjusts the height as users move through it."
        code={scriptSnippet}
        copied={copied === "script"}
        onCopy={() => copy(scriptSnippet, "script")}
      />

      {/* Plain iframe */}
      <SnippetBlock
        icon={Code2}
        title="Simple iframe"
        description="A fixed-height iframe. Use this if you can't run scripts on your site."
        code={iframeSnippet}
        copied={copied === "iframe"}
        onCopy={() => copy(iframeSnippet, "iframe")}
      />

      {/* Direct link */}
      <SnippetBlock
        icon={Link2}
        title="Direct link"
        description="Share the standalone form page directly — great for emails and social posts."
        code={formUrl}
        copied={copied === "link"}
        onCopy={() => copy(formUrl, "link")}
        inline
      />
    </div>
  );
}

function SnippetBlock({
  icon: Icon,
  title,
  badge,
  description,
  code,
  copied,
  onCopy,
  inline,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  description: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
  inline?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/10">
            <Icon className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{title}</h4>
              {badge && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onCopy} className="h-7 gap-1.5 text-xs shrink-0">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <pre
        className={cn(
          "overflow-x-auto bg-secondary/30 px-4 py-3 text-xs font-mono text-foreground/80",
          inline && "whitespace-pre-wrap break-all"
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
