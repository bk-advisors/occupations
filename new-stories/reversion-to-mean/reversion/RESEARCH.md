# RESEARCH: the numbers behind `js/04-data.js`

Every person in `DYNASTIES` is a z score above the mean of a **named reference
population**. This file shows where each figure came from and how it turned into a z.
Read the last section first if you only read one. It is the list of things I could not
pin down, and it is longer than I would like.

---

## 1. The three constructions

Every pair states its construction in `basis`. There are only three.

### A. Moment z

    z = (statistic − mean) / sd,  inside a named population

Used where the statistic is roughly symmetric across the population, so a mean and a
standard deviation mean something. Career points per game, career OPS+, career goals per
game all qualify.

| Population | Statistic | mean | sd |
|---|---|---|---|
| NBA players with 200+ career games (~1,900 men) | career points per game | 9.0 | 4.8 |
| MLB position players with 3,000+ career plate appearances (~1,300 men) | career OPS+ | 100 | 17 |
| NHL forwards with 400+ career games (~1,100 men) | career goals per game | 0.24 | 0.11 |

**These moments are my estimates, not published figures.** They are the weakest link in
the sport data and they are listed again at the bottom. They are chosen so that the
population's own landmarks land where a reader would expect: a 10.9 points-per-game
career (Doc Rivers, thirteen seasons, a solid starter) sits at z = +0.40; a 4.7 average
(Luke Walton, ten seasons, a bench player) sits at z = −0.90; the highest career average
in history (Michael Jordan, 30.1) would sit at z = +4.4. Moving the sd by ±0.3 moves
every sport z by under 0.25 and does not change any conclusion.

### B. Rarity z

    z = Φ⁻¹( 1 − (rank − 0.5) / N )

Used where the statistic is a heavily skewed count (tournament wins, career Approximate
Value) or is money. A mean and an sd of net worth are useless: the mean is dragged by the
tail you are trying to measure. Rank is meaningful, and rank converts to a z cleanly.

Worked example. Cornelius Vanderbilt was the richest man in America when he died in 1877.
There were about 9.5 million US households that year.

    tail = (1 − 0.5) / 9,500,000 = 5.26 × 10⁻⁸
    z    = Φ⁻¹(1 − 5.26 × 10⁻⁸) = 5.32

Anchors, so you can sanity check any number in the file:

| rarity | z |
|---|---|
| 1 in 100 | 2.33 |
| 1 in 1,000 | 3.09 |
| 1 in 10,000 | 3.72 |
| 1 in 1,000,000 | 4.75 |
| 1 in 9.5 million (richest of 1877) | 5.32 |
| 1 in 130 million (richest of 2019) | 5.78 |

Note what this does to the money axis: **being the richest person in a bigger country is
rarer**, so Bill Gates scores higher than Cornelius Vanderbilt on the same construction.
That is not a claim that Gates was richer in real terms. It is a claim about rarity, which
is what a z score is.

### C. Rubric z

Politics uses `OFFICE_RUBRIC` and nothing else. It is a ranking of offices, not a
measurement of anything, and the piece must say so on the figure itself. There is no
defensible continuous statistic for political attainment, and inventing one would be
worse than admitting the rubric is editorial.

### Why constructions are mixed

They are never mixed **inside** a pair. Parent and child always share one population and
one construction, which is the only thing the regression slope actually rests on. Across
domains the z scores are not strictly interchangeable, and the piece should not claim they
are. A business z of 5.3 and a sport z of 3.3 are not "the same amount of extraordinary".

---

## 2. Sport, pair by pair

15 pairs. Constructions A (NBA, MLB, NHL) and B (NFL, golf, football).

