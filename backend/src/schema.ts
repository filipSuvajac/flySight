import { query } from "./db.js";

export async function ensureSchema() {
  await query(`
    create table if not exists users (
      id serial primary key,
      email text unique not null,
      name text not null,
      password_hash text not null,
      role text not null default 'user',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists bird_family (
      id serial primary key,
      name text not null,
      latin_name text not null default '',
      slug text unique not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists bird_info (
      id serial primary key,
      family_id integer references bird_family(id) on delete set null,
      name text not null,
      latin_name text not null default '',
      description text not null default '',
      image_url text not null default '',
      source text not null default 'manual',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (name, latin_name)
    );

    create table if not exists location (
      id serial primary key,
      name text not null,
      latitude double precision not null,
      longitude double precision not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists observation (
      id serial primary key,
      bird_id integer references bird_info(id) on delete cascade,
      location_id integer references location(id) on delete cascade,
      observed_count integer not null default 1 check (observed_count >= 0),
      event_date date not null,
      source text not null default 'manual',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists import_batch (
      id serial primary key,
      source text not null,
      imported_count integer not null default 0,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists data_source_settings (
      key text primary key,
      name text not null,
      enabled boolean not null default true,
      region text not null default 'SI',
      max_results integer not null default 500 check (max_results > 0),
      recent_days integer not null default 30 check (recent_days > 0),
      settings jsonb not null default '{}'::jsonb,
      last_sync timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create or replace function set_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql;
  `);

  for (const table of ["users", "bird_family", "bird_info", "location", "observation", "data_source_settings"]) {
    await query(`
      drop trigger if exists ${table}_updated_at on ${table};
      create trigger ${table}_updated_at
      before update on ${table}
      for each row execute procedure set_updated_at();
    `);
  }

  await seedDemoData();
}

async function seedDemoData() {
  await query(`
    insert into data_source_settings (key, name, enabled, region, max_results, recent_days, settings)
    values
      ('ebird', 'eBird API', true, 'SI', 500, 30, '{"description":"Recent observations and hotspots from eBird"}'::jsonb),
      ('dopps', 'DOPPS scraper', true, 'SI', 500, 30, '{"description":"Scraped Slovenian bird catalogue"}'::jsonb),
      ('generated', 'Generated data', true, 'SI', 100, 365, '{"description":"Synthetic observations for demos"}'::jsonb),
      ('cityinfra', 'CityInfra GeoJSON', true, 'SI', 100, 30, '{"description":"GeoJSON exported from the CityInfra DSL"}'::jsonb)
    on conflict (key) do nothing;
  `);
}
