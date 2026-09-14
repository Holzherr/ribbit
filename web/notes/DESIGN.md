---
name: Ribbit Notes
description: A notes window that stays out of the way during a call. Near-white canvas, slate ink, one green for the primary action, red only for recording and failure states. Dense rows, system font, tabular timestamps.
colors:
  brand: '#1f9d55'
  brand-hover: '#17803f'
  brand-soft: '#e9f7ee'
  brand-ink: '#14683a'
  ink: '#0f172a'
  body: '#475569'
  muted: '#64748b'
  faint: '#94a3b8'
  line: '#e2e8f0'
  line-soft: '#f1f5f9'
  surface: '#ffffff'
  canvas: '#f8fafc'
  well: '#eef2f7'
  rec: '#dc2626'
  rec-soft: '#fee2e2'
  danger: '#b91c1c'
  warn: '#b45309'
  warn-soft: '#fffbeb'
typography:
  title: { fontSize: '17px', fontWeight: 700, lineHeight: 1.2 }
  row-name: { fontSize: '14px', fontWeight: 600 }
  body: { fontSize: '14px', lineHeight: 1.5 }
  label: { fontSize: '12px', color: '{colors.muted}' }
  timestamp: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: '{colors.faint}' }
rounded: { card: '12px', control: '8px', pill: '999px' }
spacing: { row-pad: '10px 12px', screen-pad: '16px', sidebar: '280px', window-min: '720x480', window-default: '960x640' }
rules:
  - One brand-filled button per screen (Start / Stop / Enhance).
  - White text on brand uses brand-hover (#17803f) for AA contrast.
  - rec family (rec, rec-soft) is for recording and failure states only.
  - Speaker chips are outlined, tinted by speaker index (me = brand, s1 = sky, s2 = violet, s3 = amber, s4+ = slate).
---
