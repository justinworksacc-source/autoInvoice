import { fail, json, requireSession } from "../server/security.js";

const baseUrl = "https://barangays.sanchez.ph/api";

async function psgc(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" }
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(result)) {
    throw Object.assign(new Error("Philippine address reference is temporarily unavailable."), { status: 502 });
  }
  return result;
}

export default async function handler(req, res) {
  try {
    requireSession(req, { csrf: false });
    if (req.method !== "GET") return json(res, 405, { success: false, error: "Method not allowed." });
    const level = String(req.query.level || "");
    const parent = String(req.query.parent || "").trim();
    const paths = {
      regions: "/regions",
      provinces: parent ? `/regions/${encodeURIComponent(parent)}/provinces` : "",
      cities: parent.startsWith("region-")
        ? `/regions/${encodeURIComponent(parent.slice(7))}/cities`
        : parent ? `/provinces/${encodeURIComponent(parent)}/cities` : "",
      barangays: parent ? `/cities/${encodeURIComponent(parent)}/barangays` : ""
    };
    const path = paths[level];
    if (!path) throw Object.assign(new Error("A valid Philippine location level and parent are required."), { status: 422 });
    let locations = await psgc(path);
    if (level === "provinces" && !locations.length && parent === "1300000000") {
      locations = [{ code: `region-${parent}`, name: "Metro Manila" }];
    }
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return json(res, 200, {
      success: true,
      source: "Philippine Standard Geographic Code",
      locations: locations.map((item) => ({
        code: String(item.code || "").trim(),
        name: String(item.name || "").trim()
      })).filter((item) => item.code && item.name).sort((left, right) => left.name.localeCompare(right.name))
    });
  } catch (error) {
    return fail(res, error);
  }
}
