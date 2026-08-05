import { useEffect, useState } from "react";
import { secureFetch } from "./apiSecurity";

export function usePhilippineLocationOptions(level, parent = "") {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOptions([]);
    setError("");
    if (level !== "regions" && !parent) return;
    const controller = new AbortController();
    setLoading(true);
    const query = new URLSearchParams({ level });
    if (parent) query.set("parent", parent);
    secureFetch(`/api/philippine-locations?${query}`, { signal: controller.signal }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !Array.isArray(result.locations)) {
        throw new Error(result.error || "Philippine locations could not be loaded.");
      }
      setOptions(result.locations);
    }).catch((requestError) => {
      if (requestError.name !== "AbortError") setError(requestError.message || "Philippine locations could not be loaded.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [level, parent]);

  return { options, loading, error };
}
