# instacli

Instagram CLI using the Meta Graph API. Post photos, carousels, reels and stories from your terminal.

## Setup

### 1. Instagram Account vorbereiten

Dein Instagram Account muss ein **Business** oder **Creator** Account sein.

1. Instagram App öffnen -> Profil -> Hamburger Menu (☰) -> **Settings and privacy**
2. **Account type and tools** -> **Switch to professional account**
3. Wähle **Creator** oder **Business** (beides funktioniert)
4. Kategorie auswählen (z.B. "Digital Creator", "Entrepreneur")
5. Fertig - dein Account ist jetzt ein Professional Account

### 2. Meta App erstellen

1. Gehe zu **https://developers.facebook.com/**
2. Oben rechts: **My Apps** -> **Create App**
3. **Use case**: **"Manage messaging & content on Instagram"**
4. App einem **Business Portfolio** zuordnen (Pflicht für Unified Login)
5. **App name**: z.B. `instacli` -> **Create App**

> instacli unterstützt zwei Login-Varianten. Neue Meta Apps bekommen nur noch **Unified Login**
> (empfohlen). **Instagram Login** ist bei Meta "legacy" und nur für bestehende Apps relevant.
> Details & Vergleich: [docs/authentication.md](docs/authentication.md)

### 3. Unified Login konfigurieren (empfohlen)

1. **Use cases** -> **Manage messaging & content on Instagram** -> **Customize** -> **API setup with Unified login**
2. **Create new configuration**:
   - Permissions: `instagram_basic`, `instagram_content_publish` (für DMs zusätzlich `instagram_manage_messages`)
   - Token-Ablauf: **Never**
3. **Redirect URL**: `https://localhost/` -> **Save**
4. **Configuration ID** notieren
5. **App settings -> Basic**: **Meta App ID** und **App Secret** notieren (NICHT die Instagram App ID)
6. Im Dev Mode: Deinen Instagram Account unter **Generate access tokens** als Instagram Tester hinzufügen und
   die Einladung auf instagram.com annehmen (Settings -> Website permissions -> Apps and websites -> Tester Invites)

Falls nach dem Login kein Instagram Account gefunden wird: `business_management` zur Configuration hinzufügen
(siehe [docs/authentication.md](docs/authentication.md)).

### 4. instacli auth setup

```bash
instacli auth setup --login unified
```

1. Meta App ID, App Secret und Configuration ID eingeben
2. Die generierte URL im Browser öffnen, mit Instagram oder Facebook einloggen, Business Portfolio + Instagram Account wählen
3. Du wirst zu `https://localhost/?code=XXXX` weitergeleitet (Browser-Fehler ist normal)
4. Die komplette URL (oder nur den `code`) einfügen
5. instacli tauscht den Code gegen einen System-User-Token, wählt den Instagram Account und speichert alles

Alternativ einen im Dashboard generierten Token setzen: `instacli auth token --login unified`

### 5. (Legacy) Instagram Login

Nur für bestehende Apps mit **"Instagram API with Instagram Login"**: Instagram App ID/Secret unter
**API setup with Instagram Login**, Redirect URI `https://localhost`, Permissions `instagram_business_basic`,
`instagram_business_content_publish`, `instagram_business_manage_messages`. Dann:

```bash
instacli auth setup --login instagram
```

Bestehende Configs ohne `login_type` laufen automatisch als Instagram Login weiter.

### 6. Testen

```bash
# Account-Info anzeigen
instacli me

# Auth-Status prüfen
instacli auth status
```

## Usage

### Posts

```bash
# Foto posten
instacli post photo foto.jpg --caption "Mein erstes CLI-Post! 🚀"

# Carousel (Album)
instacli post carousel bild1.jpg bild2.jpg bild3.jpg --caption "Album Post"

# Reel
instacli post reel video.mp4 --caption "Reel Caption #hashtag"
```

### Stories

```bash
instacli story photo story.jpg
instacli story video story.mp4
```

### Media verwalten

```bash
# Letzte Posts auflisten
instacli media ls
instacli media ls --limit 20

# Post-Details und Insights
instacli media info <media-id>

# Post löschen
instacli media delete <media-id>
```

### Account

```bash
instacli me
instacli me --json
```

### Auth

```bash
instacli auth status       # Login-Typ und Token-Status prüfen
instacli auth refresh      # Token erneuern (nur Instagram Login, alle 60 Tage)
```

## Token Refresh

**Unified Login:** Der System-User-Token läuft mit Ablauf "Never" nicht ab. Bei einer Configuration mit Ablauf
muss `instacli auth setup --login unified` vor Ablauf erneut ausgeführt werden.

**Instagram Login (legacy):** Long-lived Tokens laufen nach **60 Tagen** ab. Erneuere sie rechtzeitig:

```bash
instacli auth refresh
```

Tipp: Einen Cron-Job einrichten der alle 50 Tage `instacli auth refresh` aufruft.

## Technische Details

- Unified Login: **graph.facebook.com v27.0**; Instagram Login (legacy): **graph.instagram.com v22.0**
- Lokale Dateien werden temporär auf **file.io** hochgeladen (auto-expire nach Download)
- Config wird in `~/.instacli/config.json` gespeichert
- Video-Uploads: Container-Status wird gepollt bis FINISHED (max 60s)
- Carousels: Max 10 Medien pro Post

## Unterstützte Medienformate

| Typ | Formate |
|-----|---------|
| Foto | JPEG, PNG |
| Video/Reel | MP4, MOV |
| Max Dateigröße | 8MB (Foto), 100MB (Video) |
| Video Dauer | 3s - 60min (Reel), max 60s (Story) |

## Voraussetzungen

- Node.js v20+
- Instagram Business oder Creator Account
- Meta Developer App (im Business Portfolio) mit `instagram_content_publish` (Unified) bzw. `instagram_business_content_publish` (legacy)
