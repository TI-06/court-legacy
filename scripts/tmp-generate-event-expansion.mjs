import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const outputDirectory = "src/data/events";
mkdirSync(outputDirectory, { recursive: true });

const abilityKeys = [
  "spike",
  "jump",
  "receive",
  "serve",
  "set",
  "block",
  "speed",
  "stamina",
  "decision",
  "mental",
];
const facilityKeys = [
  "gym",
  "trainingRoom",
  "analysisRoom",
  "recoveryRoom",
  "studyRoom",
  "dormitory",
  "scoutingNetwork",
  "alumniAssociation",
];

function followUp(eventId, afterWeeks = 3) {
  return { eventId, afterWeeks, probability: 100 };
}

function choice(id, label, detail, effects, nextId, afterWeeks) {
  return {
    id,
    label,
    detail,
    effects,
    ...(nextId ? { followUp: followUp(nextId, afterWeeks) } : {}),
  };
}

function choicesFor(profile, index, nextId, afterWeeks = 3) {
  const ability = abilityKeys[index % abilityKeys.length];
  if (profile === "tournament") {
    return [
      choice(
        "push",
        "勝負へ踏み込む",
        "目の前の勝利を優先し、主力の集中力を引き上げる。",
        [
          { type: "morale-change", amount: 4 },
          { type: "fatigue-change", amount: 5 },
        ],
        nextId,
        afterWeeks,
      ),
      choice(
        "prepare",
        "次戦を見据える",
        "余力と分析材料を残す代わりに、周囲の期待は少し下がる。",
        [
          { type: "ability-change", ability: "decision", amount: 2 },
          { type: "reputation-change", amount: -2 },
        ],
        nextId,
        afterWeeks,
      ),
    ];
  }
  if (profile === "alumni") {
    return [
      choice(
        "accept",
        "力を借りる",
        "OBの支援を受けて活動の幅を広げるが、対応負荷も増える。",
        [
          { type: "funds-change", amount: 35 },
          { type: "fatigue-change", amount: 3 },
        ],
        nextId,
        afterWeeks,
      ),
      choice(
        "independent",
        "現役主体で進める",
        "自分たちで決める経験を得る一方、学校外からの評価は下がる。",
        [
          { type: "trust-change", amount: 3 },
          { type: "reputation-change", amount: -2 },
        ],
        nextId,
        afterWeeks,
      ),
    ];
  }
  if (profile === "facility") {
    const facility = facilityKeys[index % facilityKeys.length];
    return [
      choice(
        "renovate",
        "今すぐ整備する",
        "資金を使って環境を改善し、長期的な育成基盤を作る。",
        [
          { type: "facility-change", facility, amount: 1 },
          { type: "funds-change", amount: -70 },
        ],
        nextId,
        afterWeeks,
      ),
      choice(
        "temporary",
        "応急対応でつなぐ",
        "評判を保つ工夫はするが、選手の納得感には課題が残る。",
        [
          { type: "reputation-change", amount: 3 },
          { type: "morale-change", amount: -2 },
        ],
        nextId,
        afterWeeks,
      ),
    ];
  }
  if (profile === "scouting") {
    return [
      choice(
        "compete",
        "正面から競う",
        "判断材料を増やして獲得へ動くが、現場の負担は大きくなる。",
        [
          { type: "ability-change", ability: "decision", amount: 2 },
          { type: "fatigue-change", amount: 4 },
        ],
        nextId,
        afterWeeks,
      ),
      choice(
        "withdraw",
        "別の候補へ切り替える",
        "体制を立て直せる一方、選手との信頼には小さな傷が残る。",
        [
          { type: "fatigue-change", amount: -4 },
          { type: "trust-change", amount: -2 },
        ],
        nextId,
        afterWeeks,
      ),
    ];
  }
  if (profile === "school") {
    return [
      choice(
        "engage",
        "部として向き合う",
        "学校生活へ貢献して信頼を得るが、練習時間は削られる。",
        [
          { type: "trust-change", amount: 3 },
          { type: "fatigue-change", amount: 3 },
        ],
        nextId,
        afterWeeks,
      ),
      choice(
        "practice",
        "練習を優先する",
        "疲労を抑えて競技へ集中する一方、チームの空気が少し重くなる。",
        [
          { type: "fatigue-change", amount: -3 },
          { type: "morale-change", amount: -2 },
        ],
        nextId,
        afterWeeks,
      ),
    ];
  }
  return [
    choice(
      "develop",
      "才能を伸ばす",
      "長所へ負荷をかけて成長を促すが、疲労が蓄積する。",
      [
        { type: "ability-change", ability, amount: 2 },
        { type: "fatigue-change", amount: 4 },
      ],
      nextId,
      afterWeeks,
    ),
    choice(
      "protect",
      "負荷を抑える",
      "信頼を積み上げながら守る一方、本人の勢いは少し落ちる。",
      [
        { type: "trust-change", amount: 3 },
        { type: "morale-change", amount: -2 },
      ],
      nextId,
      afterWeeks,
    ),
  ];
}