| pair | figure | source | arithmetic | z |
|---|---|---|---|---|
| **james** parent | LeBron James, 26.8 career PPG | Basketball-Reference | (26.8 − 9.0)/4.8 | **3.71** |
| **james** child | Bronny James, 2.7 PPG in 69 games | Basketball-Reference / ESPN, through 2025-26 | (2.7 − 9.0)/4.8 | **−1.31** ⚠ |
| **curry** parent | Dell Curry, 11.7 PPG, 1,083 games | Basketball-Reference | (11.7 − 9.0)/4.8 | **0.56** |
| **curry** child | Stephen Curry, 24.8 PPG | Basketball-Reference | (24.8 − 9.0)/4.8 | **3.29** |
| **thompson** parent | Mychal Thompson, 13.7 PPG | Basketball-Reference | (13.7 − 9.0)/4.8 | **0.98** |
| **thompson** child | Klay Thompson, 18.6 PPG | Basketball-Reference | (18.6 − 9.0)/4.8 | **2.00** |
| **rivers** parent | Doc Rivers, 10.9 PPG | Basketball-Reference | (10.9 − 9.0)/4.8 | **0.40** |
| **rivers** child | Austin Rivers, 8.5 PPG | Basketball-Reference | (8.5 − 9.0)/4.8 | **−0.10** |
| **walton** parent | Bill Walton, 13.3 PPG | Basketball-Reference | (13.3 − 9.0)/4.8 | **0.90** |
| **walton** child | Luke Walton, 4.7 PPG | Basketball-Reference | (4.7 − 9.0)/4.8 | **−0.90** |
| **barry** parent | Rick Barry, 23.2 PPG (NBA seasons only) | Basketball-Reference | (23.2 − 9.0)/4.8 | **2.96** |
| **barry** child | Brent Barry, 9.3 PPG | Basketball-Reference | (9.3 − 9.0)/4.8 | **0.06** |
| **bonds** parent | Bobby Bonds, OPS+ 130 | Baseball-Reference | (130 − 100)/17 | **1.76** |
| **bonds** child | Barry Bonds, OPS+ 182 | Baseball-Reference | (182 − 100)/17 | **4.82** |
| **griffey** parent | Ken Griffey Sr., OPS+ 118 | Baseball-Reference | (118 − 100)/17 | **1.06** |
| **griffey** child | Ken Griffey Jr., OPS+ 136 | Baseball-Reference | (136 − 100)/17 | **2.12** |
| **guerrero** parent | Vladimir Guerrero, OPS+ 140 | Baseball-Reference | (140 − 100)/17 | **2.35** |
| **guerrero** child | Vladimir Guerrero Jr., OPS+ 132 | Baseball-Reference, career in progress | (132 − 100)/17 | **1.88** ⚠ |
| **fielder** parent | Cecil Fielder, OPS+ 119 | Baseball-Reference | (119 − 100)/17 | **1.12** |
| **fielder** child | Prince Fielder, OPS+ 134 | Baseball-Reference | (134 − 100)/17 | **2.00** |
| **boone** parent | Bob Boone, OPS+ 82 | Baseball-Reference | (82 − 100)/17 | **−1.06** |
| **boone** child | Bret Boone, OPS+ 99 | Baseball-Reference | (99 − 100)/17 | **−0.06** |
| **hull** parent | Bobby Hull, 610 goals / 1,063 games = 0.574 | Hockey-Reference | (0.574 − 0.24)/0.11 | **3.03** |
| **hull** child | Brett Hull, 741 goals / 1,269 games = 0.584 | Hockey-Reference | (0.584 − 0.24)/0.11 | **3.13** |
| **manning** parent | Archie Manning, career AV 85, rank ≈ 1,000 of 27,000 | Pro-Football-Reference | Φ⁻¹(1 − 999.5/27,000) | **1.79** ⚠ |
| **manning** child | Peyton Manning, career AV 271, 2nd all time | Pro-Football-Reference | Φ⁻¹(1 − 1.5/27,000) | **3.87** |
| **nicklaus** parent | Jack Nicklaus, 73 PGA Tour wins, 2nd all time | PGA Tour records | Φ⁻¹(1 − 1.5/3,000) | **3.29** |
| **nicklaus** child | Gary Nicklaus, 0 wins, rank ≈ 2,300 of 3,000 | PGA Tour records | Φ⁻¹(1 − 2,299.5/3,000) | **−0.73** ⚠ |
| **cruyff** parent | Johan Cruyff, three Ballons d’Or, rank ≈ 3 of 12,000 | club and federation records | Φ⁻¹(1 − 2.5/12,000) | **3.53** |
| **cruyff** child | Jordi Cruyff, 9 Netherlands caps, rank ≈ 5,000 of 12,000 | KNVB, club records | Φ⁻¹(1 − 4,999.5/12,000) | **0.21** ⚠ |

⚠ = `verified: false` in the data, with a `zLow`/`zHigh` band.

Notes on the shakier ones:

- **Bronny James.** 2.7 PPG across 69 games in two seasons is a published figure, but he
  is 21 and has not entered the reference population (200+ games). The z is real; the
  band (−1.4 to +0.6) is there because the career is a fifth written.
- **Vladimir Guerrero Jr.** Same problem, different direction. OPS+ 132 through 2025 is
  published, the career is half done.
