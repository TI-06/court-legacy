import json
from pathlib import Path

path = Path("src/data/events/relationship.json")
data = json.loads(path.read_text())
by_id = {event["id"]: event for event in data}


def event(event_id: str):
    if event_id not in by_id:
        raise SystemExit(f"missing event: {event_id}")
    return by_id[event_id]


def choice(target, choice_id: str):
    for item in target["choices"]:
        if item["id"] == choice_id:
            return item
    raise SystemExit(f"missing choice {choice_id} in {target['id']}")


def append_unique_effect(target_choice, effect):
    if effect not in target_choice["effects"]:
        target_choice["effects"].append(effect)


rival = event("event.position-rivalry")
rival["trigger"]["samePreferredPosition"] = True
append_unique_effect(
    choice(rival, "competition"),
    {"type": "special-relationship-add", "kind": "rival"},
)

mentor = event("event.senior-junior-serve")
mentor["trigger"]["differentGrades"] = True
mentor["trigger"]["relationship"] = {"min": 54}
append_unique_effect(
    choice(mentor, "encourage"),
    {
        "type": "special-relationship-add",
        "kind": "mentor",
        "mentor": "higher-grade",
    },
)

partner = event("event.shared-video-review")
partner["trigger"]["relationship"] = {"min": 75}
append_unique_effect(
    choice(partner, "formalize"),
    {"type": "special-relationship-add", "kind": "partner"},
)

path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
