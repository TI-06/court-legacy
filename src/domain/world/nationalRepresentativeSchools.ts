import { schoolId, type SchoolId } from "../model/identifiers";

export type NationalRepresentativeTier = 1 | 2 | 3 | 4 | 5;

interface NationalRepresentativeDefinition {
  regionId: string;
  regionLabel: string;
  displayName: string;
  shortName: string;
  tier: NationalRepresentativeTier;
}

export interface NationalRepresentativeSchool {
  schoolId: SchoolId;
  regionId: string;
  regionLabel: string;
  displayName: string;
  shortName: string;
  reputationPoints: number;
  nationalTitles: number;
  nationalAppearances: number;
  prefecturalTitles: number;
  officialWins: number;
  officialLosses: number;
  seedStrength: number;
}

const DEFINITIONS: readonly NationalRepresentativeDefinition[] = [
  {
    regionId: "region.hokkaido",
    regionLabel: "北海道",
    displayName: "北海翔陵高校",
    shortName: "北海翔陵",
    tier: 4,
  },
  {
    regionId: "region.aomori",
    regionLabel: "青森県",
    displayName: "青森北辰高校",
    shortName: "青森北辰",
    tier: 2,
  },
  {
    regionId: "region.iwate",
    regionLabel: "岩手県",
    displayName: "盛岡蒼陵高校",
    shortName: "盛岡蒼陵",
    tier: 3,
  },
  {
    regionId: "region.miyagi",
    regionLabel: "宮城県",
    displayName: "仙台東央学院",
    shortName: "仙台東央",
    tier: 4,
  },
  {
    regionId: "region.akita",
    regionLabel: "秋田県",
    displayName: "秋田白峰高校",
    shortName: "秋田白峰",
    tier: 2,
  },
  {
    regionId: "region.yamagata",
    regionLabel: "山形県",
    displayName: "山形紅葉学院",
    shortName: "山形紅葉",
    tier: 2,
  },
  {
    regionId: "region.fukushima",
    regionLabel: "福島県",
    displayName: "福島皇星高校",
    shortName: "福島皇星",
    tier: 3,
  },
  {
    regionId: "region.ibaraki",
    regionLabel: "茨城県",
    displayName: "常陸青凪高校",
    shortName: "常陸青凪",
    tier: 3,
  },
  {
    regionId: "region.tochigi",
    regionLabel: "栃木県",
    displayName: "宇都宮梟峰学院",
    shortName: "宇都宮梟峰",
    tier: 3,
  },
  {
    regionId: "region.gunma",
    regionLabel: "群馬県",
    displayName: "上州雷煌工業",
    shortName: "上州雷煌",
    tier: 3,
  },
  {
    regionId: "region.saitama",
    regionLabel: "埼玉県",
    displayName: "武蔵翔陵学園",
    shortName: "武蔵翔陵",
    tier: 4,
  },
  {
    regionId: "region.chiba",
    regionLabel: "千葉県",
    displayName: "房総海鳴高校",
    shortName: "房総海鳴",
    tier: 4,
  },
  {
    regionId: "region.tokyo",
    regionLabel: "東京都",
    displayName: "東京明星学院",
    shortName: "東京明星",
    tier: 5,
  },
  {
    regionId: "region.kanagawa",
    regionLabel: "神奈川県",
    displayName: "横浜黒潮高校",
    shortName: "横浜黒潮",
    tier: 5,
  },
  {
    regionId: "region.niigata",
    regionLabel: "新潟県",
    displayName: "越後雪峰学園",
    shortName: "越後雪峰",
    tier: 3,
  },
  {
    regionId: "region.toyama",
    regionLabel: "富山県",
    displayName: "富山立山高校",
    shortName: "富山立山",
    tier: 2,
  },
  {
    regionId: "region.ishikawa",
    regionLabel: "石川県",
    displayName: "加賀白鷺学院",
    shortName: "加賀白鷺",
    tier: 3,
  },
  {
    regionId: "region.fukui",
    regionLabel: "福井県",
    displayName: "越前北辰高校",
    shortName: "越前北辰",
    tier: 2,
  },
  {
    regionId: "region.yamanashi",
    regionLabel: "山梨県",
    displayName: "甲斐天城高校",
    shortName: "甲斐天城",
    tier: 2,
  },
  {
    regionId: "region.nagano",
    regionLabel: "長野県",
    displayName: "信州蒼陵学園",
    shortName: "信州蒼陵",
    tier: 3,
  },
  {
    regionId: "region.gifu",
    regionLabel: "岐阜県",
    displayName: "美濃皇星高校",
    shortName: "美濃皇星",
    tier: 3,
  },
  {
    regionId: "region.shizuoka",
    regionLabel: "静岡県",
    displayName: "駿河青凪高校",
    shortName: "駿河青凪",
    tier: 4,
  },
  {
    regionId: "region.aichi",
    regionLabel: "愛知県",
    displayName: "尾張東央学院",
    shortName: "尾張東央",
    tier: 5,
  },
  {
    regionId: "region.mie",
    regionLabel: "三重県",
    displayName: "伊勢海鳴高校",
    shortName: "伊勢海鳴",
    tier: 3,
  },
  {
    regionId: "region.shiga",
    regionLabel: "滋賀県",
    displayName: "近江白峰学園",
    shortName: "近江白峰",
    tier: 3,
  },
  {
    regionId: "region.kyoto",
    regionLabel: "京都府",
    displayName: "京都朱雀高校",
    shortName: "京都朱雀",
    tier: 4,
  },
  {
    regionId: "region.osaka",
    regionLabel: "大阪府",
    displayName: "浪速明星学院",
    shortName: "浪速明星",
    tier: 5,
  },
  {
    regionId: "region.hyogo",
    regionLabel: "兵庫県",
    displayName: "神戸翔陵学園",
    shortName: "神戸翔陵",
    tier: 4,
  },
  {
    regionId: "region.nara",
    regionLabel: "奈良県",
    displayName: "大和天城高校",
    shortName: "大和天城",
    tier: 3,
  },
  {
    regionId: "region.wakayama",
    regionLabel: "和歌山県",
    displayName: "紀州黒潮高校",
    shortName: "紀州黒潮",
    tier: 2,
  },
  {
    regionId: "region.tottori",
    regionLabel: "鳥取県",
    displayName: "伯耆白峰高校",
    shortName: "伯耆白峰",
    tier: 2,
  },
  {
    regionId: "region.shimane",
    regionLabel: "島根県",
    displayName: "石見青凪学園",
    shortName: "石見青凪",
    tier: 2,
  },
  {
    regionId: "region.okayama",
    regionLabel: "岡山県",
    displayName: "吉備東央学院",
    shortName: "吉備東央",
    tier: 3,
  },
  {
    regionId: "region.hiroshima",
    regionLabel: "広島県",
    displayName: "安芸皇星高校",
    shortName: "安芸皇星",
    tier: 4,
  },
  {
    regionId: "region.yamaguchi",
    regionLabel: "山口県",
    displayName: "長州海鳴工業",
    shortName: "長州海鳴",
    tier: 3,
  },
  {
    regionId: "region.tokushima",
    regionLabel: "徳島県",
    displayName: "阿波翔陵高校",
    shortName: "阿波翔陵",
    tier: 2,
  },
  {
    regionId: "region.kagawa",
    regionLabel: "香川県",
    displayName: "讃岐白峰学園",
    shortName: "讃岐白峰",
    tier: 3,
  },
  {
    regionId: "region.ehime",
    regionLabel: "愛媛県",
    displayName: "伊予明星高校",
    shortName: "伊予明星",
    tier: 3,
  },
  {
    regionId: "region.kochi",
    regionLabel: "高知県",
    displayName: "土佐黒潮高校",
    shortName: "土佐黒潮",
    tier: 2,
  },
  {
    regionId: "region.fukuoka",
    regionLabel: "福岡県",
    displayName: "筑紫雷煌工業",
    shortName: "筑紫雷煌",
    tier: 5,
  },
  {
    regionId: "region.saga",
    regionLabel: "佐賀県",
    displayName: "肥前青凪高校",
    shortName: "肥前青凪",
    tier: 2,
  },
  {
    regionId: "region.nagasaki",
    regionLabel: "長崎県",
    displayName: "西海翔陵学院",
    shortName: "西海翔陵",
    tier: 3,
  },
  {
    regionId: "region.kumamoto",
    regionLabel: "熊本県",
    displayName: "火国皇星高校",
    shortName: "火国皇星",
    tier: 4,
  },
  {
    regionId: "region.oita",
    regionLabel: "大分県",
    displayName: "豊後白峰高校",
    shortName: "豊後白峰",
    tier: 3,
  },
  {
    regionId: "region.miyazaki",
    regionLabel: "宮崎県",
    displayName: "日向海鳴学園",
    shortName: "日向海鳴",
    tier: 3,
  },
  {
    regionId: "region.kagoshima",
    regionLabel: "鹿児島県",
    displayName: "薩摩天城高校",
    shortName: "薩摩天城",
    tier: 4,
  },
  {
    regionId: "region.okinawa",
    regionLabel: "沖縄県",
    displayName: "琉球南島高校",
    shortName: "琉球南島",
    tier: 3,
  },
] as const;