- **Archie Manning, Gary Nicklaus, Jordi Cruyff.** The published statistic is solid. What
  I estimated is the **rank** it implies inside the stated population, and that is a
  judgement. The bands are wide on purpose.
- **Johan Cruyff at rank 3.** Any ranking of the greatest footballers is an argument, not
  a measurement. Ranks 1 through 6 all give a z between 3.42 and 3.66, so the argument
  does not move the chart.

### The sport slope is flat, and that is the honest result

Fitted across all 15 sport pairs: **slope −0.198, r = −0.143.** In other words, no
relationship at all. Across the 10 fully verified sport pairs: slope +0.496.

That is not a mistake and it should not be hidden. Three things are happening.

1. **The famous reversion stories are all extreme parents.** LeBron James, Jack Nicklaus,
   Johan Cruyff, Rick Barry. There is no such thing as a famous story about an average
   professional whose son was also average.
2. **The famous counterexamples are all moderate parents.** Dell Curry, Bobby Bonds,
   Archie Manning. Nobody writes "the son of an all-time great also became an all-time
   great" because it has happened roughly once (Bobby and Brett Hull).
3. **Collider bias.** A son of a famous player gets more chances at a given level of
   ability. Conditional on reaching the league at all, sons of great players are therefore
   *worse* on average than sons of ordinary players. Selecting on "made the league" builds
   a negative correlation into the visible sample.

This is the argument the `survivors` scene exists to make, and the data supports it
directly. I deliberately included five ordinary pairs (Rivers, Walton, Boone, Thompson,
Fielder) so the sample is not only made of the two famous shapes. Without them the sport
slope is around −1.4, which would be selection artefact presented as a finding.

### Pairs I considered and left out

- **Michael Jordan → Jeffrey Jordan.** Jeffrey Jordan played three Division I seasons at
  Illinois (1.2 PPG in 92 games) and two at Central Florida, and never played
  professionally. He is not in the NBA reference population at any z. Placing him at
  −2.4 would mean a career average of −2.5 points per game, which is not a number. Any
  value I assign is an invention, and inventions at the extreme end of the parent range
  swing the whole domain slope.
- **Wayne Gretzky → Trevor Gretzky.** Trevor Gretzky played four seasons of affiliated
  minor league baseball after being drafted in the seventh round by the Cubs. Different
  sport from the father, so no single population contains both.
- **Diego Maradona → Diego Sinagra.** Sinagra played in Italy's lower divisions and won a
  beach soccer World Cup silver with Italy in 2008. Again, no shared population.
- **Joe Bryant → Kobe Bryant, Tim Hardaway → Tim Hardaway Jr.** Both fine pairs. Cut for
  space; Curry and Bonds already carry the "runs the other way" argument.

All four are good stories. If the writer wants them in prose rather than on the chart,
the facts above are checked and usable.

---

## 3. Politics, pair by pair

12 pairs, all construction C, all from official government and parliamentary records. The
rubric is in `OFFICE_RUBRIC` and must be printed in the piece.

| pair | parent, office | z | child, office | z |
|---|---|---|---|---|
| adams | John Adams, President | 5.0 | John Quincy Adams, President | 5.0 |
| bush | George H. W. Bush, President | 5.0 | George W. Bush, President | 5.0 |
| nehru | Jawaharlal Nehru, PM of India | 5.0 | Indira Gandhi, PM of India | 5.0 |
| trudeau | Pierre Trudeau, PM of Canada | 5.0 | Justin Trudeau, PM of Canada | 5.0 |
| lee | Lee Kuan Yew, PM of Singapore | 5.0 | Lee Hsien Loong, PM of Singapore | 5.0 |
| bhutto | Zulfikar Ali Bhutto, PM of Pakistan | 5.0 | Benazir Bhutto, PM of Pakistan | 5.0 |
| kennedy | Joseph P. Kennedy Sr., Ambassador to the UK | 4.2 | John F. Kennedy, President | 5.0 |
| romney | George Romney, Governor and Cabinet Secretary | 4.2 | Mitt Romney, Governor, Senator, nominee | 4.2 |
| paul | Ron Paul, US Representative | 2.6 | Rand Paul, US Senator | 3.4 |
| churchill | Winston Churchill, PM of the UK | 5.0 | Randolph Churchill, MP for Preston | 2.6 |
| roosevelt | Franklin D. Roosevelt, President | 5.0 | James Roosevelt, US Representative | 2.6 |
| thatcher | Margaret Thatcher, PM of the UK | 5.0 | Mark Thatcher, no office | 0.0 |

