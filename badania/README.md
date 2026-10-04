# Badania: jaki układ wnętrz jest ciekawy dla gracza

Gałąź `badania/nowy-algorytm`. Celem jest zaprojektowanie generatora lepszego niż obecny potok „pokoje + Recursive Backtracker + obróbka”. Badania mają dwie części:

1. **Przegląd**: co projektanci gier i literatura PCG mówią o ciekawych lochach i labiryntach.
2. **Pomiary**: porównanie 7 algorytmów labiryntu i wariantów obróbki na naszym oceniaczu (`badania/benchmark.js`, wyniki w [`wyniki.md`](wyniki.md)).

Na końcu jest projekt nowego algorytmu i plan kolejnych eksperymentów.

---

## 1. Co sprawia, że wnętrze jest ciekawe

### 1.1. Pętle zamiast drzewa

Labirynt idealny (drzewo) ma dokładnie jedną drogę między dwoma punktami. Dla gracza oznacza to ciągłe cofanie się po własnych śladach i brak decyzji taktycznych.

- **„Jaquaying the Dungeon”** (Justin Alexander, 2010). Analiza lochów Jennell Jaquays: wiele pętli, wiele wejść do poziomu, połączenia pomiędzy piętrami, sekretne przejścia. Gracz może wybrać trasę, obejść zagrożenie, wycofać się inną drogą.
- **Cykliczne generowanie lochów** (Joris Dormans, *Unexplored*, 2017). Loch składa się z cykli: od startu do celu prowadzą dwie ścieżki, na jednej jest zamek, na drugiej klucz, potem zagnieżdża się kolejne cykle. Pętla ma więc funkcję fabularną, a nie jest przypadkiem.
- **Brogue** (Brian Walker). Po zbudowaniu mapy dodaje przejścia tam, gdzie dwa sąsiednie miejsca są daleko od siebie w grafie ścieżek. Pętla powstaje tylko wtedy, gdy realnie skraca drogę.

### 1.2. Struktura misji przed geometrią

- **Misje i przestrzenie** (Joris Dormans, *Adventures in level design: generating missions and spaces for action adventure games*, 2010). Najpierw powstaje graf misji (start, klucz, zamek, boss, nagroda), dopiero potem przestrzeń, która go realizuje. Dzięki temu poziom ma ścieżkę krytyczną, opcjonalne odnogi i zaplanowane cofanie.
- **Spelunky** (Derek Yu, *Spelunky*, Boss Fight Books 2016). Najpierw wyznaczana jest gwarantowana ścieżka przez siatkę pomieszczeń, a potem reszta jest wypełniana szablonami. Grywalność wynika z gwarancji ścieżki, a różnorodność z szablonów.

### 1.3. Orientacja: punkty orientacyjne i dzielnice

Kevin Lynch (*The Image of the City*, 1960) opisał, jak ludzie budują mapę mentalną: ścieżki, krawędzie, dzielnice, węzły i punkty orientacyjne. Labirynt z jednolitą fakturą nie ma żadnego z tych elementów, więc gracz się gubi, a nie eksploruje. Wnioski:

- różne obszary mapy powinny mieć różny charakter (inna faktura korytarzy, inne typy pokoi),
- skrzyżowania i duże pomieszczenia powinny być rozpoznawalne (poszerzenie, hala, filar),
- sąsiednie pokoje nie powinny wyglądać tak samo.

### 1.4. Tempo i linie wzroku

- Naprzemienność napięcia i odprężenia: ciasny korytarz → otwarte pomieszczenie → korytarz. Ten wzorzec opisują m.in. analizy Half-Life i Dooma.
- Długi prosty korytarz to martwy czas dla gracza i otwarta linia strzału dla przeciwnika. Bardzo krótkie odcinki z kolei uniemożliwiają zobaczenie czegokolwiek z wyprzedzeniem.
- Każdy ślepy zaułek powinien coś dawać (skrzynia, sekret, widok). Pusty zaułek to kara za eksplorację.
- Skróty otwierane od drugiej strony (np. *Dark Souls*) nagradzają eksplorację i skracają powrót do bazy.

### 1.5. Pomiar jakości generatora

- **Expressive range** (Gillian Smith i Jim Whitehead, *Analyzing the expressive range of a level generator*, 2010). Generatora nie ocenia się po jednym poziomie, tylko po rozkładzie cech wielu poziomów (np. histogram 2D liniowość × trudność). Pokazuje, czy generator ma szeroki zakres, czy produkuje wariacje jednego układu.
- **Ogólne miary poziomów** (Antonios Liapis, Georgios Yannakakis i Julian Togelius, *Towards a generic method of evaluation of game levels*, 2013). Miary oparte na przestrzeni nawigowalnej: bezpieczeństwo zasobów, łatwość eksploracji, równowaga.

### 1.6. Faktura labiryntu

