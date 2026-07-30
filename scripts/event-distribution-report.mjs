import {
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const DEFAULT_SEASONS = 1000;
const ROOT_SLOTS_PER_SEASON = 17;
const WEEKS_PER_SLOT = 3;
const EVENT_DIRECTORY = resolve("src/data/events");
const CATEGORIES = [
  "individual",
  "relationship",
  "practice",
  "injury",
  "academic",
  "match",
  "captaincy",
  "scouting",
  "rivalry",
  "ob",
  "rare",
  "seasonal",
];

function createRandom(seedText) {
  let state = 2166136261;
  for (const character of seedText) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function loadEvents() {
  const files = readdirSync(EVENT_DIRECTORY)
    .filter((filename) => filename.endsWith(".json"))
    .sort();
  return files.flatMap((filename) => {
    const parsed = JSON.parse(
      readFileSync(resolve(EVENT_DIRECTORY, filename), "utf8"),
    );
    if (!Array.isArray(parsed)) {
      throw new Error(`Event file must contain an array: ${filename}`);
    }
    return parsed;
  });
}

function followUpTargets(events) {
  const targets = new Set();
  for (const event of events) {
    for (const choice of event.choices) {
      if (choice.followUp) {
        targets.add(choice.followUp.eventId);
      }
      for (const effect of choice.effects) {
        if (effect.type === "schedule-event") {
          targets.add(effect.eventId);
        }
      }
    }
  }
  return targets;
}

function monthForSlot(slot) {
  const week = (slot * WEEKS_PER_SLOT) % 52;
  return Math.min(12, Math.floor(week / (52 / 12)) + 1);
}

function weightedPick(candidates, random) {
  const totalWeight = candidates.reduce(
    (total, candidate) => total + candidate.weight,
    0,
  );
  let target = random() * totalWeight;
  for (const candidate of candidates) {
    target -= candidate.weight;
    if (target <= 0) {
      return candidate.event;
    }
  }
  return candidates.at(-1)?.event ?? null;
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1;
}

function sortedRecord(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function followChain(rootEvent, eventsById, random, report) {
  let event = rootEvent;
  const visited = new Set([rootEvent.id]);
  while (event) {
    const choice = event.choices[Math.floor(random() * event.choices.length)];
    const nextId = choice?.followUp?.eventId;
    if (!nextId || visited.has(nextId)) {
      return;
    }
    const next = eventsById.get(nextId);
    if (!next) {
      throw new Error(`Unknown follow-up event: ${nextId}`);
    }
    visited.add(nextId);
    report.chainStageOccurrences += 1;
    increment(report.eventCounts, next.id);
    increment(report.categoryCounts, next.category);
    event = next;
  }
}

function analyze(events, seasons = DEFAULT_SEASONS) {
  const random = createRandom("court-legacy-event-distribution-v1");
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const targets = followUpTargets(events);
  const roots = events.filter((event) => !targets.has(event.id));
  const lastOccurrenceSlot = new Map();
  const recentEventIds = [];
  const recentCategories = [];
  const report = {
    seasons,
    catalogEvents: events.length,
    rootEventDefinitions: roots.length,
    rootOccurrences: 0,
    chainStageOccurrences: 0,
    uniqueRootEvents: 0,
    maximumRootShare: 0,
    categoryCounts: Object.fromEntries(
      CATEGORIES.map((category) => [category, 0]),
    ),
    eventCounts: {},
    unseenRootEventIds: [],
  };

  const totalSlots = seasons * ROOT_SLOTS_PER_SEASON;
  for (let slot = 0; slot < totalSlots; slot += 1) {
    const month = monthForSlot(slot);
    const candidates = roots
      .filter(
        (event) =>
          !event.trigger.months || event.trigger.months.includes(month),
      )
      .filter((event) => {
        const previous = lastOccurrenceSlot.get(event.id);
        return (
          previous === undefined ||
          (slot - previous) * WEEKS_PER_SLOT >= event.cooldownWeeks
        );
      })
      .map((event) => {
        const recentEventPenalty = recentEventIds.includes(event.id) ? 0.2 : 1;
        const recentCategoryPenalty = recentCategories.includes(event.category)
          ? 0.35
          : 1;
        return {
          event,
          weight: Math.max(
            1,
            Math.round(
              event.weight * recentEventPenalty * recentCategoryPenalty,
            ),
          ),
        };
      });

    if (candidates.length === 0) {
      throw new Error(`No root event candidate at slot ${slot}`);
    }
    const selected = weightedPick(candidates, random);
    if (!selected) {
      throw new Error(`Could not select an event at slot ${slot}`);
    }

    report.rootOccurrences += 1;
    increment(report.eventCounts, selected.id);
    increment(report.categoryCounts, selected.category);
    lastOccurrenceSlot.set(selected.id, slot);
    recentEventIds.push(selected.id);
    recentCategories.push(selected.category);
    if (recentEventIds.length > 8) {
      recentEventIds.shift();
    }
    if (recentCategories.length > 6) {
      recentCategories.shift();
    }
    followChain(selected, eventsById, random, report);
  }

  const selectedRootCounts = roots.map(
    (event) => report.eventCounts[event.id] ?? 0,
  );
  report.uniqueRootEvents = selectedRootCounts.filter((count) => count > 0).length;
  report.maximumRootShare =
    Math.max(...selectedRootCounts) / report.rootOccurrences;
  report.unseenRootEventIds = roots
    .filter((event) => !report.eventCounts[event.id])
    .map((event) => event.id)
    .sort();
  report.categoryCounts = sortedRecord(report.categoryCounts);
  report.eventCounts = sortedRecord(report.eventCounts);
  return report;
}

function formatMarkdown(report) {
  const categoryRows = Object.entries(report.categoryCounts)
    .map(([category, count]) => `| ${category} | ${count} |`)
    .join("\n");
  const unseen =
    report.unseenRootEventIds.length === 0
      ? "なし"
      : report.unseenRootEventIds.map((id) => `\`${id}\``).join(", ");
  return `# Event Distribution Report\n\n` +
    `- シミュレーション: ${report.seasons}シーズン\n` +
    `- カタログ総数: ${report.catalogEvents}本\n` +
    `- 通常抽選の起点定義: ${report.rootEventDefinitions}本\n` +
    `- 起点イベント発生数: ${report.rootOccurrences}件\n` +
    `- 連鎖ステージ発生数: ${report.chainStageOccurrences}件\n` +
    `- 発生した起点イベント: ${report.uniqueRootEvents}本\n` +
    `- 単一起点イベントの最大占有率: ${(report.maximumRootShare * 100).toFixed(2)}%\n` +
    `- 未発生の起点イベント: ${unseen}\n\n` +
    `## カテゴリ別発生数\n\n` +
    `| カテゴリ | 発生数 |\n| --- | ---: |\n${categoryRows}\n\n` +
    `このレポートは3週ごとの通常イベント抽選を1シーズン17回として、重み、月条件、クールダウン、直近イベント・カテゴリ抑制、連鎖選択を決定論的に再現しています。選手能力など個別セーブ依存の発火条件は、カタログ全体の偏りを確認するため分布分析では固定しません。\n`;
}

const events = loadEvents();
const report = analyze(events);
const writeIndex = process.argv.indexOf("--write");
if (writeIndex >= 0) {
  const destination = process.argv[writeIndex + 1];
  if (!destination) {
    throw new Error("--write requires a destination path");
  }
  writeFileSync(destination, formatMarkdown(report));
} else if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(report)}\n`);
} else {
  process.stdout.write(formatMarkdown(report));
}
