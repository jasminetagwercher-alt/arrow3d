import "../style.css";
import "./surface.css";
import { SurfaceView } from "./view";
import {
  parse,
  available,
  blockers,
  remove,
  faces,
  type SurfaceArrow,
  type SurfaceLevel,
  type Face,
} from "./core";
import { AudioEngine } from "../game/audio";
document.body.classList.add("surface-game");
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
$("#app").innerHTML =
  `<header><a class="brand" href="./"><span class="brandmark">↗</span> VECTOR</a><span class="tagline">EINE ANDERE PERSPEKTIVE.</span><div class="top-actions"><button id="levels-button" class="text-button">▦ Würfel wählen</button><button id="settings-button" class="icon-button" aria-label="Einstellungen">⚙</button></div></header>
<main><aside class="intro"><div class="eyebrow"><span class="tiny-line"></span> AUF SECHS SEITEN VERBUNDEN</div><h1>Ein Würfel.<br>Viele <em>Wege.</em></h1><p class="intro-copy">Folge den Linien. Denk um die Ecke.<br>Und löse eine Verbindung nach der anderen.</p><div class="chapter-card"><span class="eyebrow">DIE NEUE OBERFLÄCHEN-VERSION</span><h2 id="level-name"></h2><p id="lesson"></p><div class="progress-track"><span id="progress-fill"></span></div><div class="progress-caption"><span id="progress-text"></span><span id="level-fraction"></span></div></div><div class="surface-rule"><span class="rule-symbol">↗</span><p><strong>Die Spitze zeigt den Weg.</strong><br>Ist die gerade Linie vor ihr bis zur Kante frei, zieht sich die ganze Bahn heraus.</p></div><button id="help-button" class="text-button">So funktioniert’s ↗</button></aside>
<section class="play-space" aria-label="Würfel-Puzzle"><div class="stage-top"><span class="pill">● OHNE ZEITDRUCK</span><span id="stage-level" class="stage-level"></span></div><div id="scene"></div><div id="hover-caption" aria-hidden="true"></div><div id="status" role="status" aria-live="polite"></div><div class="stage-bottom"><span class="gesture">Ziehen: drehen · Tippen: Bahn lösen</span><button id="camera-button" class="icon-button" aria-label="Kamera zentrieren"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></svg></button></div></section>
<div class="game-toolbar"><span id="remaining-label"></span><div><button id="restart-button" class="text-button">↻ <span>Neustart</span></button><button id="access-button" class="text-button">⌨ <span>Pfeilliste</span></button><button id="hint-button" class="hint-button">✧ <span>Ein kleiner Hinweis</span></button></div></div></main>
<footer><span>VERBUNDEN ÜBER JEDE KANTE.</span><a class="text-button" href="?classic=1">Frühere Version ↗</a><span>OHNE WERBUNG · OHNE TRACKING</span></footer><dialog id="modal"><button class="modal-close icon-button" aria-label="Schließen">×</button><div id="modal-content"></div></dialog>`;
$(".game-toolbar").prepend($("#status"));
const modal = $<HTMLDialogElement>("#modal"),
  content = $("#modal-content"),
  audio = new AudioEngine();
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
interface Progress {
  current: number;
  completed: number[];
  sound: boolean;
}
let progress: Progress = { current: 1, completed: [], sound: false },
  storageOK = true;
try {
  const s = JSON.parse(localStorage.getItem("vector-surface-v2") ?? "null");
  if (s) {
    progress = {
      current:
        Number.isInteger(s.current) && s.current >= 1 && s.current <= 5
          ? s.current
          : 1,
      completed: Array.isArray(s.completed)
        ? s.completed.filter(
            (n: unknown) =>
              Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 5,
          )
        : [],
      sound: s.sound === true,
    };
  }
} catch {
  storageOK = false;
}
audio.enabled = progress.sound;
function persist() {
  try {
    localStorage.setItem("vector-surface-v2", JSON.stringify(progress));
  } catch {
    storageOK = false;
  }
}
function open(html: string) {
  content.innerHTML = html;
  if (!modal.open) modal.showModal();
}
$(".modal-close").onclick = () => modal.close();
let levels: SurfaceLevel[] = [],
  level: SurfaceLevel,
  state: SurfaceArrow[] = [],
  view: SurfaceView,
  busy = false,
  mistakes = 0,
  hints = 0,
  session = 0;
