-- HyperForms: theming, layout, branding + asset storage
-- Run this AFTER hyperforms.sql

set search_path to public;

-- ── New columns on hyperforms ────────────────────────────────────────────────
-- theme    : colors, font, radius, button style
-- layout   : 'card' | 'single-page' | 'multi-step'
-- branding : logo/cover/background image URLs + submit button text, etc.

alter table hyperforms
  add column if not exists theme jsonb not null default '{
    "primaryColor": "#6366f1",
    "backgroundColor": "#0b0b12",
    "textColor": "#f4f4f5",
    "fontFamily": "Inter",
    "borderRadius": "lg",
    "buttonStyle": "solid"
  }'::jsonb;

alter table hyperforms
  add column if not exists layout text not null default 'card'
    check (layout in ('card', 'single-page', 'multi-step'));

alter table hyperforms
  add column if not exists branding jsonb not null default '{
    "logoUrl": null,
    "coverUrl": null,
    "backgroundUrl": null,
    "submitText": "Submit",
    "successTitle": "Thank you!",
    "successMessage": "Your response has been submitted. We will be in touch soon.",
    "showBadge": true
  }'::jsonb;

-- ── Storage bucket for uploaded form assets (logos, covers, backgrounds) ──────
-- Public bucket so embedded/public forms can render the images without auth.
insert into storage.buckets (id, name, public)
values ('form-assets', 'form-assets', true)
on conflict (id) do nothing;

-- Anyone can read assets (public forms)
drop policy if exists "public read form-assets" on storage.objects;
create policy "public read form-assets"
  on storage.objects for select
  using (bucket_id = 'form-assets');

-- Authenticated workspace members can upload assets
drop policy if exists "authenticated upload form-assets" on storage.objects;
create policy "authenticated upload form-assets"
  on storage.objects for insert
  with check (bucket_id = 'form-assets' and auth.role() = 'authenticated');

-- Authenticated users can update/delete their uploaded assets
drop policy if exists "authenticated update form-assets" on storage.objects;
create policy "authenticated update form-assets"
  on storage.objects for update
  using (bucket_id = 'form-assets' and auth.role() = 'authenticated');

drop policy if exists "authenticated delete form-assets" on storage.objects;
create policy "authenticated delete form-assets"
  on storage.objects for delete
  using (bucket_id = 'form-assets' and auth.role() = 'authenticated');
