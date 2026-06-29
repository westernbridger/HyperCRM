import type { SegmentOperator } from '@/app/actions/segments'

export const SEGMENT_FIELDS: { key: string; label: string; type: 'text' | 'select' }[] = [
  { key: 'first_name', label: 'First Name', type: 'text' },
  { key: 'last_name', label: 'Last Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'status', label: 'Status', type: 'select' },
]

export const SEGMENT_OPERATORS: { key: SegmentOperator; label: string; needsValue: boolean }[] = [
  { key: 'equals', label: 'is equal to', needsValue: true },
  { key: 'not_equals', label: 'is not equal to', needsValue: true },
  { key: 'contains', label: 'contains', needsValue: true },
  { key: 'not_contains', label: 'does not contain', needsValue: true },
  { key: 'begins_with', label: 'begins with', needsValue: true },
  { key: 'ends_with', label: 'ends with', needsValue: true },
  { key: 'is_empty', label: 'is empty', needsValue: false },
  { key: 'is_not_empty', label: 'is not empty', needsValue: false },
]
