from pathlib import Path

path = Path("src/app/GameApp.tsx")
text = path.read_text()

old_before = '''    const beforeScoutReport =
      request.target?.type === "scouting-candidate"
        ? scoutingReports.find(
            (report) => report.candidateId === request.target?.candidateId,
          )
        : undefined;'''
new_before = '''    const scoutingCandidateId =
      request.target?.type === "scouting-candidate"
        ? request.target.candidateId
        : null;
    const beforeScoutReport = scoutingCandidateId
      ? scoutingReports.find(
          (report) => report.candidateId === scoutingCandidateId,
        )
      : undefined;'''
assert text.count(old_before) == 1
text = text.replace(old_before, new_before, 1)

old_after = '''          if (request.target?.type === "scouting-candidate") {
            afterScoutReport = refreshedReports?.find(
              (report) => report.candidateId === request.target?.candidateId,
            );
          }'''
new_after = '''          if (scoutingCandidateId) {
            afterScoutReport = refreshedReports?.find(
              (report) => report.candidateId === scoutingCandidateId,
            );
          }'''
assert text.count(old_after) == 1
text = text.replace(old_after, new_after, 1)

path.write_text(text)
