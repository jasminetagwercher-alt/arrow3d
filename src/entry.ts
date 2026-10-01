// The earlier point-arrow campaign remains available with its own save slot.
if (new URLSearchParams(location.search).get("classic") === "1")
  await import("./main");
else await import("./surface/app");
if (import.meta.env.PROD && "serviceWorker" in navigator)
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => console.info("Offline-Modus nicht verfügbar."));
