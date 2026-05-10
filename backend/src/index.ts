import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { query } from "./db.js";
import { ensureSchema } from "./schema.js";
import { requireTable, sanitizeBody, tables } from "./tables.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) => {
  res.json({
    service: "FlySight API",
    status: "ok",
    endpoints: ["/health", "/api/tables", "/api/:table", "/api/import/dopps", "/api/generate/observations"]
  });
});

app.get("/health", async (_req, res, next) => {
  try {
    const db = await query<{ ok: number }>("select 1 as ok");
    res.json({ status: "ok", database: db.rows[0]?.ok === 1 ? "connected" : "unknown" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tables", (_req, res) => {
  res.json(Object.values(tables).map((table) => table.table));
});

app.get("/api/:table", async (req, res, next) => {
  try {
    const table = requireTable(req.params.table);
    const result = await query(`select * from ${table.table} order by ${table.orderBy}`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/:table", async (req, res, next) => {
  try {
    const table = requireTable(req.params.table);
    const body = sanitizeBody(req.body, table.writable);
    const keys = Object.keys(body);
    if (keys.length === 0) {
      res.status(400).json({ error: "Request body does not contain writable fields." });
      return;
    }

    const columns = keys.join(", ");
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
    const result = await query(
      `insert into ${table.table} (${columns}) values (${placeholders}) returning *`,
      keys.map((key) => body[key])
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/:table/:id", async (req, res, next) => {
  try {
    const table = requireTable(req.params.table);
    const body = sanitizeBody(req.body, table.writable);
    const keys = Object.keys(body);
    if (keys.length === 0) {
      res.status(400).json({ error: "Request body does not contain writable fields." });
      return;
    }

    const setters = keys.map((key, index) => `${key} = $${index + 1}`).join(", ");
    const result = await query(
      `update ${table.table} set ${setters} where id = $${keys.length + 1} returning *`,
      [...keys.map((key) => body[key]), req.params.id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Row not found." });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/:table/:id", async (req, res, next) => {
  try {
    const table = requireTable(req.params.table);
    const result = await query(`delete from ${table.table} where id = $1 returning id`, [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Row not found." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/import/dopps", async (req, res, next) => {
  try {
    const families = Array.isArray(req.body) ? req.body : [];
    let importedFamilies = 0;
    let importedBirds = 0;

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
      importedFamilies++;

      for (const bird of Array.isArray(family.birds) ? family.birds : []) {
        const name = String(bird.name ?? "").trim();
        const latinName = String(bird.latinName ?? bird.latin_name ?? "").trim();
        if (!name) continue;

        await query(
          `insert into bird_info (family_id, name, latin_name, description, image_url, source, metadata)
           values ($1, $2, $3, $4, $5, 'DOPPS', $6)
           on conflict (name, latin_name) do update
           set family_id = excluded.family_id,
               description = excluded.description,
               image_url = excluded.image_url,
               source = excluded.source`,
          [
            familyResult.rows[0].id,
            name,
            latinName,
            String(bird.description ?? ""),
            String(bird.imageUrl ?? bird.image_url ?? ""),
            { familySlug: slug }
          ]
        );
        importedBirds++;
      }
    }

    await query(
      "insert into import_batch (source, imported_count, metadata) values ($1, $2, $3)",
      ["DOPPS", importedBirds, { families: importedFamilies }]
    );

    res.json({ status: "ok", families: importedFamilies, birds: importedBirds });
  } catch (error) {
    next(error);
  }
});

app.post("/api/generate/observations", async (req, res, next) => {
  try {
    const count = clampNumber(req.body.count, 0, 1000, 10);
    const minObserved = clampNumber(req.body.minObserved, 0, 100000, 1);
    const maxObserved = clampNumber(req.body.maxObserved, minObserved, 100000, 12);
    const minLatitude = numberOr(req.body.minLatitude, 45.4);
    const maxLatitude = numberOr(req.body.maxLatitude, 46.9);
    const minLongitude = numberOr(req.body.minLongitude, 13.4);
    const maxLongitude = numberOr(req.body.maxLongitude, 16.6);

    await ensureGeneratedLocations(minLatitude, maxLatitude, minLongitude, maxLongitude);
    const birds = await query<{ id: number }>("select id from bird_info order by id");
    const locations = await query<{ id: number }>("select id from location order by id");

    if (birds.rows.length === 0 || locations.rows.length === 0) {
      res.status(400).json({ error: "Need at least one bird and one location before generating observations." });
      return;
    }

    for (let index = 0; index < count; index++) {
      const bird = pick(birds.rows);
      const location = pick(locations.rows);
      const observedCount = randomInt(minObserved, maxObserved);
      const daysAgo = randomInt(0, 365);
      await query(
        `insert into observation (bird_id, location_id, observed_count, event_date, source, metadata)
         values ($1, $2, $3, current_date - ($4::int), 'generated', $5)`,
        [bird.id, location.id, observedCount, daysAgo, { generator: "desktop" }]
      );
    }

    res.json({ status: "ok", generated: count });
  } catch (error) {
    next(error);
  }
});

app.get("/api/observations/near", async (req, res, next) => {
  try {
    const latitude = numberOr(req.query.lat, 46.05);
    const longitude = numberOr(req.query.lon, 14.51);
    const radiusKm = clampNumber(req.query.radiusKm, 1, 500, 25);

    const result = await query(
      `select o.*, l.name as location_name, b.name as bird_name,
              6371 * acos(
                cos(radians($1)) * cos(radians(l.latitude)) *
                cos(radians(l.longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(l.latitude))
              ) as distance_km
       from observation o
       join location l on l.id = o.location_id
       join bird_info b on b.id = o.bird_id
       where 6371 * acos(
         cos(radians($1)) * cos(radians(l.latitude)) *
         cos(radians(l.longitude) - radians($2)) +
         sin(radians($1)) * sin(radians(l.latitude))
       ) <= $3
       order by distance_km asc`,
      [latitude, longitude, radiusKm]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const statusCode = typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode: unknown }).statusCode)
    : 500;
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(statusCode || 500).json({ error: message });
});

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`FlySight API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not initialize database schema", error);
    process.exit(1);
  });

function numberOr(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return Math.max(min, Math.min(max, Math.round(numberOr(value, fallback))));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]) {
  return items[randomInt(0, items.length - 1)];
}

async function ensureGeneratedLocations(
  minLatitude: number,
  maxLatitude: number,
  minLongitude: number,
  maxLongitude: number
) {
  const existing = await query<{ count: number }>("select count(*)::int as count from location");
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  for (let index = 0; index < 3; index++) {
    await query(
      "insert into location (name, latitude, longitude, metadata) values ($1, $2, $3, $4)",
      [
        `Generated location ${index + 1}`,
        randomFloat(minLatitude, maxLatitude),
        randomFloat(minLongitude, maxLongitude),
        { generator: "backend" }
      ]
    );
  }
}

function randomFloat(a: number, b: number) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return min + Math.random() * (max - min);
}