Fitted: **slope 0.072, r = 0.033.** Effectively flat, but flat at a very high level: mean
parent z 4.67, mean child z 3.98. The six head-of-government pairs where the child also
became head of government are the finding. Politics reverts slowly because the advantage
is the thing being inherited: a surname on a ballot, a donor list, a party machine.

The rubric's coarseness is the main weakness. Six of twelve pairs sit at 5.0 → 5.0, which
gives the regression almost no parent variance to work with and makes the slope unstable.
A finer scale (share of the national vote, years in office, an index of executive power)
would give a better fit and would be far harder to defend as comparable across India,
Singapore, Pakistan, Canada, the UK and the US. I chose the coarse honest scale.

I also did not want the domain to be all successions, so a third of it (Churchill,
Roosevelt, Thatcher) is families where the ladder went down, and a quarter (Kennedy, Paul)
is families where it went up.

---

## 4. Business, pair by pair

13 pairs, all construction B. Rank is against **US households alive in the same year**,
from Census household counts. Historical fortunes come from Klepper and Gunther's *The
Wealthy 100* and from the Vanderbilt family history; modern ones from the Forbes lists.

| pair | person | figure | rank / N | z |
|---|---|---|---|---|
| vanderbilt-1 | Cornelius Vanderbilt (d. 1877) | $105m, richest in America | 1 / 9.5m | **5.32** |
| vanderbilt-1 | William Henry Vanderbilt (d. 1885) | ~$200m, richest in the world | 1 / 11m | **5.34** |
| vanderbilt-2 | Cornelius Vanderbilt II (d. 1899) | ~$72m | 8 / 13m | **4.86** |
| vanderbilt-3 | Reginald Vanderbilt (d. 1925) | ~$5m left in trust | ~900 / 25m | **3.97** ⚠ |
| vanderbilt-4 | Gloria Vanderbilt (d. 2019) | estate under $1.5m | ~93rd percentile | **1.47** |
| rockefeller | John D. Rockefeller (peak 1913) | $900m | 1 / 20m | **5.45** |
| rockefeller | John D. Rockefeller Jr. | ~$475m received | 3 / 30m | **5.23** |
| carnegie | Andrew Carnegie (1901 sale) | $480m | 1 / 15m | **5.40** |
| carnegie | Margaret Carnegie Miller | trust of roughly $10m | ~1,500 / 22m | **3.81** ⚠ |
| walmart | Sam Walton (1992) | ~$23bn, richest American | 1 / 95m | **5.72** |
| walmart | Rob Walton (2022) | ~$60bn | ~10 / 130m | **5.26** |
| ford | Henry Ford (peak 1925) | over $1bn | 1 / 30m | **5.52** |
| ford | Edsel Ford (d. 1943) | estate ~$160m | ~20 / 35m | **4.87** ⚠ |
| watson | Thomas J. Watson Sr. (1956) | IBM revenue ~$900m | ~40 / 48m | **4.79** ⚠ |
| watson | Thomas J. Watson Jr. (1971) | IBM revenue ~$8bn | ~30 / 65m | **4.91** ⚠ |
| murdoch | Rupert Murdoch (peak) | ~$23bn | ~35 / 125m | **5.01** |
| murdoch | Lachlan Murdoch | ~$3.5bn | ~250 / 132m | **4.62** |
| lauder | Estée Lauder (d. 2004) | ~$3bn | ~120 / 110m | **4.74** ⚠ |
| lauder | Leonard Lauder (d. 2025) | $10.1bn, Forbes 2025 | ~90 / 132m | **4.83** |
| gates | Bill Gates (peak) | ~$130bn, richest in the world | 1 / 130m | **5.78** |
| gates | Jennifer Gates | placed at the US top 1% threshold | ~1.2m / 130m | **2.36** ⚠ |
| buffett | Warren Buffett (2008) | ~$62bn, richest in the world | 1 / 128m | **5.77** |
| buffett | Howard Buffett | estimated in the hundreds of millions | ~4,000 / 130m | **4.01** ⚠ |

Fitted: **slope 0.861, r = 0.381** across all 13; **slope 0.894, r = 0.741** across the 5
fully verified pairs. This is the highest slope of the three domains and it is the
piece's best finding: **the more transferable the advantage, the slower it reverts.**
A fortune can be handed over in a will. A jump shot cannot.

The Vanderbilt chain is the multi-generation case, four consecutive links:

    5.32 → 5.34 → 4.86 → 3.97 → 1.47