const TIER_BASE = {
  1: { reputation: 300, strength: 70 },
  2: { reputation: 430, strength: 78 },
  3: { reputation: 580, strength: 87 },
  4: { reputation: 760, strength: 97 },
  5: { reputation: 920, strength: 106 },
} as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function signedOffset(key: string, radius: number): number {
  return (stableHash(key) % (radius * 2 + 1)) - radius;
}

function historyForTier(tier: NationalRepresentativeTier) {
  return {
    nationalTitles: tier >= 5 ? 2 : tier >= 4 ? 1 : 0,
    nationalAppearances: tier * 3,
    prefecturalTitles: tier * 4,
    officialWins: tier * 18,
    officialLosses: Math.max(4, 28 - tier * 4),
  };
}

export function buildNationalRepresentativeSchools(input: {
  academicYear: number;
  excludedRegionIds?: ReadonlySet<string> | readonly string[];
}): NationalRepresentativeSchool[] {
  const excluded =
    input.excludedRegionIds instanceof Set
      ? input.excludedRegionIds
      : new Set(input.excludedRegionIds ?? []);

  return DEFINITIONS.filter(
    (definition) => !excluded.has(definition.regionId),
  ).map((definition) => {
    const base = TIER_BASE[definition.tier];
    const yearlyReputation = signedOffset(
      `${definition.regionId}:reputation:${input.academicYear}`,
      55,
    );
    const yearlyStrength = signedOffset(
      `${definition.regionId}:strength:${input.academicYear}`,
      4,
    );
    const history = historyForTier(definition.tier);
    return {
      schoolId: schoolId(
        `national-representative:${definition.regionId.replace("region.", "")}`,
      ),
      regionId: definition.regionId,
      regionLabel: definition.regionLabel,
      displayName: definition.displayName,
      shortName: definition.shortName,
      reputationPoints: Math.max(120, base.reputation + yearlyReputation),
      ...history,
      seedStrength: Math.max(45, Math.min(115, base.strength + yearlyStrength)),
    };
  });
}

export function nationalRepresentativeRegionCount(): number {
  return DEFINITIONS.length;
}
