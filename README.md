# Fiszki – nauka angielskich słówek

Progresywna aplikacja webowa (PWA) do nauki angielskiego słownictwa za
pomocą fiszek. Działa w pełni lokalnie w przeglądarce — bez konta, bez
własnego backendu, z danymi przechowywanymi w IndexedDB na urządzeniu.
Interfejs jest po polsku, nauczane słownictwo jest angielskie.

## Funkcje

- **Talie i fiszki** – tworzenie, edycja i usuwanie talii oraz fiszek
  (słowo angielskie, tłumaczenie polskie, przykładowe zdanie, część mowy,
  notatka). Ręczne dodawanie z podpowiedzią tłumaczenia w locie.
- **Dodawanie słówek ze zdjęcia** – zrób zdjęcie (aparat) lub wybierz z
  galerii, aplikacja rozpoznaje tekst (OCR), wyodrębnia unikalne słowa
  (pomijając liczby, znaki specjalne i bardzo popularne słowa, z
  lematyzacją), pokazuje listę kandydatów z checkboxami do zaznaczenia,
  edycji i wskazania talii docelowej, a dla zaznaczonych automatycznie
  dociąga tłumaczenie i przykładowe zdanie.
  - Dwie metody OCR za wspólnym interfejsem: **Tesseract.js** (domyślna,
    lokalnie w przeglądarce, offline) oraz **model wizyjny przez API**
    (wymaga własnego klucza API wpisanego w Ustawieniach, przechowywanego
    tylko lokalnie). Zdjęcie nigdy nie jest wysyłane na zewnątrz bez
    wyraźnego potwierdzenia w UI.
- **Nauka** – powtórki algorytmem **SM-2**, oceny Nie pamiętam / Trudne /
  Dobrze / Łatwo, tryb klasycznej fiszki (odwracanie) i tryb wpisywania
  odpowiedzi, kierunek EN→PL lub PL→EN, konfigurowalne dzienne limity
  nowych kart i powtórek, wymowa przez Web Speech API.
- **Statystyki** – liczba fiszek, dzisiejsze powtórki, seria dni (streak),
  procent poprawnych odpowiedzi.
- **Eksport / import** danych talii do JSON i CSV (Ustawienia).
- **Udostępnianie talii bez backendu** – link (dane skompresowane w
  fragmencie URL), plik `.json` (Web Share API lub pobranie), kod QR dla
  małych talii. Import zawsze pokazuje podgląd przed dodaniem i pozwala
  dodać jako nową talię, scalić (pomijając duplikaty) albo anulować.
  Udostępniane są wyłącznie dane fiszek — nigdy postępy nauki, statystyki
  ani klucze API.
- **PWA** – działa offline (poza funkcjami wymagającymi internetu:
  automatyczne tłumaczenia, model wizyjny OCR), instalowalna na telefonie
  i komputerze, motyw jasny/ciemny.

## Struktura projektu

```
src/
  db/         warstwa IndexedDB (talie, fiszki, powtórki, ustawienia)
  srs/        algorytm SM-2
  ocr/        interfejs OCR, silniki (Tesseract.js / API), ekstrakcja słów
  translate/  podpowiedzi tłumaczeń i przykładowych zdań
  share/      serializacja, kompresja, walidacja, QR, CSV
  ui/         komponenty, widoki, router, motyw, powiadomienia
  main.ts     start aplikacji, rejestracja tras
```

## Uruchomienie lokalne

Wymagany Node.js 20+ (testowano na Node 22).

```bash
npm install
npm run dev
```

Aplikacja domyślnie działa pod `http://localhost:5173`. Na telefonie w tej
samej sieci lokalnej otwórz adres IP komputera z tym samym portem, aby
przetestować kamerę/OCR na urządzeniu mobilnym (wymagane HTTPS lub
`localhost`, by działały niektóre API przeglądarki — do lokalnych testów
zwykle wystarczy `localhost`).

## Testy

```bash
npm test
```

Testy jednostkowe (Vitest) pokrywają m.in.:

- algorytm SM-2 (`src/srs/sm2.test.ts`),
- ekstrakcję i lematyzację słów z tekstu OCR (`src/ocr/textProcessing.test.ts`),
- serializację/kompresję/import/walidację udostępnianych talii, w tym
  błędne i złośliwe dane wejściowe (`src/share/share.test.ts`),
- eksport/import CSV (`src/share/csv.test.ts`).

## Lint i typy

