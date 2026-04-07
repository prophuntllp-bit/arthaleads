import { useEffect, useState } from "react";
import api from "../services/api";

export function useLeads() {
  const [limit, setLimit] = useState(50);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    source: "",
    priority: "",
    dateRange: ""
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/leads", {
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
  }, [filters, page, limit]);

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
      const exists = current.some((item) => item._id === lead._id);
      if (exists) {
        return current.map((item) => (item._id === lead._id ? lead : item));
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
