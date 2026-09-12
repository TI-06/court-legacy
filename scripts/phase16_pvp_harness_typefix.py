from pathlib import Path

app_path = Path("src/app/createBrowserAppDependencies.ts")
source = app_path.read_text()

old_import = 'import { autoSelectTeam } from "../domain/team/autoSelectTeam";\n'
new_import = (
    'import { autoSelectTeam } from "../domain/team/autoSelectTeam";\n'
    'import { deriveMatchTacticPlan } from "../domain/team/matchTactics";\n'
)
assert old_import in source
source = source.replace(old_import, new_import, 1)

old_tactics = "      tactics: request.matchTactics ?? school.tactics,\n"
new_tactics = (
    "      tactics:\n"
    "        request.matchTactics ?? deriveMatchTacticPlan(school.tactics),\n"
)
assert old_tactics in source
source = source.replace(old_tactics, new_tactics, 1)

old_block = '''    if (request.command.type === "set-match-tactics") {
      session.tactics = request.command.plan;
    } else if (request.command.type === "substitute") {
      const rotation = session.selection.rotation.map((assignment) =>
        assignment.playerId === request.command.outgoingPlayerId
          ? { ...assignment, playerId: request.command.incomingPlayerId }
          : assignment,
      );
      session.selection = {
        ...session.selection,
        rotation,
        benchPlayerIds: [
          ...session.selection.benchPlayerIds.filter(
            (id) => id !== request.command.incomingPlayerId,
          ),
          request.command.outgoingPlayerId,
        ],
        servingOrderPlayerIds: session.selection.servingOrderPlayerIds.map(
          (id) =>
            id === request.command.outgoingPlayerId
              ? request.command.incomingPlayerId
              : id,
        ),
      };
    }
'''
new_block = '''    const command = request.command;
    if (command.type === "set-match-tactics") {
      session.tactics = command.plan;
    } else if (command.type === "substitute") {
      const rotation = session.selection.rotation.map((assignment) =>
        assignment.playerId === command.outgoingPlayerId
          ? { ...assignment, playerId: command.incomingPlayerId }
          : assignment,
      );
      session.selection = {
        ...session.selection,
        rotation,
        benchPlayerIds: [
          ...session.selection.benchPlayerIds.filter(
            (id) => id !== command.incomingPlayerId,
          ),
          command.outgoingPlayerId,
        ],
        servingOrderPlayerIds: session.selection.servingOrderPlayerIds.map(
          (id) =>
            id === command.outgoingPlayerId ? command.incomingPlayerId : id,
        ),
      };
    }
'''
assert old_block in source
source = source.replace(old_block, new_block, 1)
app_path.write_text(source)

unit_path = Path("tests/unit/app/Phase16PvpMatchCommand.test.tsx")
unit = unit_path.read_text()
old_parameter = '''function baseApi(
  snapshot: CloudGameSnapshot,
'''
new_parameter = '''function baseApi(
  _snapshot: CloudGameSnapshot,
'''
assert old_parameter in unit
unit = unit.replace(old_parameter, new_parameter, 1)
unit_path.write_text(unit)
