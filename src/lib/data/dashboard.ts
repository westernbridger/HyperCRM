"use client";

import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "hypercrm_dashboard_layouts";

export interface WidgetLayout {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  // Additional config per widget type
  config?: Record<string, any>;
}

export interface DashboardLayout {
  id: string;
  user_id: string;
  widgets: WidgetLayout[];
  created_at: string;
  updated_at: string;
}

// Get layouts (Supabase if logged in, localStorage fallback)
export async function getDashboardLayouts(): Promise<WidgetLayout[]> {
  const supabase = createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Check if user has a workspace selected
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined;
    
    if (!workspaceId) {
      console.log("User has no workspace, using localStorage only");
    } else {
      // Try to get from Supabase for current workspace
      const { data, error } = await supabase
        .from("dashboard_layouts")
        .select("widgets")
        .eq("user_id", user.id)
        .eq("workspace_id", workspaceId)
        .maybeSingle<{ widgets: WidgetLayout[] }>();

      if (error) {
        console.log("No saved layout in database, checking localStorage...");
        // Fall back to localStorage if no database record
      } else if (data?.widgets) {
        console.log("Loaded dashboard layouts from database");
        return data.widgets;
      }
    }
  }
  
  // Fallback to localStorage
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
  }
  
  return [];
}

// Save layouts (Supabase if logged in, localStorage fallback)
export async function saveDashboardLayouts(widgets: WidgetLayout[]): Promise<boolean> {
  const supabase = createClient();
  
  // Always save to localStorage as backup
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.log("Saved dashboard layouts to localStorage (not logged in)");
    return true;
  }
  
  try {
    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined;

    if (!workspaceId) {
      console.log("User has no workspace selected, skipping database save");
      return true;
    }

    // The table has UNIQUE(user_id, workspace_id) — one row per user per workspace.
    // Check if a row already exists for this specific user+workspace pair.
    const { data: existing } = await supabase
      .from("dashboard_layouts")
      .select("id")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle<{ id: string }>();

    let error;
    if (existing) {
      // Row exists for this workspace — update it
      const { error: updateError } = await supabase
        .from("dashboard_layouts")
        // @ts-ignore - Database types are correct, IDE type resolution issue
        .update({ widgets, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("workspace_id", workspaceId);
      error = updateError;
    } else {
      // No row yet — insert fresh
      const { error: insertError } = await supabase
        .from("dashboard_layouts")
        // @ts-ignore - Database types are correct, IDE type resolution issue
        .insert({
          // @ts-ignore
          user_id: user.id,
          workspace_id: workspaceId,
          widgets,
          updated_at: new Date().toISOString(),
        });
      error = insertError;
    }

    if (error) {
      console.error("Error saving dashboard layouts:", error.message, error.details);
      return false;
    }
    
    console.log("Saved dashboard layouts to database");
    return true;
  } catch (err) {
    console.error("Exception saving dashboard layouts:", err);
    return false;
  }
}