function standaloneEvents(group, profile, tags, items, baseMonths) {
  return items.map((item, index) => ({
    id: `event.${item.slug}`,
    version: 1,
    category: item.category,
    title: item.title,
    bodyTemplate: item.body,
    tags: [...tags, ...(item.tags ?? [])],
    trigger: item.trigger ?? { months: baseMonths },
    weight: item.weight ?? 42 + (index % 5) * 7,
    cooldownWeeks: item.cooldownWeeks ?? 18 + (index % 4) * 6,
    oncePerCareer: item.oncePerCareer ?? index % 6 === 0,
    actorCount: item.actorCount ?? 1,
    choices: choicesFor(profile, index),
  }));
}

const generationalItems = [
  { slug: "generation-first-year-impact", title: "一年生の衝撃", body: "{{player}}が入学直後の紅白戦で、上級生のブロックを打ち抜いた。", category: "rare" },
  { slug: "generation-high-contact-point", title: "届かない打点", body: "{{player}}の打点は校内の記録を越え、練習の空気を一変させた。", category: "rare" },
  { slug: "generation-national-scout-eyes", title: "全国スカウトの視線", body: "全国大会常連校の関係者が、{{player}}の練習を見に来ている。", category: "rare" },
  { slug: "generation-special-treatment-line", title: "特別扱いの境界", body: "世代級の{{player}}へ個別メニューを与える案に、部内で意見が割れた。", category: "rare" },
  { slug: "generation-senior-pride", title: "上級生の意地", body: "{{player}}の急成長に刺激され、上級生たちが練習後もコートへ残っている。", category: "rare" },
  { slug: "generation-talent-loneliness", title: "才能の孤独", body: "周囲の期待が高まるほど、{{player}}はチーム内で言葉を減らしている。", category: "rare" },
  { slug: "generation-first-slump", title: "初めての停滞", body: "何でもできていた{{player}}が、初めて思うように結果を出せずにいる。", category: "rare" },
  { slug: "generation-form-rebuild", title: "フォーム改造の誘惑", body: "{{player}}の潜在能力をさらに引き出す、大幅なフォーム改造案が出た。", category: "rare" },
  { slug: "generation-number-one-jersey", title: "背番号1の重み", body: "早くも{{player}}を中心選手として扱うべきだという声が上がっている。", category: "rare" },
  { slug: "generation-representative-camp", title: "代表候補合宿", body: "{{player}}へ年代別代表候補合宿の招集状が届いた。", category: "rare" },
  { slug: "generation-rival-school-star", title: "向こうの世代級", body: "ライバル校にも同世代の怪物が入学したという情報が入った。", category: "rare" },
  { slug: "generation-load-management", title: "才能を守る休養", body: "試合と練習が続く{{player}}に、計画的な休養を入れる必要が出てきた。", category: "rare" },
  { slug: "generation-three-year-promise", title: "三年間の約束", body: "{{player}}が監督室を訪れ、三年間で全国へ行きたいと口にした。", category: "rare" },
  { slug: "generation-shares-advice", title: "天才が教える日", body: "{{player}}が後輩へ技術を言葉で伝えようと、初めて練習を止めた。", category: "rare" },
];

