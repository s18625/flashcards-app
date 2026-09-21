# Założenia i decyzje projektowe

Ten dokument opisuje założenia przyjęte podczas budowy aplikacji, tam gdzie
specyfikacja pozostawiała swobodę wyboru, oraz uzasadnienie kluczowych
decyzji technologicznych.

## Stos technologiczny

- **Vite + TypeScript, bez frameworka UI (bez React).** Aplikacja jest
  stosunkowo prostym SPA z kilkunastoma widokami i lokalnym stanem
  ograniczonym głównie do zawartości IndexedDB. Framework typu React dodałby
  narzut (runtime, JSX, bundlowanie) bez realnej korzyści przy tej skali —
  routing oparty o hash i ręczne budowanie DOM (`src/ui/dom.ts`, helper `h()`
  w stylu hyperscript) w zupełności wystarczają, a finalny bundle jest
  mniejszy i szybciej się ładuje na urządzeniach mobilnych. Zgodnie z
  poleceniem, gdyby React był potrzebny (np. do złożonego stanu
  współdzielonego między wieloma widokami), tutaj taka potrzeba się nie
  pojawiła.
- **idb** – lekki wrapper Promise nad IndexedDB (zamiast pisać surowe API
  IndexedDB ręcznie).
- **lz-string** – kompresja danych talii do fragmentu URL przy udostępnianiu
  linkiem.
- **qrcode** – generowanie kodów QR po stronie klienta.
- **tesseract.js** – domyślny, darmowy i działający offline (po pierwszym
  pobraniu danych językowych) silnik OCR.
- **wink-lemmatizer** – prosta, w pełni działająca w przeglądarce
  lematyzacja angielskich słów (bez wywołań sieciowych).
- **vite-plugin-pwa** – generowanie manifestu PWA i service workera
  (tryb `generateSW`) zamiast ręcznego pisania service workera.

## OCR – dwie metody za wspólnym interfejsem

`src/ocr/types.ts` definiuje interfejs `OcrEngine`, zaimplementowany przez:

1. `TesseractOcrEngine` (domyślny) – rozpoznawanie w przeglądarce przez
   Tesseract.js, język angielski, bez wysyłania zdjęcia gdziekolwiek.
   Tesseract.js pobiera plik `traineddata` i workera z CDN przy pierwszym
   użyciu – to jedyny moment wymagający internetu; oba pliki są potem
   cache'owane przez service worker (`runtimeCaching` w `vite.config.ts`),
   więc kolejne użycia działają offline.
2. `VisionApiOcrEngine` – wywołanie zewnętrznego API modelu wizyjnego.
   Domyślny endpoint to **Anthropic Messages API**
   (`https://api.anthropic.com/v1/messages`, nagłówek
   `anthropic-dangerous-direct-browser-access: true`, który Anthropic
   udostępnia właśnie po to, by wołać API bezpośrednio z przeglądarki bez
   własnego backendu). Klucz API i endpoint są konfigurowalne w Ustawieniach
   i zapisywane wyłącznie w IndexedDB w tym urządzeniu – nigdzie indziej.
   Parsowanie odpowiedzi zakłada format Anthropic (`content[].text`); jeśli
   ktoś chce użyć innego dostawcy, endpoint musi zwracać zgodny format
   odpowiedzi.
   Przed każdą wysyłką zdjęcia do tego API aplikacja prosi o potwierdzenie
   (`window.confirm`) – zdjęcie nigdy nie opuszcza urządzenia bez wyraźnej
   zgody, zgodnie z wymaganiem.

Wybór metody: **domyślnie Tesseract.js**, przełącznik w Ustawieniach.

### Rozpoznawanie list słownictwa (formatu "wyrażenie /wymowa/ tłumaczenie")

