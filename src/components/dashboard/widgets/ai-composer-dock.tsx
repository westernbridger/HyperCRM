"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// AI Composer Quick-Dock Widget
export function AIComposerDock() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setGenerated(true);
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-400" />
        <span className="text-sm font-medium">AI Email Composer</span>
      </div>

      {generated ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-muted p-3 space-y-2"
        >
          <p className="text-sm font-medium">Generated Template:</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Subject: Exclusive Offer for {prompt}...
            <br /><br />
            Hi {'{first_name}'},<br />
            I noticed your interest in {prompt}. I wanted to personally reach out...
          </p>
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="flex-1">
              <Send className="mr-2 h-3 w-3" />
              Use Template
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setGenerated(false); setPrompt(""); }}>
              Reset
            </Button>
          </div>
        </motion.div>
      ) : (
        <>
          <Input
            placeholder="What do you want to draft?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-muted/50"
          />
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Template
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
