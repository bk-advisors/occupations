/* ============================================================================
   RTM DATA  ·  researched values. Scene modules must code against these shapes
   and never against these values.

   THE UNIT OF THE WHOLE PIECE IS SIGMA.
   Every person is placed as a z score above the mean of a NAMED reference
   population. That is the only way a quarterback, a prime minister and a
   department store fortune can share one axis honestly, and the rubric that
   produces each z is stated in the piece rather than hidden in a footnote.

   Three constructions are used, and each pair says which one in `basis`:
     A. Moment z.   z = (stat - mean) / sd inside a named population, for
                    statistics whose spread is roughly symmetric (points per
                    game, OPS+, goals per game).
     B. Rarity z.   z = Phi_inverse(1 - (rank - 0.5) / N), for skewed counts
                    and for money, where a raw mean and sd would be nonsense.
     C. Rubric z.   The office ladder in OFFICE_RUBRIC. A ranking, not a
                    measurement, and the piece says so on the figure.

   Cross-domain z scores are not strictly interchangeable. Within a pair the
   parent and the child always share one population and one construction, which
   is what the regression slope actually rests on. See RESEARCH.md.
   ========================================================================== */
RTM.data = (function () {
  "use strict";

  /* ── Traits: how fast each one reverts ─────────────────────────────────────
     r is the parent-child correlation. halfLife = ln(0.5) / ln(r) generations,
     which is the number of generations for an advantage to halve.            */
  var TRAITS = [
    { id: "lifespan", label: "Lifespan", r: 0.15, group: "body",
      note: "Parent to child age at death. Most of even this much is shared living, not shared genes.",
      source: "ruby2018" },
    { id: "income", label: "Earnings", r: 0.34, group: "money",
      note: "US parent-child rank-rank slope: a parent 10 percentiles higher predicts a child 3.4 higher.",
      source: "chetty2014" },
    { id: "occupation", label: "Occupational standing", r: 0.35, group: "money",
      note: "Father to son occupational status score.",
      source: "blau1967" },
    { id: "wealth", label: "Wealth", r: 0.37, group: "money",
      note: "Age-adjusted parent-child net worth elasticity.",
      source: "charles2003" },
    { id: "iq", label: "Measured IQ", r: 0.42, group: "mind",
      note: "Biological parent to adult child, reared together.",
      source: "bouchard1981" },
    { id: "education", label: "Years of schooling", r: 0.46, group: "mind",
      note: "US parent-child correlation in completed years of education.",
      source: "hertz2007" },
    { id: "height", label: "Height", r: 0.47, group: "body",
      note: "One parent to one adult child. The trait Galton started with.",
      source: "silventoinen2003" },
    { id: "surname", label: "Social status, by surname", r: 0.75, group: "money",
      note: "Rare surnames tracked through elite registers for three hundred years.",
      source: "clark2014" }
  ];

  /* ── Dynasties ────────────────────────────────────────────────────────────
     domain:  "sport" | "politics" | "business"
     basis:   the named reference population the z score is measured against
     z:       standard deviations above that population's mean
     zLow/zHigh: honest uncertainty on an editorial placement (optional)
     verified: true only when the underlying numbers are published figures    */

  var NBA_POP = "NBA players with 200 or more career games. Career points per game, mean 9.0, sd 4.8.";
  var MLB_POP = "MLB position players with 3,000 or more career plate appearances. Career OPS+, mean 100, sd 17.";
  var NHL_POP = "NHL forwards with 400 or more career games. Career goals per game, mean 0.24, sd 0.11.";
  var NFL_POP = "Everyone who has played an NFL regular season game, about 27,000 men, ranked by career Approximate Value.";
  var GOLF_POP = "Golfers with 50 or more PGA Tour starts since 1950, about 3,000 men, ranked by career Tour wins.";
  var FUT_POP = "Players with 100 or more appearances in a top five European league since 1960, about 12,000 men, ranked by career standing.";
  var OFFICE_POP = "Adults of the country, ranked by the highest office reached. See the rubric.";

  var DYNASTIES = [

    /* ───────────────────────────── SPORT ─────────────────────────────────── */
    {
      id: "james", domain: "sport", family: "James",
      metric: "Career points per game", basis: NBA_POP,
      parent: { name: "LeBron James", role: "Forward", years: "2003 to present",
                stat: "26.8 points per game", z: 3.71, verified: true },
      child: { name: "Bronny James", role: "Guard", years: "2024 to present",
               stat: "2.7 points per game, 69 games", z: -1.31, zLow: -1.4, zHigh: 0.6, verified: false },
      note: "Bronny James reached the NBA at 20, which almost nobody does. He is doing it beside the highest scoring player in the league’s history.",
      source: "bref-nba"
    },
    {
      id: "curry", domain: "sport", family: "Curry",
      metric: "Career points per game", basis: NBA_POP,
      parent: { name: "Dell Curry", role: "Guard", years: "1986 to 2002",
                stat: "11.7 points per game", z: 0.56, verified: true },
      child: { name: "Stephen Curry", role: "Guard", years: "2009 to present",
               stat: "24.8 points per game", z: 3.29, verified: true },
      note: "Dell Curry was a good shooter for sixteen seasons. His son changed how the game is played. Regression runs toward the mean, not downward, and Dell had a long way above him to go.",
      source: "bref-nba"
    },
    {
      id: "thompson", domain: "sport", family: "Thompson",
      metric: "Career points per game", basis: NBA_POP,
      parent: { name: "Mychal Thompson", role: "Forward and centre", years: "1978 to 1991",
                stat: "13.7 points per game", z: 0.98, verified: true },
      child: { name: "Klay Thompson", role: "Guard", years: "2011 to present",
               stat: "18.6 points per game", z: 2.00, verified: true },
      note: "The father was the first pick of the 1978 draft and won two titles as a role player. The son has won four.",
      source: "bref-nba"
    },
    {
      id: "rivers", domain: "sport", family: "Rivers",
      metric: "Career points per game", basis: NBA_POP,
      parent: { name: "Doc Rivers", role: "Guard", years: "1983 to 1996",
                stat: "10.9 points per game", z: 0.40, verified: true },
      child: { name: "Austin Rivers", role: "Guard", years: "2012 to 2023",
               stat: "8.5 points per game", z: -0.10, verified: true },
      note: "Two ordinary NBA careers, thirteen seasons and eleven seasons, a fraction of a standard deviation apart. Most of the pairs in this data look like this one, and none of them get written about.",
      source: "bref-nba"
    },
    {
      id: "walton", domain: "sport", family: "Walton",
      metric: "Career points per game", basis: NBA_POP,
      parent: { name: "Bill Walton", role: "Centre", years: "1974 to 1988",
                stat: "13.3 points per game, league MVP", z: 0.90, verified: true },
      child: { name: "Luke Walton", role: "Forward", years: "2003 to 2013",
               stat: "4.7 points per game", z: -0.90, verified: true },
      note: "Bill Walton’s scoring average understates him: injuries cost him most of a decade and he was the best player in the league when healthy. Luke Walton played ten seasons and won two rings, then became a head coach.",
      source: "bref-nba"
    },
    {
      id: "barry", domain: "sport", family: "Barry",
      metric: "Career points per game", basis: NBA_POP,
      parent: { name: "Rick Barry", role: "Forward", years: "1965 to 1980",
                stat: "23.2 points per game in the NBA", z: 2.96, verified: true },
      child: { name: "Brent Barry", role: "Guard", years: "1995 to 2009",
               stat: "9.3 points per game", z: 0.06, verified: true },
      note: "Rick Barry is in the Hall of Fame. Three of his sons reached the NBA, which no other family has managed, and the best of them was an average NBA player for fourteen years.",
      source: "bref-nba"
    },
    {
      id: "bonds", domain: "sport", family: "Bonds",
      metric: "Career OPS+", basis: MLB_POP,
      parent: { name: "Bobby Bonds", role: "Outfielder", years: "1968 to 1981",
                stat: "OPS+ 130", z: 1.76, verified: true },
      child: { name: "Barry Bonds", role: "Outfielder", years: "1986 to 2007",
               stat: "OPS+ 182", z: 4.82, verified: true },
      note: "Bobby Bonds was a three time All Star. Barry Bonds finished with the most home runs and the most walks in the history of the sport.",
      source: "bref-mlb"
    },
    {
      id: "griffey", domain: "sport", family: "Griffey",
      metric: "Career OPS+", basis: MLB_POP,
      parent: { name: "Ken Griffey Sr.", role: "Outfielder", years: "1973 to 1991",
                stat: "OPS+ 118", z: 1.06, verified: true },
      child: { name: "Ken Griffey Jr.", role: "Outfielder", years: "1989 to 2010",
               stat: "OPS+ 136, 630 home runs", z: 2.12, verified: true },
      note: "They played in the same Seattle outfield in 1990 and 1991, and hit back to back home runs once.",
      source: "bref-mlb"
    },
    {
      id: "guerrero", domain: "sport", family: "Guerrero",
      metric: "Career OPS+", basis: MLB_POP,
      parent: { name: "Vladimir Guerrero", role: "Outfielder", years: "1996 to 2011",
                stat: "OPS+ 140, Hall of Fame", z: 2.35, verified: true },
      child: { name: "Vladimir Guerrero Jr.", role: "First baseman", years: "2019 to present",
               stat: "OPS+ 132, career in progress", z: 1.88, zLow: 1.5, zHigh: 2.4, verified: false },
      note: "Through their first four hundred games the two men’s numbers were almost the same. This pair has barely moved in a generation, which is what the middle of the distribution looks like.",
      source: "bref-mlb"
    },
    {
      id: "fielder", domain: "sport", family: "Fielder",
      metric: "Career OPS+", basis: MLB_POP,
      parent: { name: "Cecil Fielder", role: "First baseman", years: "1985 to 1998",
                stat: "OPS+ 119, 319 home runs", z: 1.12, verified: true },
      child: { name: "Prince Fielder", role: "First baseman", years: "2005 to 2016",
               stat: "OPS+ 134, 319 home runs", z: 2.00, verified: true },
      note: "Father and son finished with exactly 319 career home runs each. The son hit his at a better rate for his era.",
      source: "bref-mlb"
    },
    {
      id: "boone", domain: "sport", family: "Boone",
      metric: "Career OPS+", basis: MLB_POP,
      parent: { name: "Bob Boone", role: "Catcher", years: "1972 to 1990",
                stat: "OPS+ 82", z: -1.06, verified: true },
      child: { name: "Bret Boone", role: "Second baseman", years: "1992 to 2005",
               stat: "OPS+ 99", z: -0.06, verified: true },
      note: "Three generations of Boones played in the major leagues, starting with Ray in 1948. All three hit below or near the league average and all three lasted a long time.",
      source: "bref-mlb"
    },
    {
      id: "hull", domain: "sport", family: "Hull",
      metric: "Career goals per game", basis: NHL_POP,
      parent: { name: "Bobby Hull", role: "Left wing", years: "1957 to 1980",
                stat: "610 goals in 1,063 games", z: 3.03, verified: true },
      child: { name: "Brett Hull", role: "Right wing", years: "1986 to 2005",
               stat: "741 goals in 1,269 games", z: 3.13, verified: true },
      note: "The only father and son to each win the Hart Trophy. Brett scored 131 more goals than his father did.",
      source: "bref-nhl"
    },
    {
      id: "manning", domain: "sport", family: "Manning",
      metric: "Career Approximate Value, by rank", basis: NFL_POP,
      parent: { name: "Archie Manning", role: "Quarterback", years: "1971 to 1984",
                stat: "career AV 85, two Pro Bowls", z: 1.79, zLow: 1.3, zHigh: 2.3, verified: false },
      child: { name: "Peyton Manning", role: "Quarterback", years: "1998 to 2015",
               stat: "career AV 271, second all time", z: 3.87, verified: true },
      note: "Archie Manning played thirteen seasons for teams that mostly lost. Two of his three sons became NFL quarterbacks and one of them won five most valuable player awards.",
      source: "bref-nfl"
    },
    {
      id: "nicklaus", domain: "sport", family: "Nicklaus",
      metric: "Career PGA Tour wins, by rank", basis: GOLF_POP,
      parent: { name: "Jack Nicklaus", role: "Golfer", years: "1962 to 2005",
                stat: "73 Tour wins, 18 majors", z: 3.29, verified: true },
      child: { name: "Gary Nicklaus", role: "Golfer", years: "1991 to 2003",
               stat: "no Tour wins, best finish second", z: -0.73, zLow: -1.3, zHigh: -0.1, verified: false },
      note: "Gary Nicklaus held a PGA Tour card for three seasons and lost a playoff to Phil Mickelson in 2000. He then left the tour for the family design business.",
      source: "pgatour"
    },
    {
      id: "cruyff", domain: "sport", family: "Cruyff",
      metric: "Career standing, by rank", basis: FUT_POP,
      parent: { name: "Johan Cruyff", role: "Forward", years: "1964 to 1984",
                stat: "three Ballons d’Or", z: 3.53, verified: true },
      child: { name: "Jordi Cruyff", role: "Midfielder", years: "1994 to 2010",
               stat: "9 Netherlands caps, 58 Manchester United games", z: 0.21, zLow: -0.3, zHigh: 0.8, verified: false },
      note: "Jordi Cruyff played for Barcelona and Manchester United, won a Premier League title and played at a European Championship. He later became a manager and a sporting director.",
      source: "football-records"
    },

    /* ─────────────────────────── POLITICS ────────────────────────────────── */
    {
      id: "adams", domain: "politics", family: "Adams",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "John Adams", role: "2nd US President", years: "1797 to 1801",
                stat: "President", z: 5.0, verified: true },
      child: { name: "John Quincy Adams", role: "6th US President", years: "1825 to 1829",
               stat: "President", z: 5.0, verified: true },
      note: "The first of only two father and son pairs to hold the American presidency. Both served a single term and both lost their re-election.",
      source: "gov-records"
    },
    {
      id: "bush", domain: "politics", family: "Bush",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "George H. W. Bush", role: "41st US President", years: "1989 to 1993",
                stat: "President", z: 5.0, verified: true },
      child: { name: "George W. Bush", role: "43rd US President", years: "2001 to 2009",
               stat: "President", z: 5.0, verified: true },
      note: "Three generations of national office: a senator, then a president, then a president and a governor.",
      source: "gov-records"
    },
    {
      id: "nehru", domain: "politics", family: "Nehru Gandhi",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Jawaharlal Nehru", role: "Prime Minister of India", years: "1947 to 1964",
                stat: "Head of government", z: 5.0, verified: true },
      child: { name: "Indira Gandhi", role: "Prime Minister of India", years: "1966 to 1977, 1980 to 1984",
               stat: "Head of government", z: 5.0, verified: true },
      note: "Her son Rajiv Gandhi later held the same office. Three heads of government in three generations of one family.",
      source: "gov-records"
    },
    {
      id: "trudeau", domain: "politics", family: "Trudeau",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Pierre Trudeau", role: "Prime Minister of Canada", years: "1968 to 1979, 1980 to 1984",
                stat: "Head of government", z: 5.0, verified: true },
      child: { name: "Justin Trudeau", role: "Prime Minister of Canada", years: "2015 to 2025",
               stat: "Head of government", z: 5.0, verified: true },
      note: "Justin Trudeau was four years old when he first lived at 24 Sussex Drive. He returned to it at 43.",
      source: "gov-records"
    },
    {
      id: "lee", domain: "politics", family: "Lee",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Lee Kuan Yew", role: "Prime Minister of Singapore", years: "1959 to 1990",
                stat: "Head of government", z: 5.0, verified: true },
      child: { name: "Lee Hsien Loong", role: "Prime Minister of Singapore", years: "2004 to 2024",
               stat: "Head of government", z: 5.0, verified: true },
      note: "Father and son led Singapore for 51 of its first 59 years of independence.",
      source: "gov-records"
    },
    {
      id: "bhutto", domain: "politics", family: "Bhutto",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Zulfikar Ali Bhutto", role: "President then Prime Minister of Pakistan", years: "1971 to 1977",
                stat: "Head of government", z: 5.0, verified: true },
      child: { name: "Benazir Bhutto", role: "Prime Minister of Pakistan", years: "1988 to 1990, 1993 to 1996",
               stat: "Head of government", z: 5.0, verified: true },
      note: "She was the first woman to lead a majority Muslim country. Both father and daughter died violently while in or near power.",
      source: "gov-records"
    },
    {
      id: "kennedy", domain: "politics", family: "Kennedy",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Joseph P. Kennedy Sr.", role: "Ambassador to the United Kingdom", years: "1938 to 1940",
                stat: "Cabinet rank", z: 4.2, verified: true },
      child: { name: "John F. Kennedy", role: "35th US President", years: "1961 to 1963",
               stat: "President", z: 5.0, verified: true },
      note: "The father was the first chairman of the Securities and Exchange Commission and then ambassador in London. Three of his sons reached the Senate.",
      source: "gov-records"
    },
    {
      id: "romney", domain: "politics", family: "Romney",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "George Romney", role: "Governor of Michigan, Housing Secretary", years: "1963 to 1973",
                stat: "Cabinet rank", z: 4.2, verified: true },
      child: { name: "Mitt Romney", role: "Governor, Senator, presidential nominee", years: "2003 to 2025",
               stat: "National party leader", z: 4.2, verified: true },
      note: "Both ran for the Republican nomination. The father lost it in 1968, the son won it in 2012 and lost the general election.",
      source: "gov-records"
    },
    {
      id: "paul", domain: "politics", family: "Paul",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Ron Paul", role: "US Representative, Texas", years: "1976 to 2013",
                stat: "National legislature", z: 2.6, verified: true },
      child: { name: "Rand Paul", role: "US Senator, Kentucky", years: "2011 to present",
               stat: "Senate", z: 3.4, verified: true },
      note: "The son went further up the ladder than the father, in a different state, running on the same politics.",
      source: "gov-records"
    },
    {
      id: "churchill", domain: "politics", family: "Churchill",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Winston Churchill", role: "Prime Minister of the United Kingdom", years: "1940 to 1945, 1951 to 1955",
                stat: "Head of government", z: 5.0, verified: true },
      child: { name: "Randolph Churchill", role: "MP for Preston", years: "1940 to 1945",
               stat: "National legislature", z: 2.6, verified: true },
      note: "Randolph Churchill entered the Commons unopposed in wartime, lost the seat in 1945, and spent the rest of his life as a journalist and as his father’s biographer.",
      source: "gov-records"
    },
    {
      id: "roosevelt", domain: "politics", family: "Roosevelt",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Franklin D. Roosevelt", role: "32nd US President", years: "1933 to 1945",
                stat: "President", z: 5.0, verified: true },
      child: { name: "James Roosevelt", role: "US Representative, California", years: "1955 to 1965",
               stat: "National legislature", z: 2.6, verified: true },
      note: "James Roosevelt served five terms in the House and later represented the United States at the United Nations. He ran for Governor of California in 1950 and lost.",
      source: "gov-records"
    },
    {
      id: "thatcher", domain: "politics", family: "Thatcher",
      metric: "Highest office reached", basis: OFFICE_POP,
      parent: { name: "Margaret Thatcher", role: "Prime Minister of the United Kingdom", years: "1979 to 1990",
                stat: "Head of government", z: 5.0, verified: true },
      child: { name: "Mark Thatcher", role: "Businessman", years: "1980s onward",
               stat: "No elected or appointed office", z: 0.0, verified: true },
      note: "Mark Thatcher inherited a baronetcy from his father and worked in business. He never stood for office.",
      source: "gov-records"
    },

    /* ─────────────────────────── BUSINESS ────────────────────────────────── */
    {
      id: "vanderbilt-1", domain: "business", family: "Vanderbilt",
      metric: "Real net worth at death, by rank",
      basis: "US households alive in the same year, ranked by net worth. 9.5 million households in 1877.",
      parent: { name: "Cornelius Vanderbilt", role: "Shipping and railroads", years: "1794 to 1877",
                stat: "$105 million, richest man in America", z: 5.32, verified: true },
      child: { name: "William Henry Vanderbilt", role: "Railroads", years: "1821 to 1885",
               stat: "about $200 million, richest man in the world", z: 5.34, verified: true },
      note: "The Commodore left almost all of it to one son, deliberately, to keep it whole. That son doubled it in eight years.",
      source: "wealthy100"
    },
    {
      id: "vanderbilt-2", domain: "business", family: "Vanderbilt",
      metric: "Real net worth at death, by rank",
      basis: "US households alive in the same year, ranked by net worth. 13 million households in 1899.",
      parent: { name: "William Henry Vanderbilt", role: "Railroads", years: "1821 to 1885",
                stat: "about $200 million", z: 5.34, verified: true },
      child: { name: "Cornelius Vanderbilt II", role: "Railroads", years: "1843 to 1899",
               stat: "about $72 million", z: 4.86, verified: true },
      note: "William Henry split the fortune eight ways. The eldest son got the largest share and still ended with roughly a third of what his father held.",
      source: "fortunes-children"
    },
    {
      id: "vanderbilt-3", domain: "business", family: "Vanderbilt",
      metric: "Real net worth at death, by rank",
      basis: "US households alive in the same year, ranked by net worth. 25 million households in 1925.",
      parent: { name: "Cornelius Vanderbilt II", role: "Railroads", years: "1843 to 1899",
                stat: "about $72 million", z: 4.86, verified: true },
      child: { name: "Reginald Vanderbilt", role: "Heir and horseman", years: "1880 to 1925",
               stat: "about $5 million left in trust", z: 3.97, zLow: 3.5, zHigh: 4.4, verified: false },
      note: "Reginald Vanderbilt received $7.5 million at 21 and spent most of it. He bred horses and founded the National Horse Show’s hunter classes.",
      source: "fortunes-children"
    },
    {
      id: "vanderbilt-4", domain: "business", family: "Vanderbilt",
      metric: "Real net worth at death, by rank",
      basis: "US households alive in the same year, ranked by net worth. 128 million households in 2019.",
      parent: { name: "Reginald Vanderbilt", role: "Heir and horseman", years: "1880 to 1925",
                stat: "about $5 million left in trust", z: 3.97, zLow: 3.5, zHigh: 4.4, verified: false },
      child: { name: "Gloria Vanderbilt", role: "Designer and artist", years: "1924 to 2019",
               stat: "estate under $1.5 million", z: 1.47, verified: true },
      note: "Gloria Vanderbilt built a denim label that sold in the hundreds of millions of dollars a year, then lost much of it to back taxes and to an adviser. Her son Anderson Cooper has said he expected no inheritance and received almost none.",
      source: "gv-estate"
    },
    {
      id: "rockefeller", domain: "business", family: "Rockefeller",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 20 million households in 1913.",
      parent: { name: "John D. Rockefeller", role: "Standard Oil", years: "1839 to 1937",
                stat: "$900 million, about 2% of US output", z: 5.45, verified: true },
      child: { name: "John D. Rockefeller Jr.", role: "Philanthropist", years: "1874 to 1960",
               stat: "about $475 million received", z: 5.23, verified: true },
      note: "The son never ran an oil company. He gave away about half a billion dollars and built Rockefeller Center in the middle of the Depression.",
      source: "wealthy100"
    },
    {
      id: "carnegie", domain: "business", family: "Carnegie",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 15 million households in 1901.",
      parent: { name: "Andrew Carnegie", role: "Carnegie Steel", years: "1835 to 1919",
                stat: "$480 million from the 1901 sale", z: 5.40, verified: true },
      child: { name: "Margaret Carnegie Miller", role: "Trustee", years: "1897 to 1990",
               stat: "a trust worth roughly $10 million", z: 3.81, zLow: 3.2, zHigh: 4.4, verified: false },
      note: "Carnegie wrote that a man who dies rich dies disgraced, and gave away about 90% of the fortune before he died. The reversion here was a decision, not an accident.",
      source: "wealthy100"
    },
    {
      id: "walmart", domain: "business", family: "Walton",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 95 million households in 1992.",
      parent: { name: "Sam Walton", role: "Founder of Walmart", years: "1918 to 1992",
                stat: "about $23 billion, richest American", z: 5.72, verified: true },
      child: { name: "Rob Walton", role: "Chairman of Walmart", years: "1944 to present",
               stat: "about $60 billion, roughly tenth in the US", z: 5.26, verified: true },
      note: "The stake was split four ways at the father’s death and each share has since grown larger than the whole was. Owning an index of one great company is a very transferable advantage.",
      source: "forbes"
    },
    {
      id: "ford", domain: "business", family: "Ford",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 30 million households in 1925.",
      parent: { name: "Henry Ford", role: "Founder of Ford Motor", years: "1863 to 1947",
                stat: "over $1 billion at peak", z: 5.52, verified: true },
      child: { name: "Edsel Ford", role: "President of Ford Motor", years: "1893 to 1943",
               stat: "estate of about $160 million", z: 4.87, zLow: 4.4, zHigh: 5.2, verified: false },
      note: "Edsel Ford was president of the company for nineteen years and pushed through the Lincoln, the Zephyr and the Model A. His father kept the controlling stock and most of the final say.",
      source: "wealthy100"
    },
    {
      id: "watson", domain: "business", family: "Watson",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 48 million households in 1956.",
      parent: { name: "Thomas J. Watson Sr.", role: "Built IBM", years: "1874 to 1956",
                stat: "IBM revenue about $900 million at handover", z: 4.79, zLow: 4.3, zHigh: 5.2, verified: false },
      child: { name: "Thomas J. Watson Jr.", role: "Chief executive of IBM", years: "1914 to 1993",
               stat: "IBM revenue about $8 billion by 1971", z: 4.91, zLow: 4.4, zHigh: 5.3, verified: false },
      note: "The son bet the company on the System/360 and won. Fortune later called it the riskiest business decision of all time. This pair runs upward.",
      source: "forbes"
    },
    {
      id: "murdoch", domain: "business", family: "Murdoch",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 125 million households.",
      parent: { name: "Rupert Murdoch", role: "Built News Corporation", years: "1931 to present",
                stat: "about $23 billion at peak", z: 5.01, verified: true },
      child: { name: "Lachlan Murdoch", role: "Executive chairman, Fox and News Corp", years: "1971 to present",
               stat: "about $3.5 billion", z: 4.62, verified: true },
      note: "Rupert Murdoch inherited one Adelaide newspaper from his own father and turned it into two listed companies. His son now runs both.",
      source: "forbes"
    },
    {
      id: "lauder", domain: "business", family: "Lauder",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 110 to 132 million households.",
      parent: { name: "Estée Lauder", role: "Founded Estée Lauder", years: "1908 to 2004",
                stat: "roughly $3 billion", z: 4.74, zLow: 4.3, zHigh: 5.1, verified: false },
      child: { name: "Leonard Lauder", role: "Chief executive, Estée Lauder", years: "1933 to 2025",
               stat: "$10.1 billion, Forbes 2025", z: 4.83, verified: true },
      note: "Estée Lauder started with four products sold from a hotel counter. Her son took the company public and grew it into a global business. Another pair that runs upward.",
      source: "forbes"
    },
    {
      id: "gates", domain: "business", family: "Gates",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 130 million households.",
      parent: { name: "Bill Gates", role: "Founder of Microsoft", years: "1955 to present",
                stat: "about $130 billion at peak", z: 5.78, verified: true },
      child: { name: "Jennifer Gates", role: "Physician", years: "1996 to present",
               stat: "placed near the US top 1% threshold", z: 2.36, zLow: 1.8, zHigh: 3.4, verified: false },
      note: "Bill Gates has said publicly that his children will receive a small share of the fortune and that the rest goes to the foundation. Jennifer Gates completed medical school and competes in show jumping.",
      source: "forbes"
    },
    {
      id: "buffett", domain: "business", family: "Buffett",
      metric: "Real net worth at peak, by rank",
      basis: "US households alive in the same year, ranked by net worth. 128 million households.",
      parent: { name: "Warren Buffett", role: "Berkshire Hathaway", years: "1930 to present",
                stat: "about $62 billion, richest in the world in 2008", z: 5.77, verified: true },
      child: { name: "Howard Buffett", role: "Farmer and philanthropist", years: "1954 to present",
               stat: "personal wealth estimated in the hundreds of millions", z: 4.01, zLow: 3.4, zHigh: 4.5, verified: false },
      note: "Howard Buffett farms in Illinois, has directed more than a billion dollars of grants through his own foundation, and is designated to become Berkshire’s non executive chairman.",
      source: "forbes"
    }
  ];

  /* ── Galton's own 1886 tally: [mid-parent height, child height, count] ────
     Table I of Galton (1886), "Number of Adult Children of various statures
     born of 205 Mid-parents of various statures": 928 children, 205 mid-parents.
     Heights are bin centres, not exact inches, and every daughter's height was
     multiplied by 1.08 before Galton tabulated it. Transcribed against the scan
     at galton.org and against the Galton dataset in R's HistData package; the
     row totals (5, 7, 32, 59, 48, 117, 138, 120, 167, 99, 64, 41, 17, 14) and
     column totals (14, 23, 66, 78, 211, 219, 183, 68, 43, 19, 4) both agree. */
  var GALTON = [
    [70.5,61.7,1],[68.5,61.7,1],[65.5,61.7,1],[64.5,61.7,1],[64,61.7,1],
    [67.5,62.2,3],[66.5,62.2,3],[64.5,62.2,1],
    [70.5,63.2,1],[69.5,63.2,1],[68.5,63.2,7],[67.5,63.2,5],[66.5,63.2,3],[65.5,63.2,9],[64.5,63.2,4],[64,63.2,2],
    [69.5,64.2,16],[68.5,64.2,11],[67.5,64.2,14],[66.5,64.2,5],[65.5,64.2,5],[64.5,64.2,4],[64,64.2,4],
    [71.5,65.2,1],[70.5,65.2,1],[69.5,65.2,4],[68.5,65.2,16],[67.5,65.2,15],[66.5,65.2,2],[65.5,65.2,7],[64.5,65.2,1],[64,65.2,1],
    [71.5,66.2,3],[70.5,66.2,1],[69.5,66.2,17],[68.5,66.2,25],[67.5,66.2,36],[66.5,66.2,17],[65.5,66.2,11],[64.5,66.2,5],[64,66.2,2],
    [71.5,67.2,4],[70.5,67.2,3],[69.5,67.2,27],[68.5,67.2,31],[67.5,67.2,38],[66.5,67.2,17],[65.5,67.2,11],[64.5,67.2,5],[64,67.2,2],
    [72.5,68.2,1],[71.5,68.2,3],[70.5,68.2,12],[69.5,68.2,20],[68.5,68.2,34],[67.5,68.2,28],[66.5,68.2,14],[65.5,68.2,7],[64,68.2,1],
    [72.5,69.2,2],[71.5,69.2,5],[70.5,69.2,18],[69.5,69.2,33],[68.5,69.2,48],[67.5,69.2,38],[66.5,69.2,13],[65.5,69.2,7],[64.5,69.2,2],[64,69.2,1],
    [72.5,70.2,1],[71.5,70.2,10],[70.5,70.2,14],[69.5,70.2,25],[68.5,70.2,21],[67.5,70.2,19],[66.5,70.2,4],[65.5,70.2,5],
    [72.5,71.2,2],[71.5,71.2,4],[70.5,71.2,7],[69.5,71.2,20],[68.5,71.2,18],[67.5,71.2,11],[65.5,71.2,2],
    [73,72.2,1],[72.5,72.2,7],[71.5,72.2,9],[70.5,72.2,4],[69.5,72.2,11],[68.5,72.2,4],[67.5,72.2,4],[65.5,72.2,1],
    [73,73.2,3],[72.5,73.2,2],[71.5,73.2,2],[70.5,73.2,3],[69.5,73.2,4],[68.5,73.2,3],
    [72.5,73.7,4],[71.5,73.7,2],[70.5,73.7,3],[69.5,73.7,5]
  ];

  /* ── Height constants, US adult men (NHANES) ───────────────────────────── */
  /* r is NOT typed here. It shipped as 0.45 while TRAITS.height said 0.47, so
     the piece quoted two different values for one constant: 0.45 in the hero
     and the engine, 0.47 in the traits board and the survivors model. One
     number, read from the cited trait row, so there is nothing to drift. */
  function traitR(id, fallback) {
    for (var i = 0; i < TRAITS.length; i++) {
      if (TRAITS[i].id === id && isFinite(TRAITS[i].r)) return TRAITS[i].r;
    }
    return fallback;
  }
  var HEIGHT = {
    mean: 69.1, sd: 3.0, r: traitR("height", 0.47),
    lebron: 79.25, bronny: 73.5
  };

  /* ── The office rubric, printed in the piece so the reader can argue ───── */
  var OFFICE_RUBRIC = [
    { z: 5.0, label: "Head of government or state" },
    { z: 4.2, label: "Cabinet, supreme court, or national party leader" },
    { z: 3.4, label: "Senate, governor, or equivalent" },
    { z: 2.6, label: "National legislature" },
    { z: 1.7, label: "State or regional office" },
    { z: 0.8, label: "Local office, or a serious run that lost" },
    { z: 0.0, label: "No office" }
  ];

  /* ── Sources. Every `source` string above matches an id here. ──────────── */
  var SOURCES = [
    { id: "bref-nba", cite: "Basketball-Reference, career per game statistics",
      url: "https://www.basketball-reference.com/" },
    { id: "bref-mlb", cite: "Baseball-Reference, career OPS+ and batting statistics",
      url: "https://www.baseball-reference.com/" },
    { id: "bref-nhl", cite: "Hockey-Reference, career goals and games played",
      url: "https://www.hockey-reference.com/" },
    { id: "bref-nfl", cite: "Pro-Football-Reference, career Approximate Value",
      url: "https://www.pro-football-reference.com/" },
    { id: "pgatour", cite: "PGA Tour player records and money lists",
      url: "https://www.pgatour.com/" },
    { id: "football-records", cite: "National federation and club appearance records (KNVB, AFA, club archives)" },
    { id: "gov-records", cite: "US National Archives, Hansard, and official government and parliamentary records",
      url: "https://www.archives.gov/" },
    { id: "forbes", cite: "Forbes, The World’s Billionaires and the Forbes 400",
      url: "https://www.forbes.com/billionaires/" },
    { id: "wealthy100", cite: "Klepper & Gunther, The Wealthy 100 (1996), for historical American fortunes in real terms" },
    { id: "fortunes-children", cite: "Arthur T. Vanderbilt II, Fortune’s Children: The Fall of the House of Vanderbilt (1989)" },
    { id: "gv-estate", cite: "Reporting on the Gloria Vanderbilt estate filing, 2019",
      url: "https://www.wealthmanagement.com/high-net-worth/anderson-cooper-will-inherit-less-than-1-5-million-from-gloria-vanderbilt-s-estate" },
    { id: "scf", cite: "Federal Reserve Board, Survey of Consumer Finances, 2019 and 2022",
      url: "https://www.federalreserve.gov/econres/scfindex.htm" },
    { id: "census-hh", cite: "US Census Bureau, historical household and family counts",
      url: "https://www.census.gov/data/tables/time-series/demo/families/households.html" },
    { id: "nhanes", cite: "CDC NHANES, anthropometric reference data for US adults",
      url: "https://www.cdc.gov/nchs/nhanes/index.htm" },
    { id: "galton1886", cite: "Galton, F. (1886), Regression towards mediocrity in hereditary stature, Journal of the Anthropological Institute 15, 246 to 263" },
    { id: "silventoinen2003", cite: "Silventoinen, K. et al. (2003), Heritability of adult body height, Twin Research 6(5), 399 to 408" },
    { id: "bouchard1981", cite: "Bouchard, T. J. & McGue, M. (1981), Familial studies of intelligence: a review, Science 212, 1055 to 1059" },
    { id: "hertz2007", cite: "Hertz, T. et al. (2007), The inheritance of educational inequality, B.E. Journal of Economic Analysis & Policy 7(2)" },
    { id: "chetty2014", cite: "Chetty, R., Hendren, N., Kline, P. & Saez, E. (2014), Where is the land of opportunity?, Quarterly Journal of Economics 129(4), 1553 to 1623",
      url: "https://opportunityinsights.org/paper/land-of-opportunity/" },
    { id: "charles2003", cite: "Charles, K. K. & Hurst, E. (2003), The correlation of wealth across generations, Journal of Political Economy 111(6), 1155 to 1182" },
    { id: "clark2014", cite: "Clark, G. (2014), The Son Also Rises: Surnames and the History of Social Mobility, Princeton University Press" },
    { id: "ruby2018", cite: "Ruby, J. G. et al. (2018), Estimates of the heritability of human longevity are substantially inflated due to assortative mating, Genetics 210(3), 1109 to 1124",
      url: "https://academic.oup.com/genetics/article/210/3/1109/5931081" },
    { id: "blau1967", cite: "Blau, P. M. & Duncan, O. D. (1967), The American Occupational Structure, Wiley" }
  ];

  /* Derived helpers every scene may use. */
  /* A `source` field anywhere in this file is an ID into SOURCES, never text
     a reader should see. Printing the raw key put "Source: silventoinen2003"
     on the page. Resolve through here, and fall back to the key rather than to
     nothing, so a broken id is visible in review instead of silently blank. */
  function cite(id) {
    if (!id) return "";
    for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].id === id) return SOURCES[i].cite;
    return String(id);
  }
  function citeUrl(id) {
    for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].id === id) return SOURCES[i].url || "";
    return "";
  }

  function halfLife(r) { return Math.log(0.5) / Math.log(r); }
  function byDomain(d) { return DYNASTIES.filter(function (x) { return x.domain === d; }); }
  function galtonFit() {
    return RTM.ols(GALTON, function (d) { return d[0]; }, function (d) { return d[1]; }, function (d) { return d[2]; });
  }

  return {
    TRAITS: TRAITS, DYNASTIES: DYNASTIES, GALTON: GALTON,
    HEIGHT: HEIGHT, OFFICE_RUBRIC: OFFICE_RUBRIC, SOURCES: SOURCES,
    halfLife: halfLife, byDomain: byDomain, galtonFit: galtonFit,
    cite: cite, citeUrl: citeUrl
  };
})();