Wiele podręcznikowych słowniczków drukuje słownictwo w formacie jednej linii
na wyrażenie, np. `take after sb /teɪk ˈɑːftə ˈsʌmbədi/ być podobnym do
kogoś`. Zwykła tokenizacja słowo-po-słowie rozjeżdżałaby taki wpis na
bezsensowne fragmenty (`take`, `after`, `sb`). `src/ocr/glossary.ts`
rozpoznaje ten format (szuka pary ukośników otaczających transkrypcję
fonetyczną, odróżniając je od ukośników użytych jako „lub” w treści
wyrażenia/tłumaczenia po analizie sąsiadujących białych znaków) i wyciąga
całe wyrażenie razem z gotowym tłumaczeniem z podręcznika — bez
odpytywania zewnętrznego API. Jeśli rozpoznany tekst nie wygląda na taki
słowniczek (za mało dopasowanych linii), aplikacja wraca do zwykłej
ekstrakcji słowo-po-słowie. Skróty-zastępniki `sb`/`sth`/`smb`/`smth`
używane w podręcznikach jako placeholder na dopełnienie są dodane do listy
stopwords, żeby nie pojawiały się jako osobne, bezsensowne kandydatury w
trybie ekstrakcji zwykłego tekstu.

## Tłumaczenia

- Podpowiedź tłumaczenia w formularzu ręcznego dodawania fiszki oraz
  tłumaczenie kandydatów ze zdjęcia korzystają z darmowego,
  nie wymagającego klucza **MyMemory Translation API**
  (`api.mymemory.translated.net`).
- Jeśli w Ustawieniach skonfigurowano klucz API modelu językowego (to samo
  pole co do OCR modelem wizyjnym), przykładowe zdania i tłumaczenia dla
  słów ze zdjęcia są dociągane przez ten model (wyższa jakość, zdanie
  przykładowe generowane przez LLM). Bez klucza aplikacja dociąga samo
  tłumaczenie z MyMemory, a pole przykładowego zdania pozostaje puste do
  ręcznego uzupełnienia — zgodnie z wymaganiem „pozwól zapisać samo słowo
  bez tłumaczenia” w przypadku braku internetu lub ograniczonych źródeł.
- Brak internetu podczas dodawania ze zdjęcia nie blokuje zapisu: kandydaci
  są zapisywani z pustymi tłumaczeniami, które można uzupełnić później.
- Podpowiedź tłumaczenia w formularzu ręcznego dodawania fiszki korzysta z
  tej samej funkcji `enrichWord`, co dodawanie ze zdjęcia: jeśli
  skonfigurowano klucz AI, tłumaczenie (i przykładowe zdanie, jeśli pole
  jest puste) pochodzi z modelu językowego, co radzi sobie znacznie lepiej
  z wyrażeniami wieloczłonowymi i idiomami niż tłumaczenie słowo-po-słowie
  z MyMemory.

## Foldery talii

Talie można opcjonalnie przypisać do folderu (encja `Folder` w
`src/db/folders.ts`), żeby segregować większą liczbę talii tematycznie.
Usunięcie folderu nie usuwa talii — tylko odpina je od folderu
(`folderId: null`). Talie bez folderu wyświetlane są w osobnej sekcji
„Bez folderu” (tylko gdy istnieje choć jeden folder — przy braku folderów
lista talii jest płaska, bez zbędnych nagłówków).

## Algorytm SM-2

- Oceny UI **Nie pamiętam / Trudne / Dobrze / Łatwo** mapowane są na skalę
  jakości SM-2 0–5 jako odpowiednio **0 / 3 / 4 / 5** (patrz
  `src/srs/sm2.ts`). Tylko „Nie pamiętam” (q < 3) resetuje serię powtórek,
  zgodnie z oryginalnym algorytmem SuperMemo-2.
- Odstępy: 1 dzień po pierwszej udanej powtórce, 6 dni po drugiej, dalej
  `poprzedni_odstęp × współczynnik_łatwości`, zaokrąglone do pełnych dni.
  Współczynnik łatwości nie spada poniżej 1,3 (standard SM-2).
- Odstępstwo od czystego SM-2: karta oceniona jako „Nie pamiętam” wraca po
  **10 minutach** (w ramach tej samej sesji), a nie dopiero następnego dnia
  — to standardowa praktyka w nowoczesnych aplikacjach SRS (Anki i
  pochodne), poprawiająca UX bez zmiany logiki obliczania współczynnika
  łatwości.

## Dzienne limity

- Limit **nowych kart dziennie** liczony jest dokładnie na podstawie
  historii powtórek: karta liczy się jako „nowa dzisiaj”, jeśli jej
  najwcześniejsza powtórka w całej historii przypada na dzisiaj
  (`countNewCardsStudiedToday` w `src/db/reviews.ts`). Działa poprawnie
  między wieloma sesjami tego samego dnia.
