import { lazy } from "react";

const CHUNK_RELOAD_FLAG = "leo_chunk_reload_once";

function isChunkLoadError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Loading chunk") ||
    message.includes("Unexpected token '<'")
  );
}

export default function lazyWithRetry(importer) {
  return lazy(async () => {
    const hasReloaded = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === "true";

    try {
      const module = await importer();
      sessionStorage.setItem(CHUNK_RELOAD_FLAG, "false");
      return module;
    } catch (error) {
      if (isChunkLoadError(error) && !hasReloaded) {
        sessionStorage.setItem(CHUNK_RELOAD_FLAG, "true");
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}
