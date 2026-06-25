// Lightweight liquid-style template engine for email personalization.
// Supports {{contact.first_name}}, {{contact.custom_fields.field_name}},
// {{workspace.name}}, and {{var | default: "fallback"}} syntax.

export type TemplateContext = {
  contact: {
    first_name: string
    last_name: string
    email: string
    phone: string | null
    company: string | null
    status: string
    custom_fields: Record<string, any>
  }
  workspace: {
    name: string
  }
}

// Available variables for the UI picker.
export const TEMPLATE_VARIABLES: {
  group: string
  items: { label: string; token: string }[]
}[] = [
  {
    group: "Contact",
    items: [
      { label: "First Name", token: "{{contact.first_name}}" },
      { label: "Last Name", token: "{{contact.last_name}}" },
      { label: "Email", token: "{{contact.email}}" },
      { label: "Phone", token: "{{contact.phone}}" },
      { label: "Company", token: "{{contact.company}}" },
      { label: "Status", token: "{{contact.status}}" },
    ],
  },
  {
    group: "Workspace",
    items: [{ label: "Workspace Name", token: "{{workspace.name}}" }],
  },
]

// Resolve a single {{ ... }} expression.
function resolveExpression(expr: string, ctx: TemplateContext): string {
  // Check for default filter: {{ var | default: "fallback" }}
  const defaultMatch = expr.match(/^\s*([\w.]+)\s*\|\s*default:\s*["']?([^"']*)["']?\s*$/)
  const path = defaultMatch ? defaultMatch[1].trim() : expr.trim()
  const fallback = defaultMatch ? defaultMatch[2] : ""

  const value = resolvePath(path, ctx)
  if (value === null || value === undefined || value === "") return fallback
  return String(value)
}

// Resolve a dotted path like "contact.first_name" or "contact.custom_fields.company_size".
export function resolvePath(path: string, ctx: TemplateContext): any {
  const parts = path.split(".")
  let current: any = ctx

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== "object") return undefined
    current = current[part]
  }

  return current
}

// Resolve all {{ ... }} expressions in a template string.
export function resolveTemplate(template: string, ctx: TemplateContext): string {
  if (!template) return ""
  return template.replace(/\{\{([^}]*)\}\}/g, (_match, expr: string) => resolveExpression(expr, ctx))
}

// Check if a template contains any liquid variables.
export function hasTemplateVariables(text: string): boolean {
  return /\{\{[^}]+\}\}/.test(text)
}

// Extract all variable paths used in a template (for validation / preview).
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{\s*([\w.]+)\s*(?:\|[^}]*)?\}\}/g)
  return Array.from(matches, (m) => m[1])
}
