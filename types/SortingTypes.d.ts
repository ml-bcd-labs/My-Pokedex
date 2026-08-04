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
} from "../constants/SortingTypes";

declare global {
  export type SortingType =
    | typeof ASCENDING_ID
    | typeof DESCENDING_ID
    | typeof ASCENDING_NAME
    | typeof DESCENDING_NAME
    | typeof SPEED_DESC
    | typeof SPEED_ASC
    | typeof ATTACK_DESC
    | typeof ATTACK_ASC
    | typeof DEFENSE_DESC
    | typeof DEFENSE_ASC
    | typeof HP_DESC
    | typeof HP_ASC;
}