The Commodore left almost everything to one son to keep the fortune whole, and that son
doubled it. The break comes at the third generation, when the money was divided eight
ways, and the collapse at the fifth, when Gloria Vanderbilt died with an estate reported
at under $1.5 million. That last figure is the strongest number in the whole dataset
because it comes from a probate filing rather than a magazine estimate.

Two pairs run **upward**, which the piece needs:

- **Thomas Watson Sr. → Jr.** IBM revenue roughly $900m at handover in 1956, roughly $8bn
  by 1971. The son bet the company on System/360 and won.
- **Estée Lauder → Leonard Lauder.** $10.1bn on the Forbes 2025 list against a parent
  estimate around $3bn.

Two revert **by choice**, not by accident:

- **Andrew Carnegie → Margaret Carnegie Miller.** Carnegie gave away roughly 90% of the
  fortune before he died and left his daughter a comparatively modest trust.
- **Bill Gates → Jennifer Gates.** Gates has said publicly that his children receive a
  small share and the rest goes to the foundation.

Those two matter editorially. A reader looking at a falling line will assume the child
failed. In these cases the parent decided.

---

## 5. Traits

Eight parent-child correlations, all from published work. Two of the values in the stub
were wrong or mislabelled and are corrected here.

| id | r | half-life (gen) | source | note |
|---|---|---|---|---|
| lifespan | 0.15 | 0.37 | Ruby et al. (2018), *Genetics* 210(3), 1109–1124 | Observed parent-child correlation of age at death. The paper's finding is that most of it is assortative mating and shared environment; true heritability is under 10%. |
| income | 0.34 | 0.64 | Chetty, Hendren, Kline & Saez (2014), *QJE* 129(4) | This is the **rank-rank slope**, 0.341, not an elasticity. The stub called it an elasticity; it is not. The US intergenerational earnings elasticity is a different and larger number, roughly 0.4 to 0.5 (Solon 1992, Mazumder 2005). |
| occupation | 0.35 | 0.66 | Blau & Duncan (1967), *The American Occupational Structure* | Father-son occupational status score. Modern replications land between 0.32 and 0.40. |
| wealth | 0.37 | 0.70 | Charles & Hurst (2003), *JPE* 111(6), 1155–1182 | Age-adjusted parent-child net worth elasticity. The stub's 0.37 was right. |
| iq | 0.42 | 0.80 | Bouchard & McGue (1981), *Science* 212, 1055–1059 | Biological parent to adult child, reared together. The stub said 0.45; 0.42 is the number in the classic meta-analysis and is corroborated by later adoption studies. |
| education | 0.46 | 0.89 | Hertz et al. (2007), *B.E. Journal of Economic Analysis & Policy* 7(2) | US correlation in completed years of schooling. The 42-country average is 0.42. **New trait, not in the stub.** |
| height | 0.47 | 0.92 | Silventoinen et al. (2003), *Twin Research* 6(5), 399–408; Galton (1886) | One parent to one adult child. The stub said 0.45, which is inside the published range of 0.45 to 0.50. |
| surname | 0.75 | 2.41 | Clark (2014), *The Son Also Rises* | Rare surnames traced through elite registers. Clark's estimate of the underlying status correlation is 0.70 to 0.80 across every society he looked at. |

`halfLife(r) = ln(0.5) / ln(r)`, the number of generations for an advantage to halve.
Surname status takes **2.4 generations** to halve. Earnings takes **0.64**. That gap is
the whole argument of the `traits` scene.

`HEIGHT.r` stays at 0.45 because the height engine in scene 2 is calibrated to it and it
is inside the published range. `TRAITS` uses 0.47 for the board. If a scene author wants
them identical, change `HEIGHT.r`, not the trait.

---

## 6. Fitted results across the whole dataset

Computed from the file, not typed:

| sample | n | slope | intercept | r | mean parent z | mean child z |
|---|---|---|---|---|---|---|
| all pairs | 40 | **0.621** | 0.761 | 0.552 | 3.75 | 3.09 |
| verified pairs only | 27 | **0.672** | 0.962 | 0.672 | 3.50 | 3.31 |
| sport, all | 15 | −0.198 | 1.701 | −0.143 | 1.76 | 1.35 |
| sport, verified | 10 | 0.496 | 1.055 | 0.326 | 1.17 | 1.64 |
| politics | 12 | 0.072 | 3.645 | 0.033 | 4.67 | 3.98 |
| business, all | 13 | 0.861 | −0.212 | 0.381 | 5.21 | 4.27 |
| business, verified | 5 | 0.894 | 0.265 | 0.741 | 5.37 | 5.06 |