const status = (text: string) => {
  $("#status").textContent = text;
};
function refresh() {
  const n = level.arrows.length - state.length;
  $("#level-name").textContent = level.name;
  $("#lesson").textContent = level.hint;
  $("#stage-level").textContent = `WÜRFEL ${String(level.id).padStart(2, "0")}`;
  $("#level-fraction").textContent = `${level.id} / ${levels.length}`;
  $("#progress-text").textContent =
    `${n} von ${level.arrows.length} Bahnen gelöst`;
  $("#progress-fill").style.width = `${(100 * n) / level.arrows.length}%`;
  $("#remaining-label").textContent =
    `${state.length} ${state.length === 1 ? "Pfeilbahn" : "Pfeilbahnen"} verbleibend`;
}
function start(l: SurfaceLevel) {
  session++;
  level = l;
  state = [...l.arrows];
  busy = false;
  mistakes = 0;
  hints = 0;
  view.setLevel(l);
  progress.current = l.id;
  persist();
  refresh();
  status(
    storageOK
      ? "Drehe den Würfel. Welche Spitze hat freie Bahn?"
      : "Der Browser kann den Fortschritt nicht speichern. Du kannst trotzdem spielen.",
  );
  $("#hover-caption").textContent = "";
}
function win() {
  audio.play("win");
  if (!progress.completed.includes(level.id)) progress.completed.push(level.id);
  persist();
  open(
    `<div class="eyebrow">ALLE VERBINDUNGEN GELÖST</div><div class="win-symbol">✧</div><h2>Der Weg ist frei.</h2><p>Du hast alle ${level.arrows.length} Pfeilbahnen vom Würfel gelöst.</p><div class="win-stats"><span><strong>${mistakes}</strong>Blockierte Versuche</span><span><strong>${hints}</strong>Hinweise</span></div><button class="primary" id="next-button">${level.id < levels.length ? "Zum nächsten Würfel ↗" : "Noch einmal spielen ↗"}</button><button class="text-button" id="choose-button">Würfel wählen</button>`,
  );
  $("#next-button").onclick = () => {
    modal.close();
    start(levels[level.id < levels.length ? level.id : 0]);
  };
  $("#choose-button").onclick = choose;
}
function pick(id: string) {
  if (busy || !state.some((a) => a.id === id)) return;
  view.highlight([]);
  const blocked = blockers(state, id, level.size);
  if (blocked.length) {
    mistakes++;
    view.blocked(id);
    audio.play("blocked");
    status("Noch versperrt: Vor der Spitze liegt eine andere Pfeilbahn.");
    return;
  }
  busy = true;
  const token = session;
  audio.play("move");
  state = remove(state, id, level.size);
  refresh();
  status("Freie Bahn – die ganze Linie folgt ihrer Spitze.");
  view.fly(id, () => {
    if (token !== session) return;
    busy = false;
    if (!state.length) win();
    else status("Ein Weg weniger. Schau auch auf die anderen Seiten.");
  });
}
function choose() {
  open(
    `<div class="eyebrow">FÜNF WÜRFEL ZUM ENTDECKEN</div><h2>Um die Ecke gedacht.</h2><p>Jeder Würfel hat lange, geknickte Bahnen über mehrere Seiten. Alle fünf sind direkt spielbar.</p><div class="surface-levels">${levels.map((l) => `<button class="surface-level ${l.id === level.id ? "current" : ""}" data-level="${l.id}"><span>${String(l.id).padStart(2, "0")}</span><div><strong>${escape(l.name)}</strong><small>${l.arrows.length} Bahnen · ${l.size} × ${l.size} je Fläche</small></div><b>${progress.completed.includes(l.id) ? "✓" : "↗"}</b></button>`).join("")}</div><p class="small">Diese fünf Würfel sind die erste spielbare Fassung der neuen Mechanik. Die frühere Kampagne hat einen eigenen Spielstand.</p>`,
  );
  content.querySelectorAll<HTMLButtonElement>("[data-level]").forEach(
    (b) =>
      (b.onclick = () => {
        modal.close();
        start(levels[Number(b.dataset.level) - 1]);
      }),
  );
}
function arrowList() {
  open(
    `<div class="eyebrow">ALLE VERBINDUNGEN</div><h2>Welche Bahn löst du?</h2><p>Die Liste nutzt dieselben Regeln wie der Würfel. Die angegebene Fläche ist die Seite mit der Pfeilspitze.</p><div class="arrow-list">${state.map((a) => `<button class="list-arrow" data-arrow="${a.id}"><strong>${a.id.toUpperCase()}</strong><span>${faces[a.path.at(-1)!.face].label} · ${a.path.length} Felder</span><b>↗</b></button>`).join("")}</div>`,
  );
  content.querySelectorAll<HTMLButtonElement>("[data-arrow]").forEach(
    (b) =>
      (b.onclick = () => {
        modal.close();
        pick(b.dataset.arrow!);
      }),
  );
}
$("#levels-button").onclick = () => {
  if (level) choose();
};
$("#access-button").onclick = () => {
  if (level && !busy) arrowList();
};
$("#restart-button").onclick = () => {
  if (level) start(level);
};
$("#camera-button").onclick = () => view?.reset();
$("#hint-button").onclick = () => {
  if (busy || !state.length) return;
  hints++;
  const id = available(state, level.size)[0],
    a = state.find((a) => a.id === id)!;
  if (!a) return;
  if (hints % 3 === 1) {
    status(
      "Folge einer Spitze geradeaus bis zur Kante. Dort darf keine andere Linie liegen.",
    );
  } else if (hints % 3 === 2) {
    const face = a.path.at(-1)!.face;
    view.face(faces[face].n);
    view.highlight(
      state.filter((b) => b.path.at(-1)!.face === face).map((b) => b.id),
    );
    status(
      `Auf dieser Seite (${faces[face].label}) gibt es einen freien Ausgang.`,
    );
  } else {
    view.face(faces[a.path.at(-1)!.face].n);
    view.highlight([id]);
    status(`Die goldene Bahn ${id.toUpperCase()} lässt sich herausziehen.`);
  }
};
$("#help-button").onclick = () =>
  open(
    `<div class="eyebrow">SO FUNKTIONIERT’S</div><h2>Eine Linie. Ein Ausgang.</h2><ol class="surface-help"><li><strong>Verfolge eine Bahn.</strong> Sie kann sich um mehrere Würfelseiten schlängeln. Beim Darüberfahren wird die ganze Bahn blau.</li><li><strong>Schau vor die Spitze.</strong> Ihre gerade Austrittslinie bis zur nächsten Kante muss frei von anderen Bahnen sein.</li><li><strong>Tippe die Bahn an.</strong> Die Spitze gleitet gerade hinaus; der lange Rest wird über seinen bisherigen Verlauf nachgezogen.</li><li><strong>Wechsle die Perspektive.</strong> Ziehen dreht den Würfel. Mausrad oder zwei Finger zoomen. Auch die Unterseite zählt!</li></ol><p class="small">Tastatur: Pfeiltasten drehen, + / − zoomen, 0 zentriert. Die Pfeilliste ermöglicht das Spielen per Tastatur.</p>`,
  );