const tournamentItems = [
  { slug: "tournament-draw-tension", title: "組み合わせ抽選会", body: "大会の組み合わせが発表され、序盤から強豪と当たる可能性が見えてきた。", category: "match" },
  { slug: "tournament-opening-ceremony", title: "開会式の視線", body: "会場へ入った{{player}}が、全国の強豪校の体格に目を奪われている。", category: "match" },
  { slug: "tournament-hostile-crowd", title: "完全アウェー", body: "次の相手は地元校で、会場のほとんどが相手を応援する見込みだ。", category: "rivalry" },
  { slug: "tournament-video-scouting", title: "深夜の映像分析", body: "翌日の相手映像が届いたが、確認すれば選手の睡眠時間を削ることになる。", category: "match" },
  { slug: "tournament-travel-fatigue", title: "移動日の疲労", body: "長距離移動で{{player}}の足が重く、前日練習の内容を再検討する必要がある。", category: "match" },
  { slug: "tournament-first-set-nerves", title: "初戦の硬さ", body: "大会初戦を前に、{{player}}の手が普段より冷たくなっている。", category: "captaincy" },
  { slug: "tournament-upset-window", title: "番狂わせの気配", body: "優勝候補が前試合で消耗し、勝負を仕掛ける好機が訪れた。", category: "match" },
  { slug: "tournament-quarterfinal-wall", title: "ベスト8の壁", body: "学校史上何度も敗れてきた準々決勝が、再び目の前に来た。", category: "rivalry" },
  { slug: "tournament-semifinal-night", title: "準決勝前夜", body: "眠れない{{player}}が宿舎の廊下で、一人試合映像を見返している。", category: "captaincy" },
  { slug: "tournament-final-morning", title: "決勝の朝", body: "決勝当日の朝、チームは静かすぎるほど集中している。", category: "match" },
  { slug: "tournament-match-point-timeout", title: "マッチポイントの間", body: "相手のマッチポイントでタイムアウトを取り、最後の指示を伝える時間が来た。", category: "match" },
  { slug: "tournament-bench-ready", title: "控えの準備", body: "長期戦を見越し、控えの{{player}}へ早めに出番を伝えるか判断が必要だ。", category: "individual" },
  { slug: "tournament-injury-choice", title: "大会中の違和感", body: "{{player}}が膝の違和感を訴えたが、本人は次戦への出場を望んでいる。", category: "injury" },
  { slug: "tournament-post-review", title: "大会後のレビュー", body: "大会の結果を、すぐ映像で振り返るか休養を優先するか意見が分かれた。", category: "practice" },
];