Jamis Buck (*Mazes for Programmers*, 2015) opisuje, że każdy algorytm labiryntu ma charakterystyczną fakturę. Backtracker daje długie kręte korytarze, Prim krótkie odnogi, Kruskal i Wilson są „neutralne”, a Binary Tree ma silne ukierunkowanie po przekątnej. Faktura jest więc parametrem projektowym, a nie szczegółem implementacji. Sprawdziliśmy to na naszych mapach w części 2.

---

## 2. Pomiary

Do `core.js` dodałem rejestr `MAZES` z 7 algorytmami (parametr `P.maze`): `backtracker` (domyślny, wyniki identyczne jak przed zmianą), `huntAndKill`, `growingMix` (Growing Tree 75% najnowsza / 25% losowa komórka), `wilson`, `kruskal`, `prim` i `binaryTree`. Dodałem też tryb pętli `P.loopMode = 'shortcut'`. Wszystkie liczby pochodzą z [`wyniki.md`](wyniki.md): mapa 41×41, 300 ziaren na wariant.

### 2.1. Faktura czystego labiryntu (tabela A)

| | Zaułki | Rozwidlenia | Krętość |
|---|---|---|---|
| backtracker | 11% | 10% | 6.57 |
| huntAndKill | 10% | 9% | 4.39 |
| growingMix | 17% | 16% | 3.42 |
| wilson / kruskal | ~30% | ~25% | 2.6–2.8 |
| prim | 28% | 25% | 1.91 |

- Algorytmy układają się na jednej osi: od **krętych z małą liczbą decyzji** (backtracker, hunt-and-kill) do **krótkich odnóg z dużą liczbą zaułków** (prim, kruskal, wilson). Growing Tree pozwala płynnie przesuwać się po tej osi jednym parametrem.
- Backtracker sam w sobie jest dla gracza bardzo męczący: droga między dwoma punktami jest średnio 6.6 razy dłuższa niż w linii prostej.

### 2.2. Pełny potok (tabela B)

| | Śr. ocena | ≥ 85 pkt |
|---|---|---|
| growingMix | 90.5 | 85% |
| huntAndKill | 89.3 | 79% |
| backtracker | 88.7 | 75% |
| wilson | 84.8 | 58% |
| kruskal | 83.6 | 43% |
| binaryTree | 80.1 | 15% |
| prim | 79.3 | 11% |

- Obróbka (przerzedzenie, zaułki, pętle) wyrównuje dużą część różnic: krętość backtrackera spada z 6.6 do 2.3.
- Najlepiej wypada **growingMix**, bo łączy długie korytarze z większą liczbą rozwidleń. Prim i Kruskal tracą głównie przez nadmiar zaułków (1.4–1.5 na pokój), Binary Tree przez bardzo długie proste (85% boku mapy).

### 2.3. Pętle i zaułki (tabela C)

- Najlepszy obszar to ok. **10% pętli**. Przy 0% krętość wynosi 3.2, przy 30% korytarze robią się zbyt otwarte i ocena znów spada.
- Suwak „Usuń zaułki” ma mały wpływ na ocenę (±2 pkt). Zaułki są zjadane już przy przerzedzeniu.

### 2.4. Pętle-skróty zamiast losowych (tabela E)

| | Losowe | Skróty |
|---|---|---|
| backtracker: ocena | 88.9 | **92.8** |
| backtracker: krętość | 2.34 | **1.97** |
| backtracker: pokoje w pętlach | 42% | **50%** |

Przy tej samej liczbie otwartych ścian pętle wybierane jak w Brogue (otwieraj tam, gdzie strony są najdalej od siebie w grafie) dają +4 pkt i wyraźnie krótsze trasy. Efekt jest największy dla krętych algorytmów i znika dla Kruskala, który i tak ma krótkie trasy. Koszt to ok. 2 ms więcej na układ. To pierwszy element do przeniesienia do nowego algorytmu.

### 2.5. Długie proste

To najsłabsza cecha we wszystkich wariantach: tylko 5% układów mieści się w celu (≤ 35% boku mapy). Diagnoza:

- najdłuższy prosty odcinek ma medianę 19 kafli już po etapie labiryntu, a późniejsze etapy prawie go nie zmieniają,
- w 31% map ponad połowa tego odcinka biegnie wzdłuż ściany pokoju (pokoje z odstępem 1 komórki tworzą wąskie przesmyki, w których korytarz nie ma jak skręcić),
- bez pokoi mediana spada do 17 kafli.

Wnioski: (a) pokoje trzeba rozstawiać z odstępem 1 *lub więcej* komórek albo przesmyki wypełniać inaczej; (b) sama miara jest zbyt surowa i powinna mierzyć linię wzroku (ile kafli widać z danego miejsca), a nie najdłuższy ciąg kafli.

