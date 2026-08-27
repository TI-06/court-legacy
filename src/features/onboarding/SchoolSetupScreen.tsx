import { useState, type FormEvent } from "react";
import type { OnboardingInput } from "../../services/api/GameApiClient";
import "./onboarding.css";

const REGION_OPTIONS = [
  ["region.hokkaido", "北海道"], ["region.aomori", "青森県"],
  ["region.iwate", "岩手県"], ["region.miyagi", "宮城県"],
  ["region.akita", "秋田県"], ["region.yamagata", "山形県"],
  ["region.fukushima", "福島県"], ["region.ibaraki", "茨城県"],
  ["region.tochigi", "栃木県"], ["region.gunma", "群馬県"],
  ["region.saitama", "埼玉県"], ["region.chiba", "千葉県"],
  ["region.tokyo", "東京都"], ["region.kanagawa", "神奈川県"],
  ["region.niigata", "新潟県"], ["region.toyama", "富山県"],
  ["region.ishikawa", "石川県"], ["region.fukui", "福井県"],
  ["region.yamanashi", "山梨県"], ["region.nagano", "長野県"],
  ["region.gifu", "岐阜県"], ["region.shizuoka", "静岡県"],
  ["region.aichi", "愛知県"], ["region.mie", "三重県"],
  ["region.shiga", "滋賀県"], ["region.kyoto", "京都府"],
  ["region.osaka", "大阪府"], ["region.hyogo", "兵庫県"],
  ["region.nara", "奈良県"], ["region.wakayama", "和歌山県"],
  ["region.tottori", "鳥取県"], ["region.shimane", "島根県"],
  ["region.okayama", "岡山県"], ["region.hiroshima", "広島県"],
  ["region.yamaguchi", "山口県"], ["region.tokushima", "徳島県"],
  ["region.kagawa", "香川県"], ["region.ehime", "愛媛県"],
  ["region.kochi", "高知県"], ["region.fukuoka", "福岡県"],
  ["region.saga", "佐賀県"], ["region.nagasaki", "長崎県"],
  ["region.kumamoto", "熊本県"], ["region.oita", "大分県"],
  ["region.miyazaki", "宮崎県"], ["region.kagoshima", "鹿児島県"],
  ["region.okinawa", "沖縄県"],
] as const;

interface SchoolSetupScreenProps {
  onSubmit(input: OnboardingInput): Promise<void>;
}

export function SchoolSetupScreen({ onSubmit }: SchoolSetupScreenProps) {
  const [displayName, setDisplayName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolShortName, setSchoolShortName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [regionId, setRegionId] = useState("region.chiba");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    try {
      await onSubmit({
        displayName: displayName.trim(),
        schoolName: schoolName.trim(),
        schoolShortName: schoolShortName.trim(),
        coachName: coachName.trim(),
        regionId,
      });
    } catch {
      setError("学校データを作成できませんでした。入力内容を残したまま再試行できます。");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card" aria-labelledby="school-setup-title">
        <div className="onboarding-heading">
          <span>COURT LEGACY</span>
          <h1 id="school-setup-title">学校をつくる</h1>
          <p>最初のチームを作成します。学校の歴史はこのアカウントに保存されます。</p>
        </div>

        {error ? <div className="onboarding-error" role="alert">{error}</div> : null}
        {pending ? <div className="onboarding-status" role="status">学校データを作成しています…</div> : null}

        <form className="onboarding-form" onSubmit={submit}>
          <label>表示名<input maxLength={40} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label>
          <label>学校名<input maxLength={60} onChange={(event) => setSchoolName(event.target.value)} required value={schoolName} /></label>
          <label>略称<input maxLength={30} onChange={(event) => setSchoolShortName(event.target.value)} required value={schoolShortName} /></label>
          <label>監督名<input maxLength={40} onChange={(event) => setCoachName(event.target.value)} required value={coachName} /></label>
          <label>都道府県<select onChange={(event) => setRegionId(event.target.value)} value={regionId}>{REGION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button disabled={pending} type="submit">{pending ? "作成中…" : "学校を作成"}</button>
        </form>
      </section>
    </main>
  );
}