const alumniItems = [
  { slug: "alumni-open-practice", title: "OBの練習参加", body: "実業団でプレーするOBが、休日の練習へ参加したいと連絡してきた。", category: "ob" },
  { slug: "alumni-donation", title: "匿名の寄付", body: "卒業生から部へ寄付が届いたが、使い道を巡って意見が分かれている。", category: "ob" },
  { slug: "alumni-setter-session", title: "元セッターの特別講習", body: "大学で活躍したOBセッターが、{{player}}へ個別指導を申し出た。", category: "ob" },
  { slug: "alumni-block-clinic", title: "ブロックの記憶", body: "全国経験のあるOBが、昔の読み合いを現役選手へ伝えている。", category: "ob" },
  { slug: "alumni-career-talk", title: "卒業後の進路講話", body: "競技を続けるOBと就職したOBが、選手たちへ異なる将来像を語った。", category: "ob" },
  { slug: "alumni-parents-network", title: "OB保護者の支援網", body: "卒業生の保護者たちが、遠征時の支援を組織したいと申し出た。", category: "ob" },
  { slug: "alumni-bus-support", title: "遠征バスの提案", body: "OB会から専用バス購入の支援案が届き、維持費の検討が必要になった。", category: "ob" },
  { slug: "alumni-old-video", title: "倉庫の全国大会映像", body: "倉庫から過去の全国大会映像が見つかり、現在の戦術にも使えそうだ。", category: "ob" },
  { slug: "alumni-national-medalist", title: "メダリストの帰校", body: "国際大会で表彰台に立ったOBが、母校を訪問することになった。", category: "ob" },
  { slug: "alumni-coach-conflict", title: "昔の指導、今の指導", body: "古い練習方法を勧めるOBと現スタッフの間で、方針の違いが表面化した。", category: "ob" },
  { slug: "alumni-recruiting-help", title: "OBからの推薦選手", body: "地域クラブを指導するOBが、有望な中学生を紹介してきた。", category: "ob" },
  { slug: "alumni-study-room", title: "OB会の学習室案", body: "成績支援のため、OB会が空き教室を学習室に改修する案を出した。", category: "ob" },
  { slug: "alumni-anniversary", title: "創部記念試合", body: "創部記念日にOBチームとの交流試合を開催する話が進んでいる。", category: "ob" },
  { slug: "alumni-returning-captain", title: "元主将の帰還", body: "かつての主将が、今のチームに欠けている声について率直に話し始めた。", category: "ob" },
];

const facilityItems = [
  { slug: "facility-gym-floor-crack", title: "体育館床の亀裂", body: "コート中央に小さな亀裂が見つかり、安全と練習日程の両方が問題になった。", category: "seasonal" },
  { slug: "facility-lighting-upgrade", title: "照明更新の機会", body: "体育館照明の更新予算が出たが、部の負担も必要だと言われた。", category: "seasonal" },
  { slug: "facility-net-system", title: "新しいネット支柱", body: "公式規格のネット設備を導入できる期間限定の提案が届いた。", category: "practice" },
  { slug: "facility-analysis-tablet", title: "分析用タブレット", body: "試合中に映像を確認できる端末を導入する案が持ち上がった。", category: "practice" },
  { slug: "facility-recovery-bath", title: "回復設備の提案", body: "疲労対策用の回復設備を設置するか、遠征費を残すか判断が必要だ。", category: "injury" },
  { slug: "facility-weight-room", title: "空き倉庫のトレーニング室", body: "使われていない倉庫を筋力トレーニング室へ変えられる可能性が出た。", category: "practice" },
  { slug: "facility-study-room-renovation", title: "学習室の改修", body: "部員専用の学習室を整備すれば、補習による欠席を減らせそうだ。", category: "academic" },
  { slug: "facility-dorm-kitchen", title: "寮の食事環境", body: "寮の厨房設備を改善し、選手の体づくりを支える案が出ている。", category: "seasonal" },
  { slug: "facility-scouting-database", title: "スカウト情報のデータ化", body: "地域大会の選手情報を蓄積する仕組みを導入できることになった。", category: "scouting" },
  { slug: "facility-alumni-display", title: "栄光の展示棚", body: "OBの記念品を展示し、学校の歴史を伝えるスペースを作る案が出た。", category: "ob" },
  { slug: "facility-ball-machine", title: "サーブマシン導入", body: "高精度のサーブマシンを中古で譲り受けられる話が来た。", category: "practice" },
  { slug: "facility-air-conditioning", title: "真夏の空調工事", body: "熱中症対策の空調工事を入れるには、夏合宿の日程変更が必要になる。", category: "seasonal" },
  { slug: "facility-emergency-repair", title: "緊急修繕", body: "大雨で体育館の一部が使えなくなり、応急工事か外部施設利用を迫られた。", category: "seasonal" },
  { slug: "facility-shared-gym-schedule", title: "体育館の共同利用", body: "他部との利用時間調整で、朝練か夜練のどちらかを選ぶ必要がある。", category: "relationship" },
];

