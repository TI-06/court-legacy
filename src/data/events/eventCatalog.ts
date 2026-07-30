import type { EventDefinition } from "../../domain/validation/gameDataSchema";
import academic from "./academic.json" with { type: "json" };
import captaincy from "./captaincy.json" with { type: "json" };
import chainAceComeback from "./chain-ace-comeback.json" with { type: "json" };
import chainAlumniFacility from "./chain-alumni-facility.json" with { type: "json" };
import chainCaptain from "./chain-captain.json" with { type: "json" };
import chainGeneration from "./chain-generation.json" with { type: "json" };
import chainRecurringInjury from "./chain-recurring-injury.json" with { type: "json" };
import chainReserve from "./chain-reserve.json" with { type: "json" };
import chainRivalRematch from "./chain-rival-rematch.json" with { type: "json" };
import chainScoutingWar from "./chain-scouting-war.json" with { type: "json" };
import chainSetterAttacker from "./chain-setter-attacker.json" with { type: "json" };
import chainTournament from "./chain-tournament.json" with { type: "json" };
import expansionAlumni from "./expansion-alumni.json" with { type: "json" };
import expansionFacility from "./expansion-facility.json" with { type: "json" };
import expansionGenerational from "./expansion-generational.json" with { type: "json" };
import expansionSchoolLife from "./expansion-school-life.json" with { type: "json" };
import expansionTournament from "./expansion-tournament.json" with { type: "json" };
import individual from "./individual.json" with { type: "json" };
import injury from "./injury.json" with { type: "json" };
import matchEvents from "./match.json" with { type: "json" };
import ob from "./ob.json" with { type: "json" };
import practice from "./practice.json" with { type: "json" };
import rare from "./rare.json" with { type: "json" };
import relationship from "./relationship.json" with { type: "json" };
import rivalry from "./rivalry.json" with { type: "json" };
import scouting from "./scouting.json" with { type: "json" };
import seasonal from "./seasonal.json" with { type: "json" };
import seasonalCommunity from "./seasonal-community.json" with { type: "json" };

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
  ...expansionGenerational,
  ...expansionTournament,
  ...expansionAlumni,
  ...expansionFacility,
  ...expansionSchoolLife,
  ...chainReserve,
  ...chainSetterAttacker,
  ...chainCaptain,
  ...chainRecurringInjury,
  ...chainRivalRematch,
  ...chainGeneration,
  ...chainTournament,
  ...chainAlumniFacility,
  ...chainAceComeback,
  ...chainScoutingWar,
];

export const eventCatalog = rawEventCatalog as EventDefinition[];
