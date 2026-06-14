import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcrypt";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { WebSocket, WebSocketServer } from "ws";
import { requireAdmin, requireAuth, signToken, verifyToken } from "./auth.js";
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
const adminAccounts = [
  { email: "filip@flysight.test", password: "FlySightAdmin123!" },
  { email: "niko@flysight.test", password: "FlySightAdmin123!" },
  { email: "enej@flysight.test", password: "FlySightAdmin123!" }
];

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
      "/api/analytics/desktop",
      "/api/me/favorites",
      "/api/data-sources",
      "/api/:table",
      "/api/import/dopps",
      "/api/import/ebird",
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

app.get("/api/tables", requireAuth, requireAdmin, (_req, res) => {
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
    const result = await query<{ id: number; email: string; name: string }>(
      "insert into users (email, name, password_hash) values ($1, $2, $3) returning id, email, name",
      [email, name, passwordHash]
    );
    const user = withComputedRole(result.rows[0], email, password);
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

    if (isHardcodedAdmin(email, password)) {
      const adminUser = await ensureAdminUser(email, password);
      const token = signToken(adminUser);
      res.json({ user: adminUser, token });
      return;
    }

    const result = await query<{ id: number; email: string; name: string; password_hash: string }>(
      "select id, email, name, password_hash from users where email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const { password_hash: _passwordHash, ...storedUser } = user;
    const publicUser = withComputedRole(storedUser, email, password);
    const token = signToken(publicUser);
    res.json({ user: publicUser, token });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/me/profile", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await query<{
      name: string;
      email: string;
      role: string;
      bio: string;
      location: string;
    }>(
      `select u.name, u.email, u.role, coalesce(p.bio, '') as bio, coalesce(p.location, '') as location
       from users u
       left join user_profiles p on p.user_id = u.id
       where u.id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/me/profile", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const bio = normalizeText(req.body.bio);
    const location = normalizeText(req.body.location);
    const currentPassword = String(req.body.currentPassword ?? "");
    const newPassword = String(req.body.newPassword ?? "");

    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required." });
      return;
    }

    const existingEmail = await query<{ id: number }>(
      "select id from users where email = $1 and id <> $2",
      [email, userId]
    );
    if (existingEmail.rowCount) {
      res.status(409).json({ error: "User with this email already exists." });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        res.status(400).json({ error: "New password must be at least 8 characters." });
        return;
      }
      if (!currentPassword) {
        res.status(400).json({ error: "Current password is required to change password." });
        return;
      }

      const passwordResult = await query<{ password_hash: string }>(
        "select password_hash from users where id = $1",
        [userId]
      );
      const passwordHash = passwordResult.rows[0]?.password_hash;
      if (!passwordHash || !(await bcrypt.compare(currentPassword, passwordHash))) {
        res.status(401).json({ error: "Current password is incorrect." });
        return;
      }
    }

    const passwordSetClause = newPassword ? ", password_hash = $4" : "";
    const updateValues = newPassword
      ? [name, email, userId, await bcrypt.hash(newPassword, 12)]
      : [name, email, userId];

    await query(
      `update users
       set name = $1,
           email = $2,
           updated_at = now()
           ${passwordSetClause}
       where id = $3`,
      updateValues
    );

    await query(
      `insert into user_profiles (user_id, bio, location)
       values ($1, $2, $3)
       on conflict (user_id) do update
       set bio = excluded.bio,
           location = excluded.location,
           updated_at = now()`,
      [userId, bio, location]
    );

    const result = await query<{
      name: string;
      email: string;
      role: string;
      bio: string;
      location: string;
    }>(
      `select u.name, u.email, u.role, coalesce(p.bio, '') as bio, coalesce(p.location, '') as location
       from users u
       left join user_profiles p on p.user_id = u.id
       where u.id = $1`,
      [userId]
    );

    const updatedProfile = result.rows[0];
    const updatedUser = {
      id: userId,
      email: updatedProfile.email,
      name: updatedProfile.name,
      role: req.user?.role === "admin" ? "admin" : "user"
    };

    await logAppEvent("profile_updated", "web", userId, { location: updatedProfile.location });

    res.json({
      ...updatedProfile,
      user: updatedUser,
      token: signToken(updatedUser)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/birds", requireAuth, async (req, res, next) => {
  try {
    const result = await query("select id, name, latin_name as \"latinName\" from bird_info order by name");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/me/favorites", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await query<FavoriteBirdRow>(
      `select
         b.id as "birdId",
         b.name as "birdName",
         b.latin_name as "birdLatinName",
         b.description as "birdDescription",
         b.image_url as "birdImageUrl",
         b.source,
         f.name as "familyName",
         f.latin_name as "familyLatinName",
         fb.created_at as "createdAt"
       from favorite_bird fb
       join bird_info b on b.id = fb.bird_id
       left join bird_family f on f.id = b.family_id
       where fb.user_id = $1
       order by fb.created_at desc, b.name asc`,
      [userId]
    );

    res.json({ favorites: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/me/favorites", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const birdId = Number(req.body.birdId);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!Number.isInteger(birdId) || birdId <= 0) {
      res.status(400).json({ error: "birdId is required." });
      return;
    }

    const bird = await query<{ id: number }>("select id from bird_info where id = $1", [birdId]);
    if (bird.rowCount === 0) {
      res.status(404).json({ error: "Bird species not found." });
      return;
    }

    await query(
      `insert into favorite_bird (user_id, bird_id)
       values ($1, $2)
       on conflict (user_id, bird_id) do nothing`,
      [userId, birdId]
    );

    await logAppEvent("favorite_added", "web", userId, { birdId });

    res.status(201).json({ birdId, isFavorite: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/me/favorites/:birdId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const birdId = Number(firstParam(req.params.birdId));
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!Number.isInteger(birdId) || birdId <= 0) {
      res.status(400).json({ error: "Invalid bird id." });
      return;
    }

    await query(
      "delete from favorite_bird where user_id = $1 and bird_id = $2",
      [userId, birdId]
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/me/observations", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const result = await query(
      `select o.id, o.observed_count as "observedCount", o.event_date::text as "eventDate", o.source, o.metadata,
              b.id as "birdId", b.name as "birdName", b.latin_name as "birdLatinName", b.image_url as "birdImageUrl",
              l.id as "locationId", l.name as "locationName", l.latitude, l.longitude
       from observation o
       join bird_info b on b.id = o.bird_id
       join location l on l.id = o.location_id
       where o.user_id = $1
       order by o.event_date desc, o.id desc`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/me/observations", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let birdId = req.body.birdId ? Number(req.body.birdId) : null;
    const customBirdName = normalizeText(req.body.customBirdName);
    const locationName = normalizeText(req.body.locationName);
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const observedCount = Math.max(1, Number(req.body.observedCount ?? 1));
    const eventDate = normalizeText(req.body.eventDate);

    if ((!birdId && !customBirdName) || !locationName || isNaN(latitude) || isNaN(longitude) || !eventDate) {
      res.status(400).json({ error: "Missing or invalid bird species, locationName, latitude, longitude or eventDate." });
      return;
    }

    if (!birdId && customBirdName) {
      const existingBird = await query<{ id: number }>(
        "select id from bird_info where lower(name) = lower($1) limit 1",
        [customBirdName]
      );
      if (existingBird.rows.length > 0) {
        birdId = existingBird.rows[0].id;
      } else {
        const newBird = await query<{ id: number }>(
          "insert into bird_info (name, source) values ($1, 'user') returning id",
          [customBirdName]
        );
        birdId = newBird.rows[0].id;
      }
    } else if (birdId) {
      const bird = await query("select id from bird_info where id = $1", [birdId]);
      if (bird.rowCount === 0) {
        res.status(400).json({ error: "Selected bird species does not exist." });
        return;
      }
    }

    let locationResult = await query<{ id: number }>(
      "select id from location where name = $1 and latitude = $2 and longitude = $3 limit 1",
      [locationName, latitude, longitude]
    );
    if (locationResult.rowCount === 0) {
      locationResult = await query<{ id: number }>(
        "insert into location (name, latitude, longitude, metadata) values ($1, $2, $3, $4) returning id",
        [locationName, latitude, longitude, { source: "user" }]
      );
    }
    const locationId = locationResult.rows[0].id;

    const result = await query<{ id: number }>(
      `insert into observation (bird_id, location_id, user_id, observed_count, event_date, source, metadata)
       values ($1, $2, $3, $4, $5::date, 'user', '{}'::jsonb)
       returning id`,
      [birdId, locationId, userId, observedCount, eventDate]
    );
    await logAppEvent("user_observation_created", "web", userId, {
      observationId: result.rows[0].id,
      birdId,
      locationId,
      observedCount,
      eventDate
    });

    const fullObs = await query(
      `select o.id, o.observed_count as "observedCount", o.event_date::text as "eventDate", o.source, o.metadata,
              b.id as "birdId", b.name as "birdName", b.latin_name as "birdLatinName", b.image_url as "birdImageUrl",
              l.id as "locationId", l.name as "locationName", l.latitude, l.longitude
       from observation o
       join bird_info b on b.id = o.bird_id
       join location l on l.id = o.location_id
       where o.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(fullObs.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/me/observations/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const observationId = Number(firstParam(req.params.id));
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await query(
      "delete from observation where id = $1 and user_id = $2 returning id",
      [observationId, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Observation not found or not owned by you." });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/visualization/observations", requireAuth, async (req, res, next) => {
  try {
    autoSyncEbirdData().catch(console.error);
    const filters = buildVisualizationFilters(req.query, req.user?.id);
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
         l.longitude,
         (fb.bird_id is not null) as "isFavorite"
       from observation o
       join bird_info b on b.id = o.bird_id
       left join bird_family f on f.id = b.family_id
       join location l on l.id = o.location_id
       left join favorite_bird fb on fb.bird_id = b.id and fb.user_id = $${filters.params.length + 2}
       ${filters.whereClause}
       order by o.event_date desc, o.id desc
       limit $${filters.params.length + 1}`,
      [...filters.params, limit, req.user?.id]
    );

    res.json({ observations: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/visualization/summary", requireAuth, async (req, res, next) => {
  try {
    const filters = buildVisualizationFilters(req.query, req.user?.id);
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

app.get("/api/analytics/desktop", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const totals = await query<DesktopTotalsRow>(
      `select
         (select count(*)::int from users) as users,
         (select count(*)::int from bird_family) as families,
         (select count(*)::int from bird_info) as birds,
         (select count(*)::int from location) as locations,
         (select count(*)::int from observation) as observations,
         (select count(*)::int from app_event) as events`
    );
    const observationsBySource = await query<AnalyticsCountRow>(
      `select source as label, count(*)::int as total
       from observation
       group by source
       order by total desc, source asc`
    );
    const topSpecies = await query<AnalyticsCountRow>(
      `select b.name as label, count(*)::int as total
       from observation o
       join bird_info b on b.id = o.bird_id
       group by b.name
       order by total desc, b.name asc
       limit 8`
    );
    const topLocations = await query<AnalyticsCountRow>(
      `select l.name as label, count(*)::int as total
       from observation o
       join location l on l.id = o.location_id
       group by l.name
       order by total desc, l.name asc
       limit 8`
    );
    const monthlyTrend = await query<AnalyticsCountRow>(
      `select to_char(date_trunc('month', event_date), 'YYYY-MM') as label, count(*)::int as total
       from observation
       group by date_trunc('month', event_date)
       order by date_trunc('month', event_date) asc`
    );
    const eventTotals = await query<ActivityTotalsRow>(
      `select
         count(*)::int as total,
         count(*) filter (where created_at >= current_date)::int as today,
         count(*) filter (where created_at >= current_date - interval '7 days')::int as week
       from app_event`
    );
    const eventsByDay = await query<AnalyticsCountRow>(
      `select created_at::date::text as label, count(*)::int as total
       from app_event
       where created_at >= current_date - interval '14 days'
       group by created_at::date
       order by created_at::date asc`
    );
    const eventsByType = await query<AnalyticsCountRow>(
      `select event_type as label, count(*)::int as total
       from app_event
       group by event_type
       order by total desc, event_type asc
       limit 8`
    );
    const recentEvents = await query<RecentEventRow>(
      `select
         e.id,
         e.event_type as "eventType",
         e.source,
         coalesce(u.email, 'system') as actor,
         e.created_at::text as "createdAt",
         e.metadata::text as "metadataText"
       from app_event e
       left join users u on u.id = e.user_id
       order by e.created_at desc
       limit 10`
    );

    const totalRow = totals.rows[0] ?? {
      users: 0,
      families: 0,
      birds: 0,
      locations: 0,
      observations: 0,
      events: 0
    };
    const activityRow = eventTotals.rows[0] ?? { total: 0, today: 0, week: 0 };

    res.json({
      generatedAt: new Date().toISOString(),
      database: {
        tableCounts: [
          { label: "Users", total: totalRow.users },
          { label: "Bird families", total: totalRow.families },
          { label: "Birds", total: totalRow.birds },
          { label: "Locations", total: totalRow.locations },
          { label: "Observations", total: totalRow.observations },
          { label: "Activity events", total: totalRow.events }
        ],
        observationsBySource: observationsBySource.rows,
        topSpecies: topSpecies.rows,
        topLocations: topLocations.rows,
        monthlyTrend: monthlyTrend.rows
      },
      activity: {
        total: activityRow.total,
        today: activityRow.today,
        week: activityRow.week,
        eventsByDay: eventsByDay.rows,
        eventsByType: eventsByType.rows,
        recentEvents: recentEvents.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/data-sources", requireAuth, requireAdmin, async (_req, res, next) => {
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

app.put("/api/data-sources/:key", requireAuth, requireAdmin, async (req, res, next) => {
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

app.get("/api/:table", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const table = requireTable(firstParam(req.params.table));
    const result = await query(`select * from ${table.table} order by ${table.orderBy}`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/:table", requireAuth, requireAdmin, async (req, res, next) => {
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
    await logAppEvent("table_row_created", "desktop", req.user?.id, {
      table: table.table,
      rowId: result.rows[0]?.id ?? null
    });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/:table/:id", requireAuth, requireAdmin, async (req, res, next) => {
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
    await logAppEvent("table_row_updated", "desktop", req.user?.id, {
      table: table.table,
      rowId: result.rows[0]?.id ?? firstParam(req.params.id)
    });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/:table/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const table = requireTable(firstParam(req.params.table));
    const result = await query(`delete from ${table.table} where id = $1 returning id`, [firstParam(req.params.id)]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Row not found." });
      return;
    }
    await logAppEvent("table_row_deleted", "desktop", req.user?.id, {
      table: table.table,
      rowId: result.rows[0]?.id ?? firstParam(req.params.id)
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/import/dopps", requireAuth, requireAdmin, async (req, res, next) => {
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
    await logAppEvent("dopps_imported", "desktop", req.user?.id, {
      families: importedFamilies,
      birds: importedBirds
    });

    res.json({ status: "ok", families: importedFamilies, birds: importedBirds });
  } catch (error) {
    next(error);
  }
});

async function processEbirdObservations(observations: any[]) {
  let importedBirds = 0;
  let importedLocations = 0;
  let importedObservations = 0;
  let skipped = 0;

  for (const observation of observations) {
    if (!isPlainRecord(observation)) {
      skipped++;
      continue;
    }

    const ebirdId = normalizeText(observation.id);
    const speciesCode = normalizeText(observation.speciesCode);
    const commonName = normalizeText(observation.commonName);
    const slovenianName = normalizeText(observation.slovenianName);
    const scientificName = normalizeText(observation.scientificName);
    const speciesName = slovenianName || commonName || speciesCode;
    const locationName = normalizeText(observation.locationName) || normalizeText(observation.city);
    const latitude = numberOr(observation.latitude, Number.NaN);
    const longitude = numberOr(observation.longitude, Number.NaN);
    const eventDate = normalizeText(observation.observedAt).slice(0, 10);

    if (!ebirdId || !speciesName || !locationName || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !isIsoDate(eventDate)) {
      skipped++;
      continue;
    }

    const duplicate = await query<{ id: number }>(
      "select id from observation where metadata->>'ebirdId' = $1 limit 1",
      [ebirdId]
    );
    if (duplicate.rowCount) {
      skipped++;
      continue;
    }

    const existingBird = await query<{ id: number }>(
      "select id from bird_info where name = $1 and latin_name = $2 limit 1",
      [speciesName, scientificName || speciesCode]
    );

    const birdResult = await query<{ id: number }>(
      `insert into bird_info (name, latin_name, description, image_url, source, metadata)
       values ($1, $2, $3, $4, 'eBird', $5)
       on conflict (name, latin_name) do update
       set image_url = coalesce(nullif(excluded.image_url, ''), bird_info.image_url),
           source = excluded.source
       returning id`,
      [
        speciesName,
        scientificName || speciesCode,
        commonName && slovenianName ? commonName : "",
        normalizeText(observation.imageUrl),
        { speciesCode, commonName, slovenianName }
      ]
    );
    if (existingBird.rowCount === 0) importedBirds++;

    let location = await query<{ id: number }>(
      "select id from location where name = $1 and latitude = $2 and longitude = $3 limit 1",
      [locationName, latitude, longitude]
    );
    if (location.rowCount === 0) {
      location = await query<{ id: number }>(
        "insert into location (name, latitude, longitude, metadata) values ($1, $2, $3, $4) returning id",
        [
          locationName,
          latitude,
          longitude,
          {
            city: normalizeText(observation.city),
            region: normalizeText(observation.region),
            source: "eBird"
          }
        ]
      );
      importedLocations++;
    }

    await query(
      `insert into observation (bird_id, location_id, observed_count, event_date, source, metadata)
       values ($1, $2, $3, $4::date, 'eBird', $5)`,
      [
        birdResult.rows[0].id,
        location.rows[0].id,
        Math.max(0, clampNumber(observation.count, 0, 100000, 1)),
        eventDate,
        {
          ebirdId,
          speciesCode,
          observedAt: normalizeText(observation.observedAt),
          valid: Boolean(observation.valid),
          reviewed: Boolean(observation.reviewed)
        }
      ]
    );
    importedObservations++;
  }

  return { importedBirds, importedLocations, importedObservations, skipped };
}

let isSyncingEbird = false;
async function autoSyncEbirdData() {
  if (isSyncingEbird) return;
  isSyncingEbird = true;
  try {
    const ds = await query<{ last_sync: Date | null, recent_days: number, max_results: number, enabled: boolean }>(
      "select last_sync, recent_days, max_results, enabled from data_source_settings where key = 'ebird'"
    );
    const settings = ds.rows[0];
    if (!settings || !settings.enabled) return;

    const lastSync = settings.last_sync ? new Date(settings.last_sync).getTime() : 0;
    if (Date.now() - lastSync < 3600000) return; // 1 hour

    const observations = await fetchSloveniaEbirdObservations({ days: settings.recent_days, maxResults: settings.max_results });
    const result = await processEbirdObservations(observations);

    await query("update data_source_settings set last_sync = now() where key = 'ebird'");
    if (result.importedObservations > 0) {
      await query(
        "insert into import_batch (source, imported_count, metadata) values ($1, $2, $3)",
        ["eBirdAutoSync", result.importedObservations, { importedBirds: result.importedBirds, importedLocations: result.importedLocations, skipped: result.skipped }]
      );
    }
  } catch (error) {
    console.error("Auto sync eBird failed:", error);
  } finally {
    isSyncingEbird = false;
  }
}

app.post("/api/import/ebird", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const observations = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.observations)
        ? req.body.observations
        : [];

    const result = await processEbirdObservations(observations);

    await query(
      "insert into import_batch (source, imported_count, metadata) values ($1, $2, $3)",
      ["eBird", result.importedObservations, { importedBirds: result.importedBirds, importedLocations: result.importedLocations, skipped: result.skipped }]
    );
    await logAppEvent("ebird_imported", "desktop", req.user?.id, result);

    res.json({
      status: "ok",
      birds: result.importedBirds,
      locations: result.importedLocations,
      observations: result.importedObservations,
      skipped: result.skipped
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/generate/observations", requireAuth, requireAdmin, async (req, res, next) => {
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

    await logAppEvent("generated_observations", "desktop", req.user?.id, { count });
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
  isFavorite: boolean;
};

type FavoriteBirdRow = {
  birdId: number;
  birdName: string;
  birdLatinName: string;
  birdDescription: string;
  birdImageUrl: string;
  source: string;
  familyName: string | null;
  familyLatinName: string | null;
  createdAt: string;
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

type AnalyticsCountRow = {
  label: string;
  total: number;
};

type DesktopTotalsRow = {
  users: number;
  families: number;
  birds: number;
  locations: number;
  observations: number;
  events: number;
};

type ActivityTotalsRow = {
  total: number;
  today: number;
  week: number;
};

type RecentEventRow = {
  id: number;
  eventType: string;
  source: string;
  actor: string;
  createdAt: string;
  metadataText: string;
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

function buildVisualizationFilters(queryParams: express.Request["query"], userId?: number) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const species = normalizeText(firstQueryValue(queryParams.species));
  const location = normalizeText(firstQueryValue(queryParams.location));
  const source = normalizeText(firstQueryValue(queryParams.source));
  const from = optionalDateParam(queryParams.from ?? queryParams.dateFrom, "from");
  const to = optionalDateParam(queryParams.to ?? queryParams.dateTo, "to");
  const mineOnly = queryParams.mineOnly === "true";

  if (mineOnly && userId) {
    params.push(userId);
    conditions.push(`o.user_id = $${params.length}`);
  }

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
  if (!isIsoDate(text)) {
    throw Object.assign(new Error(`${name} must be in YYYY-MM-DD format.`), { statusCode: 400 });
  }
  return text;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function withComputedRole<T extends { email: string }>(user: T, email: string, password: string): T & { role: string } {
  return {
    ...user,
    role: isHardcodedAdmin(email, password) ? "admin" : "user"
  };
}

async function ensureAdminUser(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query<{ id: number; email: string; name: string }>(
    `insert into users (email, name, password_hash)
     values ($1, $2, $3)
     on conflict (email) do update
     set password_hash = excluded.password_hash
     returning id, email, name`,
    [email, adminName(email), passwordHash]
  );

  return withComputedRole(result.rows[0], email, password);
}

function adminName(email: string) {
  return email.split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ") || "FlySight Admin";
}

function isHardcodedAdmin(email: string, password: string) {
  return adminAccounts.some((account) => account.email === email && account.password === password);
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

async function logAppEvent(
  eventType: string,
  source: string,
  userId: number | undefined,
  metadata: Record<string, unknown> = {}
) {
  try {
    await query(
      "insert into app_event (event_type, source, user_id, metadata) values ($1, $2, $3, $4)",
      [eventType, source, userId ?? null, metadata]
    );
  } catch (error) {
    console.warn("Could not log app event:", error);
  }
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
