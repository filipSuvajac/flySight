import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcrypt";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { WebSocket, WebSocketServer } from "ws";
import { requireAuth, signToken, verifyToken } from "./auth.js";
import { query } from "./db.js";
import { ensureSchema } from "./schema.js";
import { requireTable, sanitizeBody, tables } from "./tables.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS."));
  }
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX ?? 300),
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) => {
  res.json({
    service: "FlySight API",
    status: "ok",
    endpoints: [
      "/health",
      "/auth/register",
      "/auth/login",
      "/auth/me",
      "/api/tables",
      "/api/visualization/observations",
      "/api/visualization/summary",
      "/api/data-sources",
      "/api/:table",
      "/api/import/dopps",
      "/api/generate/observations",
      "/api/ebird/recent",
      "/api/ebird/hotspots",
      "/ws/ebird"
    ]
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

app.post("/auth/register", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = normalizeText(req.body.name);
    const password = String(req.body.password ?? "");

    if (!email || !name || password.length < 8) {
      res.status(400).json({ error: "Email, name and password with at least 8 characters are required." });
      return;
    }

    const existing = await query<{ id: number }>("select id from users where email = $1", [email]);
    if (existing.rowCount) {
      res.status(409).json({ error: "User with this email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query<{ id: number; email: string; name: string; role: string }>(
      "insert into users (email, name, password_hash) values ($1, $2, $3) returning id, email, name, role",
      [email, name, passwordHash]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password ?? "");

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const result = await query<{ id: number; email: string; name: string; role: string; password_hash: string }>(
      "select id, email, name, role, password_hash from users where email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const { password_hash: _passwordHash, ...publicUser } = user;
    const token = signToken(publicUser);
    res.json({ user: publicUser, token });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/visualization/observations", requireAuth, async (req, res, next) => {
  try {
    const filters = buildVisualizationFilters(req.query);
    const limit = clampNumber(req.query.limit, 1, 5000, 1000);
    const result = await query<VisualizationObservationRow>(
      `select
         o.id as "observationId",
         o.observed_count as "observedCount",
         o.event_date::text as "eventDate",
         o.source,
         o.metadata,
         b.id as "birdId",
         b.name as "speciesName",
         b.latin_name as "scientificName",
         b.image_url as "imageUrl",
         f.name as "familyName",
         f.latin_name as "familyLatinName",
         l.id as "locationId",
         l.name as "locationName",
         l.latitude,
         l.longitude
       from observation o
       join bird_info b on b.id = o.bird_id
       left join bird_family f on f.id = b.family_id
       join location l on l.id = o.location_id
       ${filters.whereClause}
       order by o.event_date desc, o.id desc
       limit $${filters.params.length + 1}`,
      [...filters.params, limit]
    );

    res.json({ observations: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/visualization/summary", requireAuth, async (req, res, next) => {
  try {
    const filters = buildVisualizationFilters(req.query);
    const species = await query<ChartCountRow>(
      `select
         b.name as label,
         count(*)::int as observations,
         coalesce(sum(o.observed_count), 0)::int as "totalCount"
       from observation o
       join bird_info b on b.id = o.bird_id
       left join bird_family f on f.id = b.family_id
       join location l on l.id = o.location_id
       ${filters.whereClause}
       group by b.name
       order by observations desc, b.name asc
       limit 15`,
      filters.params
    );
    const timeline = await query<TimelineRow>(
      `select
         o.event_date::text as date,
         count(*)::int as observations,
         coalesce(sum(o.observed_count), 0)::int as "totalCount"
       from observation o
       join bird_info b on b.id = o.bird_id
       left join bird_family f on f.id = b.family_id
       join location l on l.id = o.location_id
       ${filters.whereClause}
       group by o.event_date
       order by o.event_date asc`,
      filters.params
    );
    const locations = await query<LocationSummaryRow>(
      `select
         l.id as "locationId",
         l.name as label,
         l.latitude,
         l.longitude,
         count(*)::int as observations,
         coalesce(sum(o.observed_count), 0)::int as "totalCount"
       from observation o
       join bird_info b on b.id = o.bird_id
       left join bird_family f on f.id = b.family_id
       join location l on l.id = o.location_id
       ${filters.whereClause}
       group by l.id, l.name, l.latitude, l.longitude
       order by observations desc, l.name asc
       limit 15`,
      filters.params
    );
    const sources = await query<ChartCountRow>(
      `select
         o.source as label,
         count(*)::int as observations,
         coalesce(sum(o.observed_count), 0)::int as "totalCount"
       from observation o
       join bird_info b on b.id = o.bird_id
       left join bird_family f on f.id = b.family_id
       join location l on l.id = o.location_id
       ${filters.whereClause}
       group by o.source
       order by observations desc, o.source asc`,
      filters.params
    );

    res.json({
      species: species.rows,
      timeline: timeline.rows,
      locations: locations.rows,
      sources: sources.rows
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/data-sources", requireAuth, async (_req, res, next) => {
  try {
    const result = await query<DataSourceSettingsRow>(
      `select
         key,
         name,
         enabled,
         region,
         max_results as "maxResults",
         recent_days as "recentDays",
         settings,
         last_sync as "lastSync",
         updated_at as "updatedAt"
       from data_source_settings
       order by key`
    );
    res.json({ sources: result.rows });
  } catch (error) {
    next(error);
  }
});

app.put("/api/data-sources/:key", requireAuth, async (req, res, next) => {
  try {
    const key = normalizeDataSourceKey(firstParam(req.params.key));
    const existing = await query<DataSourceSettingsRow>(
      `select
         key,
         name,
         enabled,
         region,
         max_results as "maxResults",
         recent_days as "recentDays",
         settings,
         last_sync as "lastSync",
         updated_at as "updatedAt"
       from data_source_settings
       where key = $1`,
      [key]
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ error: `Unknown data source '${key}'.` });
      return;
    }

    const updates = dataSourceUpdates(req.body);
    if (updates.fields.length === 0) {
      res.json(existing.rows[0]);
      return;
    }

    const setters = updates.fields.map((field, index) => `${field} = $${index + 2}`).join(", ");
    const result = await query<DataSourceSettingsRow>(
      `update data_source_settings
       set ${setters}
       where key = $1
       returning
         key,
         name,
         enabled,
         region,
         max_results as "maxResults",
         recent_days as "recentDays",
         settings,
         last_sync as "lastSync",
         updated_at as "updatedAt"`,
      [key, ...updates.values]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/:table", requireAuth, async (req, res, next) => {
  try {
    const table = requireTable(firstParam(req.params.table));
    const result = await query(`select * from ${table.table} order by ${table.orderBy}`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/:table", requireAuth, async (req, res, next) => {
  try {
    const table = requireTable(firstParam(req.params.table));
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

app.put("/api/:table/:id", requireAuth, async (req, res, next) => {
  try {
    const table = requireTable(firstParam(req.params.table));
    const body = sanitizeBody(req.body, table.writable);
    const keys = Object.keys(body);
    if (keys.length === 0) {
      res.status(400).json({ error: "Request body does not contain writable fields." });
      return;
    }

    const setters = keys.map((key, index) => `${key} = $${index + 1}`).join(", ");
    const result = await query(
      `update ${table.table} set ${setters} where id = $${keys.length + 1} returning *`,
      [...keys.map((key) => body[key]), firstParam(req.params.id)]
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

app.delete("/api/:table/:id", requireAuth, async (req, res, next) => {
  try {
    const table = requireTable(firstParam(req.params.table));
    const result = await query(`delete from ${table.table} where id = $1 returning id`, [firstParam(req.params.id)]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Row not found." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/import/dopps", requireAuth, async (req, res, next) => {
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

app.post("/api/generate/observations", requireAuth, async (req, res, next) => {
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

app.get("/api/observations/near", requireAuth, async (req, res, next) => {
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

app.get("/api/ebird/recent", requireAuth, async (req, res, next) => {
  try {
    const days = clampNumber(req.query.days, 1, 30, 30);
    const maxResults = clampNumber(req.query.maxResults, 1, 10000, defaultEbirdMaxResults());
    const observations = await fetchSloveniaEbirdObservations({ days, maxResults });
    res.json({ regionCode: "SI", days, observations });
  } catch (error) {
    next(error);
  }
});

app.get("/api/ebird/hotspots", requireAuth, async (_req, res, next) => {
  try {
    const hotspots = await fetchSloveniaEbirdHotspots();
    res.json({ regionCode: "SI", hotspots });
  } catch (error) {
    next(error);
  }
});

app.get("/api/ebird/hotspots/:locId/recent", requireAuth, async (req, res, next) => {
  try {
    const days = clampNumber(req.query.days, 1, 30, 30);
    const maxResults = clampNumber(req.query.maxResults, 1, 10000, defaultEbirdMaxResults());
    const locId = firstParam(req.params.locId);
    const observations = await fetchEbirdHotspotObservations(locId, { days, maxResults });
    res.json({ locId, days, observations });
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
    const server = app.listen(port, () => {
      console.log(`FlySight API running on http://localhost:${port}`);
    });
    attachEbirdWebSocket(server);
  })
  .catch((error) => {
    console.error("Could not initialize database schema", error);
    process.exit(1);
  });

type EbirdApiObservation = {
  speciesCode?: string;
  comName?: string;
  sciName?: string;
  locName?: string;
  obsDt?: string;
  howMany?: number;
  lat?: number;
  lng?: number;
  subnational1Name?: string;
  subnational2Name?: string;
  obsValid?: boolean;
  obsReviewed?: boolean;
};

type EbirdApiHotspot = {
  locId?: string;
  locName?: string;
  countryCode?: string;
  subnational1Code?: string;
  subnational2Code?: string;
  lat?: number;
  lng?: number;
  latestObsDt?: string;
  numSpeciesAllTime?: number;
};

type EbirdObservation = {
  id: string;
  speciesCode: string;
  commonName: string;
  slovenianName: string;
  imageUrl: string;
  scientificName: string;
  locationName: string;
  city: string;
  observedAt: string;
  count: number | null;
  latitude: number | null;
  longitude: number | null;
  region: string;
  valid: boolean;
  reviewed: boolean;
};

type EbirdHotspot = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  countryCode: string;
  subnational1Code: string;
  subnational2Code: string;
  latestObservationDate: string;
  speciesAllTime: number | null;
};

type VisualizationObservationRow = {
  observationId: number;
  observedCount: number;
  eventDate: string;
  source: string;
  metadata: Record<string, unknown>;
  birdId: number;
  speciesName: string;
  scientificName: string;
  imageUrl: string;
  familyName: string | null;
  familyLatinName: string | null;
  locationId: number;
  locationName: string;
  latitude: number;
  longitude: number;
};

type ChartCountRow = {
  label: string;
  observations: number;
  totalCount: number;
};

type TimelineRow = {
  date: string;
  observations: number;
  totalCount: number;
};

type LocationSummaryRow = ChartCountRow & {
  locationId: number;
  latitude: number;
  longitude: number;
};

type DataSourceSettingsRow = {
  key: string;
  name: string;
  enabled: boolean;
  region: string;
  maxResults: number;
  recentDays: number;
  settings: Record<string, unknown>;
  lastSync: string | null;
  updatedAt: string;
};

type SlovenianBirdFamily = {
  birds?: Array<{
    name?: string;
    latinName?: string;
    imageUrl?: string;
    image_url?: string;
  }>;
};

type SlovenianBirdProfile = {
  name: string;
  imageUrl: string;
};

const slovenianBirdProfiles = loadSlovenianBirdProfiles();

function attachEbirdWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/ebird" });

  wss.on("connection", (socket, request) => {
    const token = readTokenFromRequest(request.url);
    if (!token) {
      closeSocket(socket, "Missing token.");
      return;
    }

    try {
      verifyToken(token);
    } catch {
      closeSocket(socket, "Invalid or expired token.");
      return;
    }

    void sendEbirdObservations(socket);

    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as { type?: string; days?: number; maxResults?: number };
        if (message.type === "refresh") {
          void sendEbirdObservations(socket, {
            days: clampNumber(message.days, 1, 30, 30),
            maxResults: clampNumber(message.maxResults, 1, 10000, defaultEbirdMaxResults())
          });
        }
      } catch {
        sendSocketJson(socket, { type: "error", error: "Unsupported WebSocket message." });
      }
    });
  });
}

function readTokenFromRequest(requestUrl: string | undefined) {
  if (!requestUrl) return "";
  const url = new URL(requestUrl, "http://localhost");
  return url.searchParams.get("token") ?? "";
}

function closeSocket(socket: WebSocket, reason: string) {
  sendSocketJson(socket, { type: "error", error: reason });
  socket.close(1008, reason);
}

type EbirdRecentOptions = {
  days: number;
  maxResults: number;
};

async function sendEbirdObservations(
  socket: WebSocket,
  options: EbirdRecentOptions = { days: 30, maxResults: defaultEbirdMaxResults() }
) {
  try {
    sendSocketJson(socket, { type: "loading" });
    const observations = await fetchSloveniaEbirdObservations(options);
    sendSocketJson(socket, {
      type: "observations",
      regionCode: "SI",
      days: options.days,
      receivedAt: new Date().toISOString(),
      observations
    });
  } catch (error) {
    sendSocketJson(socket, {
      type: "error",
      error: error instanceof Error ? error.message : "Could not load eBird observations."
    });
  }
}

async function fetchSloveniaEbirdObservations(options: EbirdRecentOptions): Promise<EbirdObservation[]> {
  const url = new URL("https://api.ebird.org/v2/data/obs/SI/recent");
  url.searchParams.set("back", String(options.days));
  url.searchParams.set("detail", "full");
  url.searchParams.set("maxResults", String(options.maxResults));

  const response = await fetch(url, {
    headers: {
      "X-eBirdApiToken": ebirdApiKey()
    }
  });

  if (!response.ok) {
    throw new Error(`eBird API failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as EbirdApiObservation[];
  if (!Array.isArray(payload)) return [];

  return payload.map(normalizeEbirdObservation);
}

async function fetchSloveniaEbirdHotspots(): Promise<EbirdHotspot[]> {
  const url = new URL("https://api.ebird.org/v2/ref/hotspot/SI");
  url.searchParams.set("fmt", "json");

  const response = await fetch(url, {
    headers: {
      "X-eBirdApiToken": ebirdApiKey()
    }
  });

  if (!response.ok) {
    throw new Error(`eBird hotspot API failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as EbirdApiHotspot[];
  if (!Array.isArray(payload)) return [];

  return payload.map(normalizeEbirdHotspot);
}

async function fetchEbirdHotspotObservations(
  locId: string,
  options: EbirdRecentOptions
): Promise<EbirdObservation[]> {
  if (!locId.trim()) {
    throw Object.assign(new Error("Hotspot location id is required."), { statusCode: 400 });
  }

  const url = new URL(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(locId)}/recent`);
  url.searchParams.set("back", String(options.days));
  url.searchParams.set("detail", "full");
  url.searchParams.set("maxResults", String(options.maxResults));

  const response = await fetch(url, {
    headers: {
      "X-eBirdApiToken": ebirdApiKey()
    }
  });

  if (!response.ok) {
    throw new Error(`eBird hotspot observations failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as EbirdApiObservation[];
  if (!Array.isArray(payload)) return [];

  return payload.map(normalizeEbirdObservation);
}

function normalizeEbirdObservation(observation: EbirdApiObservation): EbirdObservation {
  const locationName = String(observation.locName ?? "");
  const speciesCode = String(observation.speciesCode ?? "");
  const observedAt = String(observation.obsDt ?? "");
  const birdProfile = slovenianBirdProfiles.get(normalizeScientificName(observation.sciName));

  return {
    id: `${speciesCode}-${locationName}-${observedAt}`,
    speciesCode,
    commonName: String(observation.comName ?? "Unknown species"),
    slovenianName: birdProfile?.name ?? "",
    imageUrl: birdProfile?.imageUrl ?? "",
    scientificName: String(observation.sciName ?? ""),
    locationName,
    city: String(observation.subnational2Name ?? locationName),
    observedAt,
    count: Number.isFinite(observation.howMany) ? Number(observation.howMany) : null,
    latitude: Number.isFinite(observation.lat) ? Number(observation.lat) : null,
    longitude: Number.isFinite(observation.lng) ? Number(observation.lng) : null,
    region: String(observation.subnational1Name ?? "Slovenia"),
    valid: Boolean(observation.obsValid),
    reviewed: Boolean(observation.obsReviewed)
  };
}

function normalizeEbirdHotspot(hotspot: EbirdApiHotspot): EbirdHotspot {
  return {
    id: String(hotspot.locId ?? ""),
    name: String(hotspot.locName ?? "Unknown hotspot"),
    latitude: Number.isFinite(hotspot.lat) ? Number(hotspot.lat) : null,
    longitude: Number.isFinite(hotspot.lng) ? Number(hotspot.lng) : null,
    countryCode: String(hotspot.countryCode ?? "SI"),
    subnational1Code: String(hotspot.subnational1Code ?? ""),
    subnational2Code: String(hotspot.subnational2Code ?? ""),
    latestObservationDate: String(hotspot.latestObsDt ?? ""),
    speciesAllTime: Number.isFinite(hotspot.numSpeciesAllTime) ? Number(hotspot.numSpeciesAllTime) : null
  };
}

function ebirdApiKey() {
  const apiKey = process.env.EBIRD_API_KEY;
  if (!apiKey) {
    throw new Error("EBIRD_API_KEY is not configured on the backend.");
  }
  return apiKey;
}

function defaultEbirdMaxResults() {
  return clampNumber(process.env.EBIRD_MAX_RESULTS, 1, 10000, 500);
}

function loadSlovenianBirdProfiles() {
  const profiles = new Map<string, SlovenianBirdProfile>();

  try {
    const file = readFileSync(new URL("../../composeApp/ptice_slovenije.json", import.meta.url), "utf8");
    const families = JSON.parse(file) as SlovenianBirdFamily[];

    for (const family of families) {
      for (const bird of family.birds ?? []) {
        const latinName = normalizeScientificName(bird.latinName);
        const slovenianName = String(bird.name ?? "").trim();
        const imageUrl = String(bird.imageUrl ?? bird.image_url ?? "").trim();
        if (latinName && slovenianName) {
          profiles.set(latinName, { name: slovenianName, imageUrl });
        }
      }
    }
  } catch (error) {
    console.warn("Could not load Slovenian bird profiles from ptice_slovenije.json", error);
  }

  return profiles;
}

function normalizeScientificName(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function sendSocketJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function buildVisualizationFilters(queryParams: express.Request["query"]) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const species = normalizeText(firstQueryValue(queryParams.species));
  const location = normalizeText(firstQueryValue(queryParams.location));
  const source = normalizeText(firstQueryValue(queryParams.source));
  const from = optionalDateParam(queryParams.from ?? queryParams.dateFrom, "from");
  const to = optionalDateParam(queryParams.to ?? queryParams.dateTo, "to");

  if (species) {
    params.push(`%${species.toLowerCase()}%`);
    conditions.push(
      `(lower(b.name) like $${params.length}
        or lower(b.latin_name) like $${params.length}
        or lower(coalesce(f.name, '')) like $${params.length}
        or lower(coalesce(f.latin_name, '')) like $${params.length})`
    );
  }

  if (location) {
    params.push(`%${location.toLowerCase()}%`);
    conditions.push(`lower(l.name) like $${params.length}`);
  }

  if (source) {
    params.push(source);
    conditions.push(`lower(o.source) = lower($${params.length})`);
  }

  if (from) {
    params.push(from);
    conditions.push(`o.event_date >= $${params.length}::date`);
  }

  if (to) {
    params.push(to);
    conditions.push(`o.event_date <= $${params.length}::date`);
  }

  return {
    whereClause: conditions.length ? `where ${conditions.join(" and ")}` : "",
    params
  };
}

function dataSourceUpdates(body: unknown) {
  const source = isPlainRecord(body) ? body : {};
  const fields: string[] = [];
  const values: unknown[] = [];

  if (Object.prototype.hasOwnProperty.call(source, "enabled")) {
    if (typeof source.enabled !== "boolean") {
      throw Object.assign(new Error("enabled must be a boolean."), { statusCode: 400 });
    }
    fields.push("enabled");
    values.push(source.enabled);
  }

  if (Object.prototype.hasOwnProperty.call(source, "region")) {
    const region = normalizeText(source.region);
    if (!region) {
      throw Object.assign(new Error("region must not be empty."), { statusCode: 400 });
    }
    fields.push("region");
    values.push(region);
  }

  if (Object.prototype.hasOwnProperty.call(source, "maxResults")) {
    fields.push("max_results");
    values.push(clampNumber(source.maxResults, 1, 10000, 500));
  }

  if (Object.prototype.hasOwnProperty.call(source, "recentDays")) {
    fields.push("recent_days");
    values.push(clampNumber(source.recentDays, 1, 365, 30));
  }

  if (Object.prototype.hasOwnProperty.call(source, "settings")) {
    if (!isPlainRecord(source.settings)) {
      throw Object.assign(new Error("settings must be an object."), { statusCode: 400 });
    }
    fields.push("settings");
    values.push(source.settings);
  }

  if (source.markSynced === true) {
    fields.push("last_sync");
    values.push(new Date().toISOString());
  }

  return { fields, values };
}

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) return value.length ? String(value[0] ?? "") : "";
  return String(value ?? "");
}

function optionalDateParam(value: unknown, name: string) {
  const text = firstQueryValue(value).trim();
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw Object.assign(new Error(`${name} must be in YYYY-MM-DD format.`), { statusCode: 400 });
  }
  return text;
}

function normalizeDataSourceKey(value: string) {
  const key = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(key)) {
    throw Object.assign(new Error("Invalid data source key."), { statusCode: 400 });
  }
  return key;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function firstParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function isLocalDevOrigin(origin: string) {
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
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
