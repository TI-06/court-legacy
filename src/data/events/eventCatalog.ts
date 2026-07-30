import type { EventDefinition } from "../../domain/validation/gameDataSchema";
import academic from "./academic.json";
import captaincy from "./captaincy.json";
import chainCaptain from "./chain-captain.json";
import chainRecurringInjury from "./chain-recurring-injury.json";
import chainReserve from "./chain-reserve.json";
import chainRivalRematch from "./chain-rival-rematch.json";
import chainSetterAttacker from "./chain-setter-attacker.json";
import individual from "./individual.json";
import injury from "./injury.json";
import matchEvents from "./match.json";
import ob from "./ob.json";
import practice from "./practice.json";
import rare from "./rare.json";
import relationship from "./relationship.json";
import rivalry from "./rivalry.json";
import scouting from "./scouting.json";
import seasonal from "./seasonal.json";
import seasonalCommunity from "./seasonal-community.json";

const rawEventCatalog: unknown[] = [
  ...individual,
  ...relationship,
  ...practice,
  ...injury,
  ...academic,
  ...matchEvents,
  ...captaincy,
  ...scouting,
  ...rivalry,
  ...seasonal,
  ...seasonalCommunity,
  ...ob,
  ...rare,
  ...chainReserve,
  ...chainSetterAttacker,
  ...chainCaptain,
  ...chainRecurringInjury,
  ...chainRivalRematch,
];

export const eventCatalog = rawEventCatalog as EventDefinition[];