Suggested reading for the headline: **the fitted slope across all 40 pairs is 0.62, so a
generation gives back about 38% of whatever the parent was above the mean.** Use the
all-pairs number, not the verified-only number, and say n = 40. The verified-only figure
(0.672) is close enough that the unverified placements are not driving the result, which
is worth stating.

Do not let a single unverified point carry a sentence. The four that could move a claim
if they were wrong are Jennifer Gates (2.36), Howard Buffett (4.01), Reginald Vanderbilt
(3.97) and Bronny James (−1.31).

Ordering by slope gives the argument in one line:

    business 0.86  >  sport (flat)  ≈  politics 0.07

which reads oddly until you notice that politics is flat **at the top** (mean child z
3.98) and sport is flat **in the middle** (mean child z 1.35). Politics is not reverting;
it has nowhere above 5.0 to revert from. If the writer uses the per-domain slopes, this
has to be said, or the chart argues the opposite of the truth.

---

## 7. What I could not verify

This is the part that matters.

**Distribution moments for the three sport populations.** The mean and sd for NBA points
per game, MLB OPS+ and NHL goals per game are my estimates, calibrated against known
players, not figures pulled from a published table. Every construction-A z in the file
inherits that. If someone wants to compute them properly, it is a Stathead query away and
I would take the real numbers over mine.

**Every rank inside a rarity construction.** I know Peyton Manning is second all time in
career Approximate Value. I do not know that Archie Manning is exactly 1,000th, that Gary
Nicklaus is exactly 2,300th of 3,000, or that Jordi Cruyff is exactly 5,000th of 12,000.
Those are judgements dressed as arithmetic, which is why every one of them carries
`verified: false` and a band. The bands are honest ranges, not decoration.

**Reference population sizes.** 27,000 NFL players, 3,000 golfers with 50+ Tour starts,
12,000 players with 100+ top-five-league appearances. All three are order-of-magnitude
estimates. Doubling N moves a top-rank z by about 0.15, so the conclusions survive, but
the numbers are not precise.

**Estée Lauder's peak net worth.** I could not find a figure I trust. Roughly $3bn is a
reasonable reading of the Forbes 400 listings from the early 2000s, and the family stake
was split across several people, which makes any personal figure soft. Flagged
`verified: false` with a band from 4.3 to 5.1.

**Howard Buffett's net worth.** Published estimates range from $200m to $500m and one
aggregator site puts it in the billions, which is obviously wrong. I used "hundreds of
millions" and a wide band. His foundation's giving is over $1bn and is well documented;
his personal wealth is not.

**Jennifer Gates.** I placed her at the US top 1% threshold, roughly $11m, on the strength
of Bill Gates's repeated public statements about a small inheritance and reported figures
around $10m per child. This is the single softest placement in the file. Band 1.8 to 3.4.

**Reginald Vanderbilt and Margaret Carnegie Miller.** Both trust sizes come from family
histories rather than probate records. Both are flagged.

**Thomas Watson Sr. and Jr.** These two are placed by the scale of the firm they ran, not
by personal wealth, because IBM stock made both men rich in ways that were never
separately published. The *direction* (upward) is certain; the magnitudes are not.

**Edsel Ford's estate.** About $160m is the commonly cited figure. Ford family holdings
were being restructured into the Ford Foundation at the time of his death in 1943, so the
personal number and the family number are hard to separate.

**Bobby Hull's era.** Goals per game across NHL history is not era-adjusted here. Scoring
rates in the 1980s were far higher than in the 1960s, which slightly favours Brett over
Bobby. Adjusting for era would probably make the Hull pair flat or mildly reverting rather
than mildly rising. I left it unadjusted and said so rather than building an adjustment I
could not source.

**Household counts before 1940.** US Census household series get thin the further back you
go. The 1877, 1885 and 1899 counts are interpolations from decennial figures.

**Everything about living young people.** Bronny James is 21 and Vladimir Guerrero Jr. is
27. Their z scores will move. The bands say so, and no headline should rest on either.

One last thing worth saying plainly. The 40 pairs in this file are not a sample of
anything. They are famous families, chosen because they are famous, and fame attaches to
the extremes in both directions. The slope of 0.62 is a real number computed from real
statistics, and it is also a number about a set of people selected for being interesting.
The `survivors` scene is where that gets said out loud, and it should be said before the
reader is asked to believe the 0.62.