- Limit **powtórek dziennie** liczony jest jako `wszystkie powtórki dzisiaj
  − nowe karty dzisiaj`, czyli liczba powtórek kart już wcześniej
  poznanych.
- Kolejka sesji nauki przeplata nowe karty z powtórkami (mniej więcej co
  trzecia karta jest nowa), żeby nowe słówka nie trafiały wyłącznie na
  koniec sesji.

## Udostępnianie talii

- Wersja formatu (`formatVersion: 1`) w każdym eksporcie – import odrzuca
  nieznane/przyszłe wersje z czytelnym komunikatem.
- Udostępniane są wyłącznie pola treści fiszki (słowo, tłumaczenie, zdanie,
  część mowy, notatka) oraz nazwa/opis talii — nigdy postępy nauki (SM-2),
  statystyki, klucze API ani zdjęcia.
- Walidacja importu: sprawdzenie wersji formatu, struktury, twarde limity
  (maks. 2000 fiszek na talię, maks. 500 znaków na pole tekstowe, maks.
  120 znaków na nazwę talii, maks. rozmiar skompresowanego/JSON danych),
  usuwanie znaków `<`/`>` z pól tekstowych (obrona w głąb przed
  wstrzyknięciem HTML — mimo że UI i tak renderuje treści wyłącznie przez
  `textContent`, nigdy przez `innerHTML`).
- Próg wielkości dla kodu QR: **1200 znaków** skompresowanego ciągu — powyżej
  tej wartości kod QR staje się trudny do skutecznego zeskanowania
  telefonem, więc aplikacja proponuje wtedy link lub plik.
- Import przez kod QR nie wymaga wbudowanego skanera w aplikacji: kod QR
  koduje ten sam link co metoda „Link”, więc zeskanowanie go dowolną
  aplikacją aparatu w telefonie otwiera link, co uruchamia import w PWA.
- Talia docelowa podczas dodawania słówek ze zdjęcia jest wybierana
  **jedna dla całej partii kandydatów** (a nie osobno dla każdego słowa) —
  prostsze i bardziej naturalne UX przy skanowaniu jednej strony/zdjęcia,
  z możliwością zmiany talii przed zapisem.

## Inne uproszczenia

- Potwierdzenia usunięcia talii/fiszki korzystają z natywnego
  `window.confirm` zamiast dedykowanego komponentu modalnego — prostsze,
  dostępne z klawiatury i czytnika ekranu "za darmo", wystarczające dla
  MVP.
- Ekrany „Dodaj/Edytuj talię”, „Dodaj/Edytuj fiszkę”, „Udostępnij”,
  „Importuj” są osobnymi podstronami (nie oknami modalnymi) — naturalniejsze
  na urządzeniach mobilnych (przycisk „wstecz”, historia przeglądarki) i
  prostsze w implementacji bez frameworka.
- Lematyzacja (`wink-lemmatizer`) nie zgaduje części mowy — próbujemy kolejno
  reguł dla rzeczownika, czasownika i przymiotnika i wybieramy pierwszy
  wynik różny od formy wejściowej. To heurystyka wystarczająca do
  grupowania odmian tego samego słowa przy ekstrakcji kandydatów ze zdjęcia,
  nie jest to pełny tagger językowy.
- `npm audit` zgłasza podatności w zależnościach deweloperskich (serwer
  deweloperski Vite / interfejs Vitest UI) — dotyczą wyłącznie lokalnego
  środowiska deweloperskiego, nie trafiają do zbudowanej aplikacji
  produkcyjnej. Zalecane okresowe uruchamianie `npm audit fix`.
- Baza danych IndexedDB nie jest szyfrowana — to standardowe zachowanie
  przeglądarki dla danych lokalnych aplikacji bez backendu; klucz API jest
  przechowywany w tym samym mechanizmie co reszta ustawień.

## GitHub Pages / base path

`vite.config.ts` czyta zmienną środowiskową `BASE_PATH` (domyślnie `/`).
Workflow `.github/workflows/deploy.yml` ustawia ją na `/<nazwa-repo>/`
podczas builda przed publikacją na GitHub Pages, żeby ścieżki zasobów
działały poprawnie pod `https://<user>.github.io/<repo>/`.
