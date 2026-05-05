import { useEffect, useState } from "react";
import api from "../services/api";

export function useLeads(mode = "normal", initialFilters = {}) {
  const [limit, setLimit] = useState(10);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: initialFilters.search || "",
    status: initialFilters.status || "",
    source: initialFilters.source || "",
    priority: initialFilters.priority || "",
    dateRange: initialFilters.dateRange || "",
    followUpToday: initialFilters.followUpToday || "",
  });

  const endpoint = mode === "unified" ? "/leads/unified" : "/leads";

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(endpoint, {
          params: { ...filters, page, limit },
          signal: controller.signal
        });
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      } catch (err) {
        if (err.name !== "CanceledError") {
          setLeads([]);
          setTotal(0);
          setPages(1);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, page, limit, endpoint]);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const changeLimit = (newLimit) => {
    setPage(1);
    setLimit(newLimit);
  };

  const upsertLead = (lead, prepend = false) => {
    setLeads((current) => {
      const idx = current.findIndex((item) => item._id === lead._id);
      if (idx !== -1) {
        const existing = current[idx];
        // Merge: preserve client-side fields (_type, projectId, projectName) from
        // the existing entry, then overlay fresh API data on top
        const merged = { ...existing, ...lead };
        return current.map((item, i) => (i === idx ? merged : item));
      }
      return prepend ? [lead, ...current].slice(0, limit) : current;
    });

    if (prepend) {
      setTotal((current) => current + 1);
    }
  };

  const removeLead = (id) => {
    setLeads((current) => current.filter((item) => item._id !== id));
    setTotal((current) => Math.max(0, current - 1));
  };

  return {
    leads,
    total,
    pages,
    page,
    setPage,
    filters,
    setFilter,
    loading,
    upsertLead,
    removeLead,
    limit,
    changeLimit,
    LIMIT: limit,
  };
}
