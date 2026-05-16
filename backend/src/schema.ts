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

    create or replace function set_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql;
  `);

  for (const table of ["users", "bird_family", "bird_info", "location", "observation"]) {
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
    insert into bird_family (id, name, latin_name, slug)
    values
      (1, 'Brglezi', 'Sittidae', 'brglezi'),
      (2, 'Drozgi', 'Turdidae', 'drozgi')
    on conflict (id) do nothing;

    insert into bird_info (id, family_id, name, latin_name, description, image_url, source)
    values
      (1, 1, 'Brglez', 'Sitta europaea', 'Ptica iz skupine brglezov.', '', 'seed'),
      (2, 2, 'Kos', 'Turdus merula', 'Pogosta ptica v Sloveniji.', '', 'seed')
    on conflict (id) do nothing;

    insert into location (id, name, latitude, longitude)
    values
      (1, 'Maribor', 46.55, 15.65),
      (2, 'Ljubljana', 46.05, 14.51)
    on conflict (id) do nothing;

    insert into observation (id, bird_id, location_id, observed_count, event_date, source)
    values
      (1, 1, 1, 3, '2026-05-02', 'seed'),
      (2, 2, 2, 5, '2026-05-01', 'seed')
    on conflict (id) do nothing;

    select setval(pg_get_serial_sequence('bird_family', 'id'), greatest((select max(id) from bird_family), 1));
    select setval(pg_get_serial_sequence('bird_info', 'id'), greatest((select max(id) from bird_info), 1));
    select setval(pg_get_serial_sequence('location', 'id'), greatest((select max(id) from location), 1));
    select setval(pg_get_serial_sequence('observation', 'id'), greatest((select max(id) from observation), 1));
  `);
}
