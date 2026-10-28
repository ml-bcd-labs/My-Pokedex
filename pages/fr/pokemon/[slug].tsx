import { Fragment, useContext, useEffect, type CSSProperties } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";

import styles from "../../details/Details.module.css";
import { FR_POKEMON } from "../../../constants/Routes";
import { MAX_POKEMON_ID_ALLOWED } from "../../../constants/FetchPokemons";
import { LOW_RESOLUTION } from "../../../constants/Resolution";
import LoadingContext from "../../../context/LoadingContext";
import ResolutionContext from "../../../context/ResolutionContext";
import { usePokemonPic } from "../../../hooks/usePokemonPic";
import { useStrings } from "../../../hooks/useLocale";
import { buildFrSlugMaps, fetchPokemonDetailFrBySlug } from "../../../services/fetchPokemons/fetchPokemonsFr";
import { slugify } from "../../../utils/slugify";
import Header from "../../../ui/components/Header/Header";
import EvolutionStageFr from "../../../ui/components/EvolutionStage/EvolutionStageFr";
import Footer from "../../../ui/components/Footer/Footer";
import ErrorScreenWrapper from "../../../ui/components/Wrappers/ErrorScreenWrapper/ErrorScreenWrapper";
import { getTypeColor, getTypeChipColor } from "../../../utils/typeColors";
import TypeIcon from "../../../ui/components/PokemonType/typeIcons";
import { capitalizeFirstLetter, formatNumberToMatchLength } from "../../../utils/stringManipulation";
import { convertCmtoMeterString, cmToFeetString, joinValueWithUnit, kgToPoundsString } from "../../../utils/unitConverter";
import { FR_TYPE_LABELS } from "../../../constants/FrTypeLabels";
import { FR_STAT_LABELS } from "../../../constants/FrStatLabels";
import { hreflangAlternates } from "../../../utils/hreflang";
import { breadcrumbJsonLd } from "../../../utils/structuredData";
import { generationFromId } from "../../../constants/Generations";
import { baseStatTotal, frDetailDescription } from "../../../utils/pokemonMeta";
import { geoIntroFr } from "../../../utils/fr/geoIntro";
import type { SwitchTarget } from "../../../context/SwitchTargetContext";

const MAX_STAT_VALUE = 200;
const FACTOR_LABEL: Record<number, string> = { 0: "0", 0.25: "0.25", 0.5: "0.5", 1: "1", 2: "2", 4: "4" };

type FrDetailsPageProps = IFullPokemon & {
  prevSlug: string | null;
  nextSlug: string | null;
  slug: string;
  switchTarget?: SwitchTarget;
};