const schoolLifeItems = [
  { slug: "school-life-exam-week", title: "定期試験前の一週間", body: "部員の成績に差があり、全員同じ練習量で進めるか判断が必要だ。", category: "academic" },
  { slug: "school-life-culture-festival", title: "文化祭のステージ", body: "バレー部へ学校紹介ステージへの出演依頼が届いた。", category: "seasonal" },
  { slug: "school-life-typhoon-closure", title: "台風による休校", body: "体育館が使えない数日間を、休養か自主トレに充てることになった。", category: "seasonal" },
  { slug: "school-life-summer-homework", title: "終わらない夏休み課題", body: "{{player}}の課題が大量に残り、合宿参加に影響する可能性がある。", category: "academic" },
  { slug: "school-life-class-election", title: "学級委員への推薦", body: "{{player}}が学級委員に推薦され、部活との両立を相談してきた。", category: "individual" },
  { slug: "school-life-teacher-request", title: "担任からの相談", body: "担任教員が、最近眠そうな{{player}}の生活リズムを心配している。", category: "academic" },
  { slug: "school-life-morning-cleanup", title: "朝の校内清掃", body: "学校行事の清掃当番と朝練が重なり、部としての対応を求められた。", category: "seasonal" },
  { slug: "school-life-transfer-student", title: "転校生の見学", body: "バレー経験のある転校生が練習を見学し、部員たちが落ち着かない。", category: "scouting" },
  { slug: "school-life-budget-hearing", title: "部活動予算ヒアリング", body: "生徒会へ来年度予算の使い道を説明する機会が来た。", category: "captaincy" },
  { slug: "school-life-winter-flu", title: "冬の感染症流行", body: "校内で感染症が広がり、練習参加基準を厳しくする必要がある。", category: "injury" },
  { slug: "school-life-graduation-speech", title: "卒業式の答辞", body: "主将候補の{{player}}が卒業式の在校生代表に選ばれた。", category: "captaincy" },
  { slug: "school-life-family-observation", title: "保護者の練習見学", body: "保護者向けの公開練習を行う案に、選手たちが緊張している。", category: "relationship" },
  { slug: "school-life-lost-uniform", title: "消えたユニフォーム", body: "大会前日に{{player}}のユニフォームが見つからず、部内が慌ただしくなった。", category: "individual" },
  { slug: "school-life-local-volunteer", title: "地域ボランティア", body: "地域清掃への参加依頼が届き、練習試合と日程が重なっている。", category: "seasonal" },
];

const standaloneFiles = {
  "expansion-generational.json": standaloneEvents(
    "generational",
    "generational",
    ["generational", "expansion"],
    generationalItems,
    [4, 5, 6, 7, 8, 9, 10, 11],
  ),
  "expansion-tournament.json": standaloneEvents(
    "tournament",
    "tournament",
    ["tournament", "expansion"],
    tournamentItems,
    [5, 6, 7, 10, 11, 1],
  ),
  "expansion-alumni.json": standaloneEvents(
    "alumni",
    "alumni",
    ["alumni", "expansion"],
    alumniItems,
    [4, 6, 8, 10, 12, 2],
  ),
  "expansion-facility.json": standaloneEvents(
    "facility",
    "facility",
    ["facility", "expansion"],
    facilityItems,
    [4, 5, 8, 9, 12, 1, 2],
  ),
  "expansion-school-life.json": standaloneEvents(
    "school-life",
    "school",
    ["school-life", "expansion"],
    schoolLifeItems,
    [4, 5, 6, 7, 9, 10, 11, 12, 1, 2, 3],
  ),
};

