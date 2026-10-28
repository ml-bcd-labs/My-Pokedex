import { Fragment, useContext, useEffect, type CSSProperties } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";

import styles from "../details/Details.module.css";
import { POKEMON } from "../../constants/Routes";
import { MAX_POKEMON_ID_ALLOWED } from "../../constants/FetchPokemons";
import { LOW_RESOLUTION } from "../../constants/Resolution";
import LoadingContext from "../../context/LoadingContext";
import ResolutionContext from "../../context/ResolutionContext";
import { usePokemonPic } from "../../hooks/usePokemonPic";
import { buildEnSlugMaps, fetchPokemonDetailEnBySlug } from "../../services/fetchPokemons/fetchPokemons";
import { buildFrSlugMaps } from "../../services/fetchPokemons/fetchPokemonsFr";
import Header from "../../ui/components/Header/Header";
import EvolutionStage from "../../ui/components/EvolutionStage/EvolutionStage";
import Footer from "../../ui/components/Footer/Footer";
import ErrorScreenWrapper from "../../ui/components/Wrappers/ErrorScreenWrapper/ErrorScreenWrapper";
import { getTypeColor, getTypeChipColor } from "../../utils/typeColors";
import TypeIcon from "../../ui/components/PokemonType/typeIcons";
import { capitalizeFirstLetter, formatNumberToMatchLength } from "../../utils/stringManipulation";
import { convertCmtoMeterString, cmToFeetString, joinValueWithUnit, kgToPoundsString } from "../../utils/unitConverter";
import { breadcrumbJsonLd } from "../../utils/structuredData";
import { hreflangAlternates } from "../../utils/hreflang";
import { generationFromId } from "../../constants/Generations";
import { baseStatTotal, enDetailDescription, enDetailTitle } from "../../utils/pokemonMeta";
import type { SwitchTarget } from "../../context/SwitchTargetContext";

const MAX_STAT_VALUE = 200;
const FACTOR_LABEL: Record<number, string> = { 0: "0", 0.25: "0.25", 0.5: "0.5", 1: "1", 2: "2", 4: "4" };

// `frSlug` is the French detail slug for this id, resolved at build time solely to
// emit the reciprocal `fr` hreflang alternate — it does not affect the visible page.
// `slug` is this page's own English slug; `prevSlug`/`nextSlug` are the adjacent
// ids' slugs for the Prev/Next nav (null at the Pokédex boundaries).
type DetailsPageProps = IFullPokemon & {
  slug: string;
  prevSlug: string | null;
  nextSlug: string | null;
  frSlug: string;
  switchTarget?: SwitchTarget;
};

