from pathlib import Path

path = Path(".github/phase21-task5-apply.py")
text = path.read_text()
start_marker = "replace_once(\n    model,\n    '''  if (notification) {"
end_marker = "\n\ncenter = \"src/features/home/HomeCommandCenter.tsx\""
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("Task5 Home news patch block not found")

corrected = r'''replace_once(
    model,
    '''  if (notification) {
    candidates.push({
      order: notification.readAtGameDate === null ? 0 : 40,
      news: {
        id: `news:training:${notification.id}`,
''',
    '''  if (specialRelationship) {
    const actionLabel =
      specialRelationship.payload.action === "established" ? "成立" : "解消";
    candidates.push({
      order: specialRelationship.readAtGameDate === null ? 2 : 42,
      news: {
        id: `news:relationship:${specialRelationship.id}`,
        kind: "special-relationship",
        title: `${specialRelationship.payload.kindLabel}関係が${actionLabel}`,
        detail: `${specialRelationship.payload.displayNames[0]} × ${specialRelationship.payload.displayNames[1]}`,
        notification: specialRelationship,
      },
    });
  }

  if (notification) {
    candidates.push({
      order: notification.readAtGameDate === null ? 0 : 40,
      news: {
        id: `news:training:${notification.id}`,
''',
)'''

path.write_text(text[:start] + corrected + text[end:])
exec(compile(path.read_text(), str(path), "exec"))