function chainEvents(ids, titles, bodies, categories, profile, tags, options = {}) {
  return ids.map((id, index) => {
    const nextId = ids[index + 1];
    const isRoot = index === 0;
    let choices = choicesFor(profile, index, nextId, options.afterWeeks ?? 3);
    if (options.firstChoices && isRoot) {
      choices = options.firstChoices.map((item) => ({
        ...item,
        ...(nextId ? { followUp: followUp(nextId, options.afterWeeks ?? 3) } : {}),
      }));
    }
    return {
      id,
      version: 1,
      category: categories[index],
      title: titles[index],
      bodyTemplate: bodies[index],
      tags: [...tags, "chain", `stage-${index + 1}`],
      trigger: isRoot ? options.rootTrigger ?? {} : {},
      weight: isRoot ? options.weight ?? 34 : 1,
      cooldownWeeks: isRoot ? options.cooldownWeeks ?? 52 : 0,
      oncePerCareer: false,
      actorCount: options.actorCount ?? 1,
      choices,
    };
  });
}

const chainFiles = {
  "chain-generation.json": chainEvents(
    [
      "event.generation-arrival",
      "event.generation-spotlight",
      "event.generation-friction",
      "event.generation-trial",
      "event.generation-legacy",
    ],
    ["怪物の入学", "集まる視線", "才能への反発", "全国での試練", "世代の旗"],
    [
      "{{player}}の入学初日、誰も届かなかったトスを強烈に打ち切った。",
      "{{player}}への取材と視察が増え、日常の練習にも緊張が入り込んだ。",
      "特別メニューを続ける{{player}}と、他の部員との間に距離が生まれている。",
      "全国級の相手に{{player}}の武器が封じられ、初めて明確な課題が見えた。",
      "試練を越えた{{player}}が、自分だけでなく世代全体を引っ張る覚悟を語った。",
    ],
    ["rare", "rare", "relationship", "match", "captaincy"],
    "generational",
    ["generational", "expansion"],
    { rootTrigger: { minGrade: 1 }, weight: 24, cooldownWeeks: 78 },
  ),
  "chain-tournament.json": chainEvents(
    [
      "event.tournament-draw",
      "event.tournament-opening",
      "event.tournament-quarterfinal",
      "event.tournament-semifinal",
      "event.tournament-final",
    ],
    ["運命の抽選", "大会初戦", "準々決勝の壁", "準決勝の夜", "決勝のコート"],
    [
      "大会抽選で、勝ち上がれば因縁校と当たる山に入った。",
      "初戦の会場へ入ると、{{player}}の表情が普段より硬い。",
      "過去に何度も阻まれた準々決勝へ、今年もたどり着いた。",
      "決勝進出を懸けた前夜、{{player}}が眠れずに戦術ノートを開いている。",
      "満員の会場で決勝が始まる。三年間の選択がこの一戦へ集まっている。",
    ],
    ["match", "match", "rivalry", "captaincy", "match"],
    "tournament",
    ["tournament", "expansion"],
    { rootTrigger: { months: [5, 6, 7, 10, 11, 1] }, weight: 28, cooldownWeeks: 52, afterWeeks: 2 },
  ),
  "chain-alumni-facility.json": chainEvents(
    [
      "event.alumni-fundraising",
      "event.alumni-plan",
      "event.alumni-workday",
      "event.alumni-opening",
      "event.alumni-legacy-day",
    ],
    ["OB会の募金計画", "新施設の設計", "世代を越えた作業日", "新設備の完成", "受け継ぐ場所"],
    [
      "OB会から、老朽化した練習環境を変える募金計画が提案された。",
      "集まった意見を基に、新しい練習設備の設計案が三つまで絞られた。",
      "現役とOBが一緒に準備を進める中、方針の違いも見え始めた。",
      "長く待った設備が完成し、最初に使う練習内容を決めることになった。",
      "新しい場所に歴代主将が集まり、次の世代へ残す言葉を選んでいる。",
    ],
    ["ob", "ob", "ob", "ob", "ob"],
    "facility",
    ["alumni", "facility", "expansion"],
    { rootTrigger: { schoolReputationMin: 40 }, weight: 26, cooldownWeeks: 78, afterWeeks: 4 },
  ),
  "chain-ace-comeback.json": chainEvents(
    [
      "event.ace-injury",
      "event.ace-rehab",
      "event.ace-return-practice",
      "event.ace-selection",
      "event.ace-comeback",
    ],
    ["エースの負傷", "長いリハビリ", "コートへの一歩", "復帰戦の選択", "戻ってきた一打"],
    [
      "{{player}}が着地で足を痛め、会場が一瞬静まり返った。",
      "復帰を急ぐ{{player}}と医療スタッフの見立てに、少しずれがある。",
      "{{player}}が限定メニューでコートへ戻り、仲間が自然に集まってきた。",
      "次戦で{{player}}を先発へ戻すか、途中起用から始めるか決断が必要だ。",
      "長い離脱を越えた{{player}}が、重要な場面で再びトスを呼んだ。",
    ],
    ["injury", "injury", "practice", "match", "individual"],
    "generational",
    ["comeback", "expansion"],
    {
      rootTrigger: { injuryState: "healthy" },
      weight: 24,
      cooldownWeeks: 78,
      afterWeeks: 4,
      firstChoices: [
        choice(
          "examine",
          "すぐ検査する",
          "離脱を受け入れて原因を確認し、選手との信頼を守る。",
          [
            { type: "trust-change", amount: 3 },
            { type: "injury-set", severity: "minor", weeks: 4, recurrenceRisk: 15 },
          ],
        ),
        choice(
          "observe",
          "本人の感覚を尊重する",
          "気持ちは前向きになるが、長めの離脱につながる危険がある。",
          [
            { type: "morale-change", amount: 3 },
            { type: "injury-set", severity: "moderate", weeks: 6, recurrenceRisk: 30 },
          ],
        ),
      ],
    },
  ),
  "chain-scouting-war.json": chainEvents(
    [
      "event.scouting-rumor",
      "event.scouting-visit",
      "event.scouting-counteroffer",
      "event.scouting-decision",
      "event.scouting-aftermath",
    ],
    ["有望選手の噂", "同日の視察", "強豪校の誘い", "進路決断の日", "残った因縁"],
    [
      "地域大会に特別な中学生がいるという噂が、複数の学校へ広がった。",
      "視察会場で因縁校の監督と鉢合わせし、互いの狙いが明確になった。",
      "強豪校が施設と実績を前面に出し、候補選手へ強い印象を残した。",
      "候補選手が進路を決める日を迎え、最後に伝える言葉を選ぶ必要がある。",
      "獲得結果にかかわらず、今回の競合は両校の間に新しい火種を残した。",
    ],
    ["scouting", "rivalry", "scouting", "scouting", "rivalry"],
    "scouting",
    ["scouting-conflict", "expansion"],
    { rootTrigger: { months: [6, 7, 8, 9, 10, 11] }, weight: 32, cooldownWeeks: 52, afterWeeks: 3 },
  ),
};

for (const [filename, events] of Object.entries({
  ...standaloneFiles,
  ...chainFiles,
})) {
  writeFileSync(
    `${outputDirectory}/${filename}`,
    `${JSON.stringify(events, null, 2)}\n`,
  );
}

const catalog = `import type { EventDefinition } from "../../domain/validation/gameDataSchema";
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
`;
writeFileSync(`${outputDirectory}/eventCatalog.ts`, catalog);

const guidePath = "docs/event-authoring.md";
let guide = readFileSync(guidePath, "utf8");
guide = guide
  .replace("- 単発イベント: 70本", "- 単発イベント: 140本")
  .replace("- 連鎖イベント: 5系統 × 3段階 = 15本", "- 連鎖イベント: 既存5系統×3段階＋追加5系統×5段階 = 40本")
  .replace("- 合計: 85本", "- 合計: 180本")
  .replace(
    "連鎖イベントは、控え選手の不満、セッターとアタッカーの信頼、主将の自信、再発性の怪我、因縁校との再戦の5系統です。",
    "連鎖イベントは、既存の5系統に加え、世代級選手、大会勝ち上がり、OB設備支援、エース復帰、スカウト競合の5系統を追加しています。",
  );
writeFileSync(guidePath, guide);
