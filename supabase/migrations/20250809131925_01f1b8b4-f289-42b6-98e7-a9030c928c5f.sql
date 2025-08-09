-- Create rooms and playback_state tables with RLS and triggers
-- This migration aligns with existing hooks/useRoom.ts and hooks/useRealtimeSync.ts

-- Enable required extensions
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- Rooms table
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Room',
  creator_id uuid not null,
  partner_id uuid,
  status text not null default 'active',
  is_private boolean not null default false,
  room_code text not null unique default public.generate_room_code(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on rooms
alter table public.rooms enable row level security;

-- Policies for rooms
-- Allow authenticated users to read rooms (needed to join by code)
create policy if not exists "Rooms selectable by authenticated users"
  on public.rooms for select
  using (auth.role() = 'authenticated');

-- Allow users to create their own rooms
create policy if not exists "Users can create their own rooms"
  on public.rooms for insert
  with check (auth.uid() = creator_id);

-- Allow creators to update their rooms
create policy if not exists "Creator can update their room"
  on public.rooms for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

-- Allow users to join as partner when room is open (only setting partner_id to themselves)
create policy if not exists "Users can join as partner when open"
  on public.rooms for update
  using (true)
  with check (
    partner_id is null and auth.uid() = partner_id
  );

-- Allow creators to delete their rooms
create policy if not exists "Creator can delete their room"
  on public.rooms for delete
  using (auth.uid() = creator_id);

-- Trigger to auto-update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger if not exists trg_rooms_updated_at
before update on public.rooms
for each row execute function public.update_updated_at_column();

-- Playback state table (one row per room)
create table if not exists public.playback_state (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  media_id text,
  current_time_seconds numeric not null default 0,
  is_playing boolean not null default false,
  last_updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id)
);

-- Index for faster lookups
create index if not exists idx_playback_state_room_id on public.playback_state(room_id);

-- Enable RLS on playback_state
alter table public.playback_state enable row level security;

-- Policies for playback_state
-- Allow authenticated users to read playback state
create policy if not exists "Playback state selectable by authenticated users"
  on public.playback_state for select
  using (auth.role() = 'authenticated');

-- Allow authenticated users to create initial playback state
create policy if not exists "Authenticated users can insert playback state"
  on public.playback_state for insert
  with check (auth.role() = 'authenticated');

-- Allow authenticated users to update playback state
create policy if not exists "Authenticated users can update playback state"
  on public.playback_state for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Trigger to auto-update updated_at
create trigger if not exists trg_playback_state_updated_at
before update on public.playback_state
for each row execute function public.update_updated_at_column();