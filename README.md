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
3. **Use cases**: Wähle **"Other"** -> **Next**
4. **App type**: Wähle **"Business"** -> **Next**
5. **App name**: z.B. `instacli` oder `Instagram CLI`
6. **App contact email**: Deine Email
7. **Create App** klicken

### 3. Instagram API aktivieren

1. In der App: Linke Sidebar -> **Add Product**
2. Suche **"Instagram"** -> **Set Up** klicken
3. Wähle **"Instagram API with Instagram Login"**
4. Unter **Settings** (links): **Instagram API with Instagram Login** -> **Permissions**
5. Folgende Permissions hinzufügen:
   - `instagram_business_basic` (sollte schon aktiv sein)
   - `instagram_business_content_publish`
   - `instagram_business_manage_messages`

### 4. Redirect URI konfigurieren

1. In der App: **Instagram API with Instagram Login** -> **Settings**
2. Unter **OAuth Settings**:
   - **Valid OAuth Redirect URIs**: `https://localhost`
   - **Deauthorize Callback URL**: (leer lassen)
   - **Data Deletion Request URL**: (leer lassen)
3. **Save Changes**

### 5. App ID und Secret notieren

1. In der App: Linke Sidebar -> **App Settings** -> **Basic**
2. Kopiere:
   - **App ID** (öffentlich sichtbar)
   - **App Secret** (auf "Show" klicken, Passwort eingeben)

### 6. instacli auth setup

```bash
instacli auth setup
```

Das Tool führt dich durch den Rest:
1. App ID eingeben
2. App Secret eingeben
3. Eine URL wird generiert - diese im Browser öffnen
4. Instagram Login + Autorisierung durchführen
5. Du wirst zu `https://localhost?code=XXXX#_` weitergeleitet
6. Den `code` Parameter aus der URL kopieren und einfügen
7. Token wird automatisch ausgetauscht und gespeichert

**Hinweis:** Die Weiterleitung zu `https://localhost` wird einen Fehler im Browser zeigen (ERR_CONNECTION_REFUSED) - das ist normal! Du brauchst nur den `code=...` Parameter aus der URL-Leiste.

### 7. Testen

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
instacli auth status       # Token-Status prüfen
instacli auth refresh      # Token erneuern (alle 60 Tage)
```

## Token Refresh

Long-lived Tokens laufen nach **60 Tagen** ab. Erneuere sie rechtzeitig:

```bash
instacli auth refresh
```

Tipp: Einen Cron-Job einrichten der alle 50 Tage `instacli auth refresh` aufruft.

## Technische Details

- Nutzt die **Instagram Graph API v22.0** (offiziell, Meta-konform)
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
- Meta Developer App mit `instagram_business_content_publish` Permission
