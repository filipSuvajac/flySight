import { readFileSync } from "node:fs";
import { query } from "./db.js";

interface ScrapedBird {
  name?: string;
  latinName?: string;
  latin_name?: string;
  description?: string;
  imageUrl?: string;
  image_url?: string;
}

interface ScrapedFamily {
  slug?: string;
  name?: string;
  latinName?: string;
  latin_name?: string;
  birds?: ScrapedBird[];
}

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
      user_id integer references users(id) on delete cascade,
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

    create table if not exists user_profiles (
      user_id integer primary key references users(id) on delete cascade,
      bio text not null default '',
      location text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table observation add column if not exists user_id integer references users(id) on delete cascade;

    create or replace function set_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql;
  `);

  for (const table of ["users", "bird_family", "bird_info", "location", "observation", "data_source_settings", "user_profiles"]) {
    await query(`
      drop trigger if exists ${table}_updated_at on ${table};
      create trigger ${table}_updated_at
      before update on ${table}
      for each row execute procedure set_updated_at();
    `);
  }

  await seedDemoData();
  await seedBirdsFromCatalog();
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

async function seedBirdsFromCatalog() {
  try {
    const countResult = await query<{ count: number }>("select count(*)::int as count from bird_info");
    if (Number(countResult.rows[0]?.count ?? 0) > 0) {
      return;
    }

    console.log("Seeding bird database from ptice_slovenije.json...");
    const filePath = new URL("../../composeApp/ptice_slovenije.json", import.meta.url);
    const fileContent = readFileSync(filePath, "utf8");
    const families = JSON.parse(fileContent) as ScrapedFamily[];

    for (const family of families) {
      const slug = String(family.slug ?? "").trim();
      if (!slug) continue;

      const familyResult = await query<{ id: number }>(
        `insert into bird_family (name, latin_name, slug, metadata)
         values ($1, $2, $3, $4)
         on conflict (slug) do update
         set name = excluded.name, latin_name = excluded.latin_name
         returning id`,
        [
          String(family.name ?? slug),
          String(family.latinName ?? family.latin_name ?? ""),
          slug,
          { source: "DOPPS" }
        ]
      );

      const familyId = familyResult.rows[0].id;

      for (const bird of family.birds ?? []) {
        const name = String(bird.name ?? "").trim();
        const latinName = String(bird.latinName ?? bird.latin_name ?? "").trim();
        if (!name) continue;

        await query(
          `insert into bird_info (family_id, name, latin_name, description, image_url, source, metadata)
           values ($1, $2, $3, $4, $5, 'DOPPS', $6)
           on conflict (name, latin_name) do nothing`,
          [
            familyId,
            name,
            latinName,
            String(bird.description ?? ""),
            String(bird.imageUrl ?? bird.image_url ?? ""),
            { familySlug: slug }
          ]
        );
      }
    }
    console.log("Bird seeding complete!");
  } catch (error) {
    console.warn("Could not seed bird database from ptice_slovenije.json:", error);
  }
}
