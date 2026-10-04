# Wyniki pomiarów

Wygenerowane przez `node badania/benchmark.js 300`. Mapa 41×41 kafli (20×20 komórek), 300 ziaren na wariant.

## A. Faktura czystego labiryntu (bez pokoi i obróbki)

| Algorytm | Zaułki | Proste | Zakręty | Rozwidlenia | Śr. prosta (kom.) | Krętość | Średnica / pola |
|---|---|---|---|---|---|---|---|
| backtracker | 11% | 32% | 48% | 10% | 2.73 | 6.57 | 0.50 |
| huntAndKill | 10% | 31% | 50% | 9% | 2.68 | 4.39 | 0.32 |
| growingMix | 17% | 26% | 41% | 16% | 2.74 | 3.42 | 0.25 |
| wilson | 29% | 18% | 28% | 25% | 2.88 | 2.82 | 0.20 |
| kruskal | 30% | 17% | 27% | 26% | 2.87 | 2.56 | 0.18 |
| prim | 28% | 26% | 21% | 25% | 3.18 | 1.91 | 0.12 |
| binaryTree | 25% | 27% | 23% | 25% | 3.09 | 2.53 | 0.15 |

## B. Pełny potok (domyślne parametry), ocena obecnym oceniaczem

| Algorytm | Śr. ocena | Mediana | ≥ 85 pkt | = 100 pkt | loops | dead | lin | tort | str | junc | cov | door | ent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| backtracker | 88.7 | 90 | 75% | 1% | 1.42 | 0.25 | 42% | 2.31 | 46% | 17% | 100% | 1.67 | 69% |
| huntAndKill | 89.3 | 90 | 79% | 2% | 1.50 | 0.42 | 42% | 2.21 | 46% | 19% | 100% | 1.67 | 72% |
| growingMix | 90.5 | 92 | 85% | 2% | 1.58 | 0.58 | 50% | 2.11 | 41% | 21% | 100% | 1.75 | 76% |
| wilson | 84.8 | 85 | 58% | 0% | 2.00 | 1.33 | 58% | 1.87 | 46% | 27% | 100% | 1.83 | 84% |
| kruskal | 83.6 | 84 | 43% | 0% | 2.08 | 1.42 | 58% | 1.84 | 41% | 29% | 100% | 1.92 | 85% |
| prim | 79.3 | 80 | 11% | 0% | 2.08 | 1.50 | 50% | 1.77 | 56% | 29% | 100% | 1.83 | 86% |
| binaryTree | 80.1 | 80 | 15% | 0% | 2.00 | 1.25 | 58% | 1.91 | 85% | 28% | 100% | 1.83 | 82% |

W kolumnach cech podana jest mediana surowej wartości (nie punktów).

## C. Wpływ „Usuń zaułki” i „Pętle” (backtracker)

Średnia ocena / mediana krętości / mediana zaułków na pokój:

| Pętle \ Zaułki | 0% | 50% | 100% |
|---|---|---|---|
| 0% | 81 / 3.21 / 0.33 | 82 / 3.09 / 0.25 | 83 / 2.93 / 0.08 |
| 5% | 85 / 2.66 / 0.33 | 86 / 2.60 / 0.25 | 87 / 2.53 / 0.08 |
| 10% | 89 / 2.39 / 0.33 | 89 / 2.34 / 0.25 | 88 / 2.28 / 0.08 |
| 20% | 87 / 2.07 / 0.25 | 85 / 2.03 / 0.17 | 84 / 1.96 / 0.08 |
| 30% | 82 / 1.86 / 0.25 | 82 / 1.82 / 0.17 | 82 / 1.81 / 0.08 |

## D. Nasycenie oceny

Odsetek układów (wszystkie algorytmy razem), które dostają 100% w danej cesze:

| Cecha | Pełne punkty |
|---|---|
| loops | 27% |
| dead | 41% |
| lin | 62% |
| tort | 72% |
| str | 5% |
| junc | 96% |
| cov | 100% |
| door | 92% |
| ent | 98% |
| var | 94% |
| uniq | 100% |

## E. Pętle losowe kontra pętle-skróty

Ta sama liczba otwieranych ścian. „Skróty” zawsze otwierają ścianę, której dwie strony są najdalej od siebie w grafie korytarzy (min. 6 komórek).

| Algorytm | Tryb pętli | Śr. ocena | Krętość (med.) | Pokoje w pętlach (med.) | Najdł. prosta (med.) | ms / układ |
|---|---|---|---|---|---|---|
| backtracker | losowe | 88.9 | 2.34 | 42% | 46% | 2.1 |
| backtracker | skróty | 92.8 | 1.97 | 50% | 46% | 4.4 |
| growingMix | losowe | 90.5 | 2.11 | 50% | 41% | 1.9 |
| growingMix | skróty | 92.1 | 1.91 | 50% | 46% | 3.0 |
| kruskal | losowe | 83.6 | 1.81 | 58% | 41% | 2.2 |
| kruskal | skróty | 84.1 | 1.76 | 58% | 46% | 1.6 |
