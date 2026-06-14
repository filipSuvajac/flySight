export type TableName = "bird_family" | "bird_info" | "location" | "observation" | "app_event";

type TableConfig = {
  table: TableName;
  writable: string[];
  orderBy: string;
};

export const tables: Record<TableName, TableConfig> = {
  bird_family: {
    table: "bird_family",
    writable: ["name", "latin_name", "slug", "metadata"],
    orderBy: "id"
  },
  bird_info: {
    table: "bird_info",
    writable: ["name", "latin_name", "family_id", "description", "image_url", "source", "metadata"],
    orderBy: "id"
  },
  location: {
    table: "location",
    writable: ["name", "latitude", "longitude", "metadata"],
    orderBy: "id"
  },
  observation: {
    table: "observation",
    writable: ["bird_id", "location_id", "observed_count", "event_date", "source", "metadata"],
    orderBy: "id"
  },
  app_event: {
    table: "app_event",
    writable: ["event_type", "source", "user_id", "metadata"],
    orderBy: "id desc"
  }
};

export function requireTable(name: string): TableConfig {
  const table = tables[name as TableName];
  if (!table) {
    throw Object.assign(new Error(`Unknown table '${name}'.`), { statusCode: 404 });
  }
  return table;
}

export function sanitizeBody(body: Record<string, unknown>, writable: string[]) {
  const sanitized: Record<string, unknown> = {};
  for (const key of writable) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      sanitized[key] = body[key] === "" ? null : body[key];
    }
  }
  return sanitized;
}