```bash
npm run lint
npm run typecheck
```

## Build produkcyjny

```bash
npm run build
npm run preview   # podgląd builda lokalnie
```

## Wdrożenie (GitHub Pages)

Workflow `.github/workflows/deploy.yml` buduje aplikację i publikuje
zawartość `dist/` na GitHub Pages po zmergowaniu do `main`.

**Kroki do wykonania ręcznie w ustawieniach repozytorium (jednorazowo):**

1. Wejdź w **Settings → Pages**.
2. W sekcji **Build and deployment → Source** wybierz **GitHub Actions**.
3. Po pierwszym uruchomieniu workflow na `main` aplikacja będzie dostępna
   pod `https://<użytkownik-lub-organizacja>.github.io/<nazwa-repozytorium>/`.

Ścieżka bazowa (`base` w Vite) jest ustawiana automatycznie przez workflow
na `/<nazwa-repozytorium>/`, więc nie trzeba nic zmieniać w kodzie.

## Prywatność i dane

- Wszystkie dane (talie, fiszki, postępy nauki, ustawienia, ewentualny
  klucz API) są przechowywane wyłącznie lokalnie w przeglądarce
  (IndexedDB). Nie ma konta ani serwera aplikacji.
- Zdjęcia używane do OCR nie są nigdzie wysyłane, chyba że świadomie
  wybierzesz metodę „model wizyjny (API)” w Ustawieniach — wtedy przed
  każdą wysyłką pojawia się potwierdzenie.
- Funkcje wymagające internetu: automatyczne tłumaczenia (MyMemory API),
  OCR modelem wizyjnym (jeśli wybrany), pobranie danych językowych
  Tesseract.js przy pierwszym użyciu.

## Do sprawdzenia ręcznie

- Działanie aparatu i wyboru zdjęcia z galerii na prawdziwym urządzeniu
  mobilnym (w środowisku deweloperskim testowano przepływ przez wgrywanie
  plików w przeglądarce desktopowej).
- Jakość OCR na różnych typach zdjęć (książka, menu, tablica) oraz sensowność
  wyodrębnionych kandydatów.
- Wywołanie własnego klucza API modelu wizyjnego (metoda niedostępna bez
  klucza w tym środowisku deweloperskim — brak dostępu do zewnętrznych API
  podczas budowy).
- Web Share API (udostępnianie pliku/linku) na urządzeniach, które go
  wspierają (głównie mobilne przeglądarki) — na desktopie zwykle działa
  fallback do pobrania pliku/kopiowania linku.
- Skanowanie wygenerowanego kodu QR prawdziwym telefonem.
- Wygląd i działanie service workera / trybu offline po zainstalowaniu PWA.

## Znane ograniczenia

- Bundle zawierający Tesseract.js jest stosunkowo duży (~1,7 MB przed
  gzip), ale jest ładowany leniwie (dynamiczny import) dopiero przy wejściu
  w ekran skanowania zdjęcia — nie wpływa na czas pierwszego ładowania
  reszty aplikacji.
- Automatyczne tłumaczenia korzystają z darmowego API MyMemory, które ma
  dzienne limity zapytań dla niezalogowanych użytkowników — przy bardzo
  intensywnym użyciu tłumaczenia mogą czasowo przestać się pobierać (słowo
  nadal można zapisać i uzupełnić tłumaczenie ręcznie).
- Metoda OCR „model wizyjny” zakłada API zgodne z Anthropic Messages API
  (patrz `ASSUMPTIONS.md`) — inny dostawca wymagałby dostosowania
  parsowania odpowiedzi.
- Brak synchronizacji między urządzeniami — dane są lokalne dla
  przeglądarki/urządzenia; jedynym sposobem przenoszenia talii jest ręczne
  udostępnianie (link/plik/QR).

## Pomysły na rozwój

- Import talii bezpośrednio z plików eksportu Anki (`.apkg`).
- Natywna wersja mobilna (np. Capacitor/Tauri) korzystająca z tej samej
  logiki domenowej.
- Synchronizacja między urządzeniami przez opcjonalne konto/backend.
- Więcej języków interfejsu i nauczanych par językowych (nie tylko EN↔PL).
- Historia i wykresy postępów w czasie (nie tylko bieżące statystyki).
- Tryb egzaminu/testu z wielokrotnym wyborem generowany z talii.
- Wsparcie dla wielu talii jednocześnie w jednej sesji nauki z priorytetami.
