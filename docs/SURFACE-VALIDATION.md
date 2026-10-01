# Oberflächen-Puzzle – Prüfung am 01.10.2026

Die neue Standardfassung enthält fünf Würfel mit 9, 10, 14, 15 und 23 Pfeilbahnen. Insgesamt sind das 71 lange Bahnen; 66 davon überschreiten mindestens eine Körperkante. Die Pfade sind extern in `public/levels/surface.json` gespeichert.

## Ausgeführte Prüfungen

- **19 Logiktests bestanden**, davon sechs für das neue Oberflächenmodell: Nachbarbeziehungen aller sechs Seiten inklusive Kantenrückweg, Blockierungen durch fremde Bahnabschnitte, zyklische Blockaden, Parser, Lösungen aller fünf Würfel und reproduzierbare Reverse-Generation.
- **17 Browsertests bestanden**: sieben Regressionstests der bisherigen Version und zehn für die neue Fassung. Alle fünf neuen Würfel wurden vollständig über die Pfeilliste gelöst; Raycasting auf die sichtbare 3D-Bahn wurde separat geprüft.
- **Ein Produktionstest für Offline-Neustart bestanden**: nach vollständigem Laden Netzwerk deaktiviert, Seite neu geladen und die fünf Würfel in der Auswahl aufgerufen.
- TypeScript und Vite-Produktionsbuild erfolgreich.
- Desktop- und Mobilansichten visuell geprüft; mobiler Überlauf kontrolliert.

Die Browserprüfungen umfassen blockierte Auswahl, Drehgesten ohne versehentliches Entfernen, Verdeckung rückwärtiger Pfeile durch den Körper, Touch-Tap, Pinch und die unabhängigen Spielstände. Ein eigener Animationstest prüft, dass sich die Spitze tangential bewegt und die Bahn während des Herausziehens noch ihren geknickten Verlauf besitzt. Die vollständigen Lösungsdurchläufe verwenden reduzierte Bewegung, um die Tests kurz zu halten; der Animationstest nutzt die normale Bewegung.

## Bewegungsregel des Prototyps

Die Spitze verlässt ihre aktuelle Fläche auf einer geraden Tangente über die nächste Kante hinaus in den Raum. Andere belegte Felder auf dieser Austrittslinie blockieren. Der übrige Pfeil folgt als zusammenhängende Bahn seinem ursprünglichen Weg und danach der austretenden Spitze. Dies ist die für diesen Prototyp gewählte Regel; die Bildvorlagen allein legen den Bewegungsablauf nicht eindeutig fest.

## Verbleibende Grenzen

- Bisher Würfel; noch keine Quader oder abgewinkelten Körper.
- Fünf neue Level zur Erprobung, noch keine neue 100-Level-Kampagne.
- Der Editor der früheren Version bearbeitet weiterhin nur deren Punktepfeile.
- Chromium unter Linux, Software-WebGL und emulierte Touch-Eingaben ersetzen keine abschließende Prüfung auf realen iOS-/Android-Geräten.
- Spielspaß und Schwierigkeitskurve benötigen menschliche Erprobung.

Die frühere Kampagne und ihr Prüfbericht bleiben als gesonderte Fassung erhalten.
