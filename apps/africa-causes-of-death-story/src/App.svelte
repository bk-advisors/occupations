<script>
  import Scrolly from "./lib/Scrolly.svelte";
  import AgeBandBars from "./lib/AgeBandBars.svelte";
  import BarChart from "./lib/BarChart.svelte";
  import StackedShareChart from "./lib/StackedShareChart.svelte";
  import CostVsDeaths from "./lib/CostVsDeaths.svelte";
  import { meta } from "./data/meta.js";

  const scenes = [
    { chart: "age-bars", props: { title: "Where Africa's 8.3 million 2021 deaths fall", subtitle: "Total deaths in the WHO African Region, by age band" } },
    { chart: "age-bars", props: { title: "A third of all deaths happen before age five.", subtitle: "Total deaths by age band, under-5 highlighted", highlight: "<5" } },
    { chart: "bar", props: { title: "What kills children under five", subtitle: "Top causes of death, under 5 years, 2021", ageBand: "<5", topN: 10, annotation: { targetID: "1.1.9.1", note: "Malaria is the single biggest killer of African children. A bednet costs around $3 and prevents roughly half a case per person-year of use." } } },
    { chart: "bar", props: { title: "The quiet decade", subtitle: "Top causes of death, ages 5 to 14", ageBand: "5-14", topN: 10, annotation: { targetID: "3.1.1", note: "Once malaria fades, the leading killer of school-age children is the road, not a disease." } } },
    { chart: "bar", props: { title: "The productive years", subtitle: "Top causes of death, ages 15 to 49", ageBand: "15-49", topN: 10, annotation: { targetID: "1.1.3", note: "HIV/AIDS is still the largest killer of working-age Africans, three decades into the ARV era." } } },
    { chart: "bar", props: { title: "The transition starts", subtitle: "Top causes of death, ages 50 to 69", ageBand: "50-69", topN: 10, annotation: { targetID: "1.2.2", note: "COVID-19 was the largest killer in this age band in 2021." } } },
    { chart: "bar", props: { title: "By 70, non-communicable disease dominates", subtitle: "Top causes of death, ages 70+", ageBand: "70+", topN: 10 } },
    { chart: "stacked", props: { title: "The double burden, in one chart", subtitle: "Share of deaths from each cause group, within each age band" } },
    { chart: "cost", props: { title: "What's actually cheap to prevent", subtitle: "Unit cost of proven interventions, set against annual deaths from the targeted cause(s)" } },
    { chart: "age-bars", props: { title: "8.3 million people. One year. One continent.", subtitle: "And a shape that does not have to look like this." } },
  ];

  let step = 0;
  $: scene = scenes[Math.max(0, Math.min(step, scenes.length - 1))];
</script>

