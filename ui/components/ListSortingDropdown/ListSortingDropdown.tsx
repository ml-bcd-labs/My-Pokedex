import { useContext, useState } from "react";
import PokemonContext from "../../../context/PokemonContext";
import Dropdown from "../Dropdown/Dropdown";
import {
  ASCENDING_ID,
  DESCENDING_ID,
  ASCENDING_NAME,
  DESCENDING_NAME,
  SPEED_DESC,
  SPEED_ASC,
  ATTACK_DESC,
  ATTACK_ASC,
  DEFENSE_DESC,
  DEFENSE_ASC,
  HP_DESC,
  HP_ASC,
} from "../../../constants/SortingTypes";
import {
  sortByNumberFieldAsc,
  sortByNumberFieldDesc,
  sortByStringFieldAsc,
  sortByStringFieldDesc,
  sortByStatAsc,
  sortByStatDesc,
} from "../../../utils/arraySorting";
import { useStrings } from "../../../hooks/useLocale";

// Base-stat tuple positions: [hp, attack, defense, speed].
const HP_I = 0;
const ATTACK_I = 1;
const DEFENSE_I = 2;
const SPEED_I = 3;

const NUMBER_OPTIONS = [ASCENDING_ID, DESCENDING_ID];
const NAME_OPTIONS = [ASCENDING_NAME, DESCENDING_NAME];
// User-facing order: Speed, Attack, Defense, HP — each highest-first then lowest-first.
const STAT_OPTIONS = [
  SPEED_DESC,
  SPEED_ASC,
  ATTACK_DESC,
  ATTACK_ASC,
  DEFENSE_DESC,
  DEFENSE_ASC,
  HP_DESC,
  HP_ASC,
];
const sortingOptions = [...NUMBER_OPTIONS, ...NAME_OPTIONS, ...STAT_OPTIONS];

type FormattingFunction = (array: IBasicPokemon[]) => IBasicPokemon[];

const sortingMap: { [key: string]: FormattingFunction } = {
  [ASCENDING_ID]: (pokemons) => sortByNumberFieldAsc(pokemons, "id"),
  [DESCENDING_ID]: (pokemons) => sortByNumberFieldDesc(pokemons, "id"),
  [ASCENDING_NAME]: (pokemons) => sortByStringFieldAsc(pokemons, "name"),
  [DESCENDING_NAME]: (pokemons) => sortByStringFieldDesc(pokemons, "name"),
  [SPEED_DESC]: (pokemons) => sortByStatDesc(pokemons, SPEED_I),
  [SPEED_ASC]: (pokemons) => sortByStatAsc(pokemons, SPEED_I),
  [ATTACK_DESC]: (pokemons) => sortByStatDesc(pokemons, ATTACK_I),
  [ATTACK_ASC]: (pokemons) => sortByStatAsc(pokemons, ATTACK_I),
  [DEFENSE_DESC]: (pokemons) => sortByStatDesc(pokemons, DEFENSE_I),
  [DEFENSE_ASC]: (pokemons) => sortByStatAsc(pokemons, DEFENSE_I),
  [HP_DESC]: (pokemons) => sortByStatDesc(pokemons, HP_I),
  [HP_ASC]: (pokemons) => sortByStatAsc(pokemons, HP_I),
};

const ListSortingDropdown = () => {
  const [sortingType, setSortingType] = useState<SortingType>(ASCENDING_ID);
  const { pokemons, setFilteredPokemons } = useContext(PokemonContext);
  const strings = useStrings();

  // Display labels keyed by the sort constant. The <option> value stays the
  // constant (so the sort logic is unchanged); only the visible text localizes.
  const sortLabels: { [key: string]: string } = {
    [ASCENDING_ID]: strings.sortAscNumber,
    [DESCENDING_ID]: strings.sortDescNumber,
    [ASCENDING_NAME]: strings.sortAscName,
    [DESCENDING_NAME]: strings.sortDescName,
    [SPEED_DESC]: strings.sortSpeedDesc,
    [SPEED_ASC]: strings.sortSpeedAsc,
    [ATTACK_DESC]: strings.sortAttackDesc,
    [ATTACK_ASC]: strings.sortAttackAsc,
    [DEFENSE_DESC]: strings.sortDefenseDesc,
    [DEFENSE_ASC]: strings.sortDefenseAsc,
    [HP_DESC]: strings.sortHpDesc,
    [HP_ASC]: strings.sortHpAsc,
  };

  const groups = [
    { label: strings.sortGroupNumber, options: NUMBER_OPTIONS },
    { label: strings.sortGroupName, options: NAME_OPTIONS },
    { label: strings.sortGroupStat, options: STAT_OPTIONS },
  ];

  const handleOptionSelectionChange = (option: SortingType) => {
    setFilteredPokemons(sortingMap[option](pokemons));
    setSortingType(option);
  };

  return (
    <Dropdown<SortingType>
      selectedOption={sortingType}
      options={sortingOptions}
      groups={groups}
      label={strings.sortLabel}
      renderLabel={(option) => sortLabels[option] ?? option}
      handleOptionSelectionChange={handleOptionSelectionChange}
    />
  );
};

export default ListSortingDropdown;
