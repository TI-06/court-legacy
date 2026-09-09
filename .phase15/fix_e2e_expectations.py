from pathlib import Path

root = Path("tests/e2e")
old_cta = "この編成で試合開始"
new_cta = "この編成・戦術で試合開始"
old_privacy = "対人戦では相手選手の詳細能力は非公開です。公開戦力を見て編成を決めます。"
new_privacy = "対人戦では相手選手の詳細能力は非公開です。公開戦力と戦術傾向を見て編成を決めます。"

for path in root.glob("*.ts"):
    text = path.read_text(encoding="utf-8")
    updated = text.replace(old_cta, new_cta).replace(old_privacy, new_privacy)
    if updated != text:
        path.write_text(updated, encoding="utf-8")

path = root / "phase15-tactics-ux.spec.ts"
text = path.read_text(encoding="utf-8")
text = text.replace(
    'await page.getByRole("button", { name: /^強気/ }).click();',
    'const serveGroup = page.getByRole("group", { name: "サーブ戦術" });\n    await serveGroup.locator("button:not(.is-active)").first().click();',
)
text = text.replace(
    'await page.getByRole("button", { name: /^高速/ }).click();',
    'const attackGroup = page.getByRole("group", { name: "攻撃戦術" });\n    await attackGroup.locator("button:not(.is-active)").first().click();',
)
path.write_text(text, encoding="utf-8")