<article>
  <header class="hero">
    <div class="kicker">BK-Advisors · A data story</div>
    <h1>Causes of Death in Africa</h1>
    <p class="deck">
      8.3 million people died across the WHO African Region in 2021.
      Very few died from the conditions that dominate the news.
    </p>
    <p class="byline">Matthew Kuch · June 2026</p>
  </header>

  <section class="prose">
    <p class="lede">
      Over a month ago, on 15 May, another Ebola outbreak was declared in
      Uganda. The pattern that follows is familiar to anyone who lives
      here. A confirmed case. A press conference, then a global media
      frenzy. An emergency command centre stood up at the health ministry.
      WHO and Africa CDC teams deployed to support. It has happened
      before, and it will likely happen again.
    </p>
    <p>
      Since the virus was first identified in 1976, Ebola has cumulatively
      killed around <strong>15,000 people</strong> across every outbreak
      in every affected country combined. Each individual death is a
      tragedy. The half-century total, summed across DRC, Uganda, Sierra
      Leone, Liberia, Guinea and the rest, fits inside a single bad week
      of malaria mortality on this continent.
    </p>
    <p>
      That contrast got me thinking. We organise our attention around
      emergencies, and our health systems follow the same pattern. Press
      conferences, donor pledges, special task forces and parliamentary
      hearings reliably follow outbreaks. They almost never follow the
      steady, recurring, predictable causes that do most of the killing.
    </p>
    <p>
      So I wanted to step back and look at the bigger picture. What do
      Africa's <strong>8.3 million deaths in 2021</strong> look like when
      you break them down by cause and by age, separately from the news
      cycle?
    </p>
    <p class="cta">
      If you would rather poke at every cause yourself, an
      <a href="https://bk-advisors.github.io/africa-causes-of-death-explore/" target="_blank">explorable version of this dataset</a>
      is here. Same numbers, no narrative. This piece is the narrative.
    </p>
  </section>

  <Scrolly bind:value={step}>
    <div slot="chart" class="chart-slot">
      {#if scene.chart === "age-bars"}
        <AgeBandBars {...scene.props} />
      {:else if scene.chart === "bar"}
        <BarChart {...scene.props} />
      {:else if scene.chart === "stacked"}
        <StackedShareChart {...scene.props} />
      {:else if scene.chart === "cost"}
        <CostVsDeaths {...scene.props} />
      {/if}
    </div>

    <div slot="steps">
      <div class="scrolly__step" class:is-active={step === 0}>
        <p>
          Of the 8.3 million people who died in the WHO African Region in
          2021, about a third (2.7 million) were children under five.
          Another fifth were people aged 15 to 49, the working-age years.
          The rest were spread across the older bands.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 1}>
        <p>
          You will not see that under-5 number in a Western context. In
          high-income countries, child mortality is a single-digit-percent
          fraction of all deaths. In the WHO African Region it is almost a
          third. That gap tells you a lot about the state of health
          systems on the continent in 2021.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 2}>
        <p>
          The top of the under-5 killer list is familiar: malaria, lower
          respiratory infections, preterm birth complications, diarrhoea,
          and birth asphyxia. Together these five accounted for over 1.8
          million child deaths in a single year.
        </p>
        <p>
          These are the causes for which our interventions are cheapest
          and most proven. The shortfall is in delivery, not in knowing
          what to do.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 3}>
        <p>
          If a child makes it past five, the next decade is statistically
          the safest stretch of a human life. Deaths in the 5-to-14 band
          fall to roughly 460,000, less than a fifth of the under-5 total.
        </p>
        <p>
          The mix changes too. Diseases of poverty fade and what fills in
          are the more accidental hazards of childhood. After malaria, the
          biggest killers of school-age children are road injuries and
          drowning.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 4}>
        <p>
          The picture changes again in the working-age band. HIV/AIDS
          still leads, with about 245,000 deaths in 2021, despite three
          decades of antiretroviral programs. Tuberculosis, road injuries,
          COVID-19, interpersonal violence, maternal disorders and
          self-harm round out the top.
        </p>
        <p>
          The lives lost in this band are mostly people in the middle of
          working, parenting and contributing economically. Each death
          carries household-level consequences for the people around them.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 5}>
        <p>
          By the 50-to-69 band, the communicable lines start to recede.
          The chart fills with ischaemic heart disease, stroke (mostly
          haemorrhagic, a known marker of poorly-controlled hypertension),
          hypertensive heart disease, diabetes, and kidney disease.
        </p>
        <p>
          COVID-19 was the largest killer in this age band in 2021, its
          first and largest year of measurable impact on the continent to
          date.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 6}>
        <p>
          By 70 and above, non-communicable disease has taken over.
          Ischaemic heart disease, the two strokes, chronic obstructive
          pulmonary disease, and hypertensive heart disease together
          account for roughly a third of deaths in this band.
        </p>
        <p>
          Worth noting: African stroke is predominantly haemorrhagic,
          almost the inverse of the Western pattern. That is a marker of
          poorly-controlled hypertension across the population, and a
          clear signal for where primary care investment needs to go.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 7}>
        <p>
          Same data, restacked. Each row is an age band, and the coloured
          segments show what share of that band's deaths come from each
          of the three cause groups.
        </p>
        <p>
          The crossover is striking. In the under-5 band, almost every
          death is communicable, maternal or nutritional. By 70+, almost
          every death is non-communicable. Africa is in the middle of
          both halves of this transition at the same time, at scale.
        </p>
        <p>
          Most of the world's health systems were built to handle one
          wave or the other. The European model assumed an aged population
          whose communicable threats had been defeated. The WHO model
          exported in the 1980s and 1990s assumed a young population whose
          NCDs were rare. Africa is being asked to do both at once.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 8}>
        <p>
          One more cut at the same data. Each row is an intervention we
          already know works. The bar shows the annual deaths the
          targeted cause is killing today. The figure on the right is
          roughly what one unit of the intervention costs.
        </p>
        <p>
          The top four interventions (bednets, oral rehydration salts,
          vaccines, skilled birth attendance) cost pennies to tens of
          dollars per unit, against hundreds of thousands of preventable
          deaths every year. The bottom rows cost an order of magnitude
          more, against caseloads our systems are not yet equipped to
          handle.
        </p>
        <p>
          The bottleneck is delivery and the financing that pays for it.
          The medical knowledge already exists.
        </p>
      </div>

      <div class="scrolly__step" class:is-active={step === 9}>
        <p>
          The next outbreak will come. It will be in the news. The press
          conferences and emergency operations centres will assemble.
        </p>
        <p>
          The causes that take far more lives, year after year, will not
          be in the news. They are on this chart.
        </p>
      </div>
    </div>
  </Scrolly>

  <section class="prose" style="padding-top: 4rem;">
    <h2>What can we do?</h2>
    <p>
      I have written before about how I think the root cause of Africa's
      underinvestment in health is fiscal capacity: how much tax revenue a
      government can credibly raise from its own economy. The picture you
      have just scrolled through is the same argument from a different
      angle. The cheapest interventions go undelivered because the
      systems that should deliver them are starved of resources. The
      expensive ones go unbought because the budgets are already overdrawn.
    </p>
    <p>Three things, briefly. The same three I keep coming back to.</p>
    <ol>
      <li>
        <strong>Fund the cheap things to completion.</strong> Bednets,
        vaccines, ORS, skilled birth attendance, antiretrovirals. The unit
        economics are so good that "not yet at full coverage" is, at this
        point, a policy choice rather than a technical limitation.
      </li>
      <li>
        <strong>Build delivery capacity that can carry the next wave.</strong>
        A nurse who can deliver a vaccine and a statin is worth more than
        two specialists who can each deliver only one. Primary care over
        tertiary.
      </li>
      <li>
        <strong>Fix the tap.</strong> Domestic fiscal capacity is the
        constraint underneath all the others. Until African governments
        can raise enough of their own revenue, predictably and recurrently,
        every other reform sits on borrowed time.
      </li>
    </ol>
    <p style="margin-top: 2rem;">
      Keep watching for the next outbreak declaration. They will keep
      coming. Just remember the chart that sits behind the news.
    </p>
    <p>
      <em>Want to look at the numbers yourself?</em>
      <a href="https://bk-advisors.github.io/africa-causes-of-death-explore/" target="_blank">
        Explore the full WHO GHE 2021 dataset →
      </a>
    </p>
  </section>

  <section class="colophon">
    <h3>Notes &amp; references</h3>
    <ul>
      <li>
        <strong>Data</strong>: {meta.citation} Licence: {meta.licence}.
        <a href={meta.url} target="_blank" rel="noopener">{meta.url}</a>
      </li>
      <li>
        <strong>Geographic scope</strong>: {meta.region}. {meta.regionNote}
      </li>
      <li>
        <strong>Cumulative Ebola deaths since 1976</strong>: around
        15,000 across all outbreaks combined (CDC / WHO). The single
        deadliest outbreak (West Africa 2014-16) accounted for about
        11,000 of those.
      </li>
      <li>
        Cost-effectiveness figures (bednets, EPI, ORS, skilled birth
        attendance, hypertension management, ART) from
        <em>Disease Control Priorities, 3rd edition</em> (DCP3); WHO-CHOICE;
        Global Fund unit-cost analyses. Treat as orders of magnitude.
      </li>
      <li>
        On COVID-19: 2021 was the largest year of measurable COVID
        mortality in the region. The 493,000 figure is WHO's official
        estimate; some independent excess-mortality studies put the true
        2020-2022 toll higher.
      </li>
      <li>
        Earlier in this series:
        <a href="https://bk-advisors.github.io/africa-mmr-2030/" target="_blank" rel="noopener">Maternal Mortality in Africa</a>,
        <a href="https://bk-advisors.github.io/africa-measles/" target="_blank" rel="noopener">Measles in Africa</a>,
        <em>Tax Revenue as the key to Sustainable Health Financing</em>
        (LinkedIn, Feb 2026).
      </li>
    </ul>
  </section>
</article>

<style>
  article { display: block; }
  ol { padding-left: 1.5rem; }
  ol li { margin-bottom: 1em; }

  .lede {
    font-size: 1.15rem;
    line-height: 1.55;
  }

  .cta {
    border-left: 2px solid var(--age-15-49);
    padding-left: 0.85rem;
    margin-top: 1.75rem;
    font-size: 0.92rem;
    color: var(--ink-muted);
    font-style: italic;
  }

  .chart-slot {
    width: min(94%, 720px);
    padding: 1rem 0.5rem;
  }

  :global(.scrolly__step) {
    max-width: 30rem;
    background: transparent;
    border: none;
    padding: 0;
    box-shadow: none;
    transition: opacity 400ms ease;
    opacity: 0.55;
  }
  :global(.scrolly__step.is-active) {
    opacity: 1;
    background: transparent;
    border: none;
    box-shadow: none;
  }
  :global(.scrolly__step p) {
    margin: 0 0 1em;
  }
</style>