const DetailsPage = ({
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
  abilities,
  description,
  category,
  slug,
  prevSlug,
  nextSlug,
  frSlug,
}: DetailsPageProps) => {
  const { setLoading } = useContext(LoadingContext);
  const { resolution } = useContext(ResolutionContext);
  const imageUrl = usePokemonPic(pixelImageUrl, hdImageUrl);
  // AA-safe deepened type colour for the full-bleed gradient: the page carries
  // white text (h1, body, stat labels) over it, and the raw type colour left
  // light types (electric, ice) below WCAG contrast. Matches the card + chips.
  const color = getTypeChipColor(types.split(",")[0]);
  const typeList = types.split(",");

  const setLoadingToFalse = () => setLoading(false);
  useEffect(setLoadingToFalse, [id, setLoading]);

  // Warm the browser cache for the neighbouring Pokemon so Prev/Next shows the
  // image instantly instead of waiting on a fresh request. Pixel art is tiny so it
  // is always prefetched; the heavier HD art is only prefetched in high-res mode.
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
            title={`${capitalizeFirstLetter(type)}: x${FACTOR_LABEL[factor]}`}
          >
            <TypeIcon type={type} className={styles.effIcon} />
            <span className={styles.effType}>{capitalizeFirstLetter(type)}</span>
            <span className={styles.effMult}>x{FACTOR_LABEL[factor]}</span>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Header
        title={enDetailTitle(capitalizeFirstLetter(name), id)}
        description={enDetailDescription({
          name,
          category,
          types,
          id,
          gen: generationFromId(id),
          bst: baseStatTotal(stats),
        })}
        canonicalPath={`/pokemon/${slug}`}
        alternates={hreflangAlternates(`/pokemon/${slug}`, `/fr/pokemon/${frSlug}`)}
        image={hdImageUrl}
        imageAlt={`${capitalizeFirstLetter(name)} official artwork`}
        ogType="article"
        twitterCard="summary"
        jsonLd={breadcrumbJsonLd([
          { name: "Pokédex", path: "/" },
          { name: capitalizeFirstLetter(name), path: `/pokemon/${slug}` },
        ])}
      />
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
                  <Link href={`${POKEMON}${prevSlug}`} className={styles.navBtn} prefetch>
                    &lt; Prev
                  </Link>
                ) : (
                  <button type="button" className={styles.navBtn} disabled>
                    &lt; Prev
                  </button>
                )}
                {nextSlug ? (
                  <Link href={`${POKEMON}${nextSlug}`} className={styles.navBtn} prefetch>
                    Next &gt;
                  </Link>
                ) : (
                  <button type="button" className={styles.navBtn} disabled>
                    Next &gt;
                  </button>
                )}
              </nav>

              <header className={styles.hero}>
                <span className={styles.watermark} aria-hidden="true">#{formatNumberToMatchLength(id)}</span>
                <div className={styles.heroTop}>
                  <h1>{capitalizeFirstLetter(name)}</h1>
                  <div className={styles.types}>
                    {typeList.map((type) => (
                      <span
                        key={type}
                        className={styles.typeChip}
                        style={{ "--c": getTypeColor(type), "--chip": getTypeChipColor(type) } as CSSProperties}
                      >
                        <TypeIcon type={type} className={styles.typeChipIcon} />
                        {capitalizeFirstLetter(type)}
                      </span>
                    ))}
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.heroImg} src={imageUrl} alt={`${capitalizeFirstLetter(name)} official artwork`} data-sprite="" />
              </header>

              <div className={styles.panes}>
                <section className={`${styles.glass} ${styles.entry}`}>
                  <h2 className={styles.paneTitle}>Pokedex entry</h2>
                  <p>{description}</p>
                </section>

                <section className={styles.glass}>
                  <h2 className={styles.paneTitle}>Base stats</h2>
                  {stats.map((stat) => (
                    <div className={styles.statline} key={stat.label}>
                      <span className={styles.statLabel}>{stat.label}</span>
                      <div className={styles.bar}>
                        <i style={{ width: `${Math.min((stat.value / MAX_STAT_VALUE) * 100, 100)}%` }} />
                      </div>
                      <span className={styles.statNum}>{stat.value}</span>
                    </div>
                  ))}
                </section>

                <section className={styles.glass}>
                  <h2 className={styles.paneTitle}>Profile</h2>
                  <div className={styles.spec}>
                    <b>Height</b><span>{`${convertCmtoMeterString(height)} (${cmToFeetString(height)})`}</span>
                    <b>Weight</b><span>{`${joinValueWithUnit(weight, "kg")} (${kgToPoundsString(weight)})`}</span>
                    <b>Category</b><span>{category}</span>
                    <b>Abilities</b><span>{abilities.map(capitalizeFirstLetter).join(", ")}</span>
                  </div>
                </section>

                <section className={`${styles.glass} ${styles.effWrap}`}>
                  <h2 className={styles.paneTitle}>Type effectiveness</h2>
                  {renderEffectivenessGrid("Damage taken", defensiveEffectiveness)}
                  {renderEffectivenessGrid("Damage dealt", offensiveEffectiveness)}
                </section>

                {evolutionChain.length > 1 && (
                  <section className={`${styles.glass} ${styles.evoWrap}`}>
                    <h2 className={styles.paneTitle}>Evolution</h2>
                    <div className={styles.evo}>
                      {evolutionChain.map((stage, index) => (
                        <Fragment key={stage.id}>
                          {index > 0 && (
                            <span className={styles.evoStep}>
                              <em>{stage.level ? `Lv. ${stage.level}` : "→"}</em>
                            </span>
                          )}
                          <EvolutionStage stage={stage} />
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

export default DetailsPage;

export async function getStaticPaths() {
  const { slugToId } = await buildEnSlugMaps();
  const paths = Object.keys(slugToId).map((slug) => ({ params: { slug } }));

  return { paths, fallback: false };
}

export async function getStaticProps({ params }: { params: { slug: string } }) {
  const { pokemon, prevSlug, nextSlug } = await fetchPokemonDetailEnBySlug(params.slug);
  // Resolve the French slug for this id so the head can emit the reciprocal `fr`
  // hreflang alternate. Build-time only; the visible EN page is unaffected.
  const { idToSlug } = await buildFrSlugMaps();
  const frSlug = idToSlug[pokemon.id];

  return {
    props: {
      ...pokemon,
      slug: params.slug,
      prevSlug,
      nextSlug,
      frSlug,
      switchTarget: { en: `/pokemon/${params.slug}`, fr: `/fr/pokemon/${frSlug}` },
    },
  };
}