### 2.6. Słabości obecnego oceniacza (tabela D)

- **Nasycenie**: rozłożenie pokoi daje 100% w 100% układów, skrzyżowania w 96%, entropia kształtów w 98%, drzwi w 92%. Te cechy prawie niczego nie rozróżniają.
- **Brak semantyki**: oceniacz nie wie, gdzie jest start i cel, nie mierzy ścieżki krytycznej, cofania ani tempa.
- **Pętle liczone, nie oceniane**: pętla 2-kafelkowa obok innej pętli liczy się tak samo jak skrót przez pół mapy.
- **Unikalność tylko przestrzenna**: dwa układy o różnym rozkładzie pokoi, ale tej samej strukturze grafu (np. liniowy korytarz z odnogami), uchodzą za różne.

---

## 3. Projekt nowego algorytmu: „Cykle i role”

Roboczy pomysł łączący wnioski z części 1 i 2. Wszystkie etapy są do zweryfikowania na tym samym zestawie pomiarów.

### 3.1. Etapy

1. **Graf misji.** Start, cel i 1–3 cykle według wzorców Dormansa:
   - *zamek i klucz*: dwie ścieżki do celu, na jednej drzwi zamknięte, na drugiej klucz,
   - *skrót*: jednokierunkowe przejście z głębi poziomu z powrotem do węzła-centrum,
   - *odnoga z nagrodą*: krótki opcjonalny zaułek kończący się pokojem skarbu.
2. **Role pokoi.** Każdy węzeł grafu dostaje rolę i rozmiar: centrum 4×3, boss 3×4, skarb 2×4, zwykły 3×3. Rola wyznacza też rodzaj drzwi, poszerzenia przed wejściem i dekoracje.
3. **Osadzenie na siatce.** Pokoje rozstawiane tak, żeby odległości na siatce odpowiadały odległościom w grafie misji (np. relaksacja siłowa na komórkach logicznych). Minimalny odstęp 2 komórki, żeby nie powstawały wąskie proste przesmyki.
4. **Korytarze ścieżki krytycznej.** Krawędzie grafu misji prowadzone A* po komórkach logicznych, z kosztem za długie proste i losowym szumem. Daje to kontrolowaną krętość zamiast przypadkowej.
5. **Dzielnice o różnej fakturze.** Wolne obszary wypełniane labiryntem, ale z różnym algorytmem w różnych częściach mapy (np. `growingMix` przy centrum, `prim` w strefie piwnic). Gracz rozpoznaje, gdzie jest, po samym charakterze korytarzy.
6. **Pętle-skróty.** Otwierane według odległości w grafie, jak w eksperymencie 2.4, z limitem na liczbę i minimalnym zyskiem.
7. **Zaułki z nagrodą.** Każdy pozostały zaułek dostaje rolę (skrzynia, sekret, punkt widokowy) albo jest zasypany.
8. **Poszerzenia z sensem.** Przed pokojem bossa, na skrzyżowaniach przy centrum (punkty orientacyjne), a nie losowo.

### 3.2. Ocena v2

Nowe cechy, które da się policzyć dopiero, gdy znamy start, cel i role:

| Cecha | Co mierzy |
|---|---|
| Długość ścieżki krytycznej | droga start → cel w stosunku do rozmiaru mapy |
| Cofanie | ile kafli gracz musi przejść drugi raz (klucz → zamek) |
| Wartość skrótów | suma skróceń drogi dzięki pętlom |
| Tempo | czy wzdłuż ścieżki krytycznej korytarze i pokoje się przeplatają |
| Linie wzroku | rozkład długości widoczności zamiast jednej najdłuższej prostej |
| Punkty orientacyjne | czy pokoje w odległości N kroków różnią się rolą lub rozmiarem |
| Zaułki z nagrodą | odsetek zaułków, które mają rolę |
| Expressive range | rozkład 2D (liniowość × krętość) dla 1000 ziaren, porównywany między wersjami |

---

## 4. Plan

- [x] Rejestr algorytmów labiryntu w `core.js` i pomiar ich faktury
- [x] Pomiar wpływu pętli i zaułków
- [x] Eksperyment: pętle-skróty kontra losowe (wynik: +4 pkt dla backtrackera)
- [x] Diagnoza długich prostych
- [ ] Miara linii wzroku zamiast najdłuższej prostej, mniej nasycone progi w oceniaczu
- [ ] Odstęp między pokojami 2 komórki i ponowny pomiar długich prostych
- [ ] Prototyp etapów 1–4 (graf misji → rozstawienie pokoi → korytarze A*)
- [ ] Dzielnice o różnej fakturze
- [ ] Ocena v2 i wykres expressive range dla starego i nowego generatora

## Jak powtórzyć pomiary

```bash
node badania/benchmark.js 300   # ok. 10 s, nadpisuje badania/wyniki.md
```