const FrDetailsPage = ({
  id,
  pixelImageUrl,
  hdImageUrl,
  name,
  stats,
  height,
  weight,
  types,
  defensiveEffectiveness,
  offensiveEffectiveness,
  evolutionChain,
  frName,
  frCategory,
  frDescription,
  frAbilities,
  prevSlug,
  nextSlug,
  slug,
}: FrDetailsPageProps) => {
  const strings = useStrings();
  const { setLoading } = useContext(LoadingContext);
  const { resolution } = useContext(ResolutionContext);
  const imageUrl = usePokemonPic(pixelImageUrl, hdImageUrl);
  // AA-safe deepened type colour for the full-bleed gradient: the page carries
  // white text (h1, body, stat labels) over it, and the raw type colour left
  // light types (electric, ice) below WCAG contrast. Matches the card + chips.
  const color = getTypeChipColor(types.split(",")[0]);
  const typeList = types.split(",");
  const displayName = frName ?? name;
  const typeLabel = (type: string) => FR_TYPE_LABELS[type] ?? capitalizeFirstLetter(type);
  // English detail slug for the reciprocal `en` hreflang alternate. `name` is the
  // (kept) English resource name, whose slug equals the /pokemon/[slug] route slug.
  const enSlug = slugify(name);

  // Server-rendered GEO opener: French entity + English name anchor + type + gen.
  const geoIntro = geoIntroFr({
    frName: displayName,
    enName: name,
    frTypes: typeList.map(typeLabel),
    gen: generationFromId(id),
  });

  const setLoadingToFalse = () => setLoading(false);
  useEffect(setLoadingToFalse, [id, setLoading]);

  // Warm the browser cache for the neighbouring Pokemon so Prev/Next shows the
  // image instantly instead of waiting on a fresh request. Pixel art is tiny so it
  // is always prefetched; the heavier HD art is only prefetched in high-res mode.
  // Images are id-based, so warming stays keyed on id ± 1 even though nav is by slug.
  useEffect(() => {
    const preload = (targetId: number) => {
      if (targetId < 1 || targetId > MAX_POKEMON_ID_ALLOWED) return;
      const urls = [`/pokemon/pixel/${targetId}.webp`];
      if (resolution !== LOW_RESOLUTION) {
        urls.push(`/pokemon/full/${formatNumberToMatchLength(targetId)}.webp`);
      }
      urls.forEach((src) => ReactDOM.preload(src, { as: "image" }));
    };
    preload(id - 1);
    preload(id + 1);
  }, [id, resolution]);

  const effClass = (factor: number) =>
    factor === 0 ? styles.immune : factor > 1 ? styles.weak : factor < 1 ? styles.resist : styles.normal;

  const renderEffectivenessGrid = (label: string, list: ITypeEffectiveness[]) => (
    <div className={styles.effBlock}>
      <div className={styles.effLabel}>{label}</div>
      <div className={styles.eff}>
        {list.map(({ type, factor }) => (
          <span
            key={type}
            className={`${styles.effTile} ${effClass(factor)}`}
            style={{ "--c": getTypeColor(type), "--chip": getTypeChipColor(type) } as CSSProperties}
            title={`${typeLabel(type)}: x${FACTOR_LABEL[factor]}`}
          >
            <TypeIcon type={type} className={styles.effIcon} />
            <span className={styles.effType}>{typeLabel(type)}</span>
            <span className={styles.effMult}>x{FACTOR_LABEL[factor]}</span>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Header
        title={`${displayName} (#${formatNumberToMatchLength(id)}) — Stats, Types, Faiblesses & Évolution | Pokédex`}
        description={frDetailDescription({
          displayName,
          category: frCategory ?? "",
          typesLabel: typeList.map(typeLabel).join("/"),
          id,
          gen: generationFromId(id),
          bst: baseStatTotal(stats),
        })}
        canonicalPath={`/fr/pokemon/${slug}`}
        alternates={hreflangAlternates(`/pokemon/${enSlug}`, `/fr/pokemon/${slug}`)}
        ogLocale="fr_FR"
        image={hdImageUrl}
        imageAlt={`Illustration de ${displayName}`}
        ogType="article"
        twitterCard="summary"
        jsonLd={breadcrumbJsonLd(
          [
            { name: "Pokédex", path: "/fr" },
            { name: displayName, path: `/fr/pokemon/${slug}` },
          ],
          "fr",
        )}
      />
      {/* Plan 6: hreflang, og:locale fr_FR, self-canonical, BreadcrumbList JSON-LD, GEO opener, localized alt */}
      <ErrorScreenWrapper>
        {/* No loading gate: the page is SSG and every field comes from
            getStaticProps, so the H1, Pokédex entry, base stats and matchups must
            be server-rendered into the HTML — not hidden behind the client-only
            Pikachu loader — for crawlers and AI features to read them. */}
        <div className={styles.wrap} style={{ "--type": color } as CSSProperties}>
            <div className={styles.inner}>
              <nav className={styles.nav}>
                {/* Links (not router.push) so Next prefetches the neighbour's data + chunk
                    while you're on the page — the first Prev/Next click is then instant
                    instead of waiting on a fetch. Boundaries stay disabled buttons since
                    an anchor can't be :disabled. */}
                {prevSlug ? (
                  <Link href={`${FR_POKEMON}${prevSlug}`} className={styles.navBtn} prefetch>
                    {strings.detailPrev}
                  </Link>
                ) : (
                  <button type="button" className={styles.navBtn} disabled>
                    {strings.detailPrev}
                  </button>
                )}
                {nextSlug ? (
                  <Link href={`${FR_POKEMON}${nextSlug}`} className={styles.navBtn} prefetch>
                    {strings.detailNext}
                  </Link>
                ) : (
                  <button type="button" className={styles.navBtn} disabled>
                    {strings.detailNext}
                  </button>
                )}
              </nav>

              <header className={styles.hero}>
                <span className={styles.watermark} aria-hidden="true">#{formatNumberToMatchLength(id)}</span>
                <div className={styles.heroTop}>
                  <h1>{displayName}</h1>
                  <div className={styles.types}>
                    {typeList.map((type) => (
                      <span
                        key={type}
                        className={styles.typeChip}
                        style={{ "--c": getTypeColor(type), "--chip": getTypeChipColor(type) } as CSSProperties}
                      >
                        <TypeIcon type={type} className={styles.typeChipIcon} />
                        {typeLabel(type)}
                      </span>
                    ))}
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.heroImg} src={imageUrl} alt={`Illustration de ${displayName}`} data-sprite="" />
              </header>

              <div className={styles.panes}>
                <section className={`${styles.glass} ${styles.entry}`}>
                  <h2 className={styles.paneTitle}>{strings.detailPokedexEntry}</h2>
                  <p>{geoIntro}</p>
                  <p>{frDescription}</p>
                </section>

                <section className={styles.glass}>
                  <h2 className={styles.paneTitle}>{strings.detailBaseStats}</h2>
                  {stats.map((stat) => (
                    <div className={styles.statline} key={stat.label}>
                      <span className={styles.statLabel}>{FR_STAT_LABELS[stat.label] ?? stat.label}</span>
                      <div className={styles.bar}>
                        <i style={{ width: `${Math.min((stat.value / MAX_STAT_VALUE) * 100, 100)}%` }} />
                      </div>
                      <span className={styles.statNum}>{stat.value}</span>
                    </div>
                  ))}
                </section>

                <section className={styles.glass}>
                  <h2 className={styles.paneTitle}>{strings.detailProfile}</h2>
                  <div className={styles.spec}>
                    <b>{strings.detailHeight}</b><span>{`${convertCmtoMeterString(height)} (${cmToFeetString(height)})`}</span>
                    <b>{strings.detailWeight}</b><span>{`${joinValueWithUnit(weight, "kg")} (${kgToPoundsString(weight)})`}</span>
                    <b>{strings.detailCategory}</b><span>{frCategory}</span>
                    <b>{strings.detailAbilities}</b><span>{frAbilities?.map(capitalizeFirstLetter).join(", ")}</span>
                  </div>
                </section>

                <section className={`${styles.glass} ${styles.effWrap}`}>
                  <h2 className={styles.paneTitle}>{strings.detailTypeEffectiveness}</h2>
                  {renderEffectivenessGrid(strings.detailDamageTaken, defensiveEffectiveness)}
                  {renderEffectivenessGrid(strings.detailDamageDealt, offensiveEffectiveness)}
                </section>

                {evolutionChain.length > 1 && (
                  <section className={`${styles.glass} ${styles.evoWrap}`}>
                    <h2 className={styles.paneTitle}>{strings.detailEvolution}</h2>
                    <div className={styles.evo}>
                      {evolutionChain.map((stage, index) => (
                        <Fragment key={stage.id}>
                          {index > 0 && (
                            <span className={styles.evoStep}>
                              <em>{stage.level ? `${strings.detailLevelPrefix} ${stage.level}` : "→"}</em>
                            </span>
                          )}
                          <EvolutionStageFr stage={stage} />
                        </Fragment>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* Footer lives inside the type-coloured area (the global one is
                suppressed in _app for this route) and pins to the bottom of it. */}
            <Footer embedded />
          </div>
      </ErrorScreenWrapper>
    </>
  );
};

export default FrDetailsPage;

export async function getStaticPaths() {
  const { slugToId } = await buildFrSlugMaps();
  const paths = Object.keys(slugToId).map((slug) => ({ params: { slug } }));

  return { paths, fallback: false };
}

export async function getStaticProps({ params }: { params: { slug: string } }) {
  const { pokemon, prevSlug, nextSlug } = await fetchPokemonDetailFrBySlug(params.slug);

  return {
    props: {
      ...pokemon,
      prevSlug,
      nextSlug,
      slug: params.slug,
      switchTarget: { en: `/pokemon/${slugify(pokemon.name)}`, fr: `/fr/pokemon/${params.slug}` },
    },
  };
}
