import { useEffect } from "react";

function setMetaName(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

function setMetaProp(property, content) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

export function useSEO({ title, description, canonical, robots = "index, follow" }) {
  useEffect(() => {
    const prev = {
      title:  document.title,
      robots: document.querySelector('meta[name="robots"]')?.content ?? "",
    };

    document.title = title;
    setMetaName("description",        description);
    setMetaName("robots",             robots);
    setMetaProp("og:title",           title);
    setMetaProp("og:description",     description);
    setMetaName("twitter:title",      title);
    setMetaName("twitter:description", description);

    const prevCanonical = document.querySelector('link[rel="canonical"]')?.href ?? null;
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
      link.href = canonical;
    }

    return () => {
      document.title = prev.title;
      setMetaName("robots", prev.robots || "index, follow");
      // Restore or remove canonical so navigating away doesn't leave a stale tag
      const link = document.querySelector('link[rel="canonical"]');
      if (link) {
        if (prevCanonical) { link.href = prevCanonical; }
        else { link.remove(); }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonical, robots]);
}