$("#settings-button").onclick = () => {
  open(
    `<div class="eyebrow">DEIN FREIRAUM</div><h2>Ganz in deinem Tempo.</h2><label class="setting">Sanfte Klänge<input id="sound" type="checkbox" ${progress.sound ? "checked" : ""}></label><p>Keine Uhr. Keine Leben. Kein Zeitdruck.</p><p class="small">Fortschritt bleibt lokal in diesem Browser. Die frühere Kampagne wird separat gespeichert. Reduzierte Bewegung folgt deiner Systemeinstellung.</p><button id="reset-save" class="danger-button">Fortschritt dieser Version zurücksetzen</button>`,
  );
  $<HTMLInputElement>("#sound").onchange = (e) => {
    progress.sound = (e.target as HTMLInputElement).checked;
    audio.enabled = progress.sound;
    persist();
    audio.play("ui");
  };
  $("#reset-save").onclick = () => {
    open(
      '<h2>Neu beginnen?</h2><p>Nur der Fortschritt der fünf Oberflächen-Würfel wird zurückgesetzt.</p><button id="confirm-reset" class="primary">Fortschritt löschen</button><button id="cancel-reset" class="text-button">Abbrechen</button>',
    );
    $("#cancel-reset").onclick = () => modal.close();
    $("#confirm-reset").onclick = () => {
      progress = { current: 1, completed: [], sound: progress.sound };
      persist();
      modal.close();
      start(levels[0]);
    };
  };
};
window.addEventListener("keydown", (e) => {
  if (modal.open || !view) return;
  const k = e.key;
  if (
    ![
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "+",
      "-",
      "0",
    ].includes(k)
  )
    return;
  e.preventDefault();
  if (k === "0") view.reset();
  else if (k === "+" || k === "-") view.base.zoom(k === "+" ? 0.88 : 1.12);
  else
    view.base.turn(
      k === "ArrowLeft" ? -0.2 : k === "ArrowRight" ? 0.2 : 0,
      k === "ArrowUp" ? -0.2 : k === "ArrowDown" ? 0.2 : 0,
    );
});
async function boot() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}levels/surface.json`);
    if (!r.ok) throw new Error("Die Würfel konnten nicht geladen werden.");
    const raw: unknown = await r.json();
    if (!Array.isArray(raw) || raw.length !== 5)
      throw new Error("Ungültige Würfeldatei.");
    levels = raw.map(parse);
    view = new SurfaceView($("#scene"));
    view.onPick = pick;
    view.onHover = (id) => {
      const a = state.find((a) => a.id === id);
      $("#hover-caption").textContent = a
        ? `${id!.toUpperCase()} · ${a.path.length} Felder · ${new Set(a.path.map((c) => c.face)).size} Seiten`
        : "";
    };
    view.base.onError = () =>
      status("Die 3D-Verbindung wurde unterbrochen. Bitte lade die Seite neu.");
    start(levels[progress.current - 1] ?? levels[0]);
    if (import.meta.env.DEV)
      Object.assign(window, {
        __surface: {
          get state() {
            return state;
          },
          get level() {
            return level;
          },
          get busy() {
            return busy;
          },
          get mistakes() {
            return mistakes;
          },
          moves: () => available(state, level.size),
          start: (id: number) => start(levels[id - 1]),
          view,
        },
      });
  } catch (e) {
    open(
      `<h2>Der Würfel konnte nicht starten.</h2><p>${escape(e instanceof Error ? e.message : "Unbekannter Fehler")}</p><p>Bitte lade die Seite erneut. Für die Darstellung wird WebGL benötigt.</p>`,
    );
  }
}
void boot();
