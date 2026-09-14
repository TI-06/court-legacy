from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected:
        raise RuntimeError(
            f"{path}: expected marker {expected} time(s), found {count}: {old[:100]!r}"
        )
    file.write_text(text.replace(old, new), encoding="utf-8")


# Existing economy expectations now use the approved Phase19-3 budget table.
replace_exact(
    "tests/unit/domain/school/schoolEconomy.test.ts",
    '''    expect(annualSchoolBudget("unknown")).toBe(400);\n    expect(annualSchoolBudget("district-contender")).toBe(500);\n    expect(annualSchoolBudget("prefectural-power")).toBe(650);\n    expect(annualSchoolBudget("national-qualifier")).toBe(850);\n    expect(annualSchoolBudget("national-regular")).toBe(1100);\n    expect(annualSchoolBudget("elite")).toBe(1400);''',
    '''    expect(annualSchoolBudget("unknown")).toBe(450);\n    expect(annualSchoolBudget("district-contender")).toBe(560);\n    expect(annualSchoolBudget("prefectural-power")).toBe(730);\n    expect(annualSchoolBudget("national-qualifier")).toBe(950);\n    expect(annualSchoolBudget("national-regular")).toBe(1230);\n    expect(annualSchoolBudget("elite")).toBe(1570);''',
)

replace_exact(
    "tests/unit/domain/generation/generateWorld.test.ts",
    '''    expect(school.funds).toBe(700);''',
    '''    expect(school.funds).toBe(750);''',
)
replace_exact(
    "tests/unit/domain/generation/generateWorld.test.ts",
    '''        amount: 400,\n        balanceAfter: 700,''',
    '''        amount: 450,\n        balanceAfter: 750,''',
)

# Existing facility unit tests follow the approved tiered 4.5% / 6% / 9% curve.
replace_exact(
    "tests/unit/domain/school/facilityUpgrade.test.ts",
    '''    expect(calculateFacilityUpgradeCost("trainingRoom", 3)).toBe(83);\n    expect(calculateFacilityUpgradeCost("gym", 49)).toBe(315);''',
    '''    expect(calculateFacilityUpgradeCost("trainingRoom", 3)).toBe(79);\n    expect(calculateFacilityUpgradeCost("gym", 49)).toBe(313);''',
)
replace_exact(
    "tests/unit/domain/school/facilityUpgrade.test.ts",
    '''    expect(result.schools[state.userSchoolId]!.funds).toBe(685);\n    expect(result.schoolManagement.fundsHistory.at(-1)).toMatchObject({\n      kind: "facility-upgrade",\n      amount: -315,\n      balanceAfter: 685,''',
    '''    expect(result.schools[state.userSchoolId]!.funds).toBe(687);\n    expect(result.schoolManagement.fundsHistory.at(-1)).toMatchObject({\n      kind: "facility-upgrade",\n      amount: -313,\n      balanceAfter: 687,''',
)
replace_exact(
    "tests/unit/domain/school/facilityUpgrade.test.ts",
    '''      cost: 128,\n      fundsAfter: -28,''',
    '''      cost: 116,\n      fundsAfter: -16,''',
)

# GameApp action tests now submit the explicit +1 level count and start from 750 funds.
replace_exact(
    "tests/unit/app/GameAppActions.test.tsx",
    '''        { name: "70を使って強化" },''',
    '''        { name: "+1 Lv・70を使って強化" },''',
    expected=2,
)
replace_exact(
    "tests/unit/app/GameAppActions.test.tsx",
    '''      action: { type: "facility-upgrade", facility: "trainingRoom" },\n    });\n    expect(await screen.findByText("資金 630")).toBeVisible();''',
    '''      action: {\n        type: "facility-upgrade",\n        facility: "trainingRoom",\n        levels: 1,\n      },\n    });\n    expect(await screen.findByText("資金 680")).toBeVisible();''',
)
replace_exact(
    "tests/unit/app/GameAppActions.test.tsx",
    '''    expect(screen.getByText("資金 700")).toBeVisible();''',
    '''    expect(screen.getByText("資金 750")).toBeVisible();''',
)

# Browser authority fixtures inherit the new initial school budget.
replace_exact(
    "tests/unit/app/createBrowserAppDependencies.test.ts",
    '''    ).toBe(700);''',
    '''    ).toBe(750);''',
)
replace_exact(
    "tests/unit/app/createBrowserAppDependencies.test.ts",
    '''    ).toBe(630);''',
    '''    ).toBe(680);''',
    expected=2,
)

replace_exact(
    "tests/unit/app/createBrowserAppDependencies.schoolEconomy.test.ts",
    '''    ).toBe(700);''',
    '''    ).toBe(750);''',
)
replace_exact(
    "tests/unit/app/createBrowserAppDependencies.schoolEconomy.test.ts",
    '''      result: { fundsGranted: 300, balanceAfter: 1000 },''',
    '''      result: { fundsGranted: 300, balanceAfter: 1050 },''',
)
replace_exact(
    "tests/unit/app/createBrowserAppDependencies.schoolEconomy.test.ts",
    '''    expect(after.game.state.schools[after.game.state.userSchoolId]!.funds).toBe(\n      1000,\n    );''',
    '''    expect(after.game.state.schools[after.game.state.userSchoolId]!.funds).toBe(\n      1050,\n    );''',
)
replace_exact(
    "tests/unit/app/createBrowserAppDependencies.schoolEconomy.test.ts",
    '''        balanceAfter: 1000,''',
    '''        balanceAfter: 1050,''',
)

# App integration labels/funds follow the new bulk selector UI and budget.
replace_exact(
    "tests/unit/features/school/AppSchoolCalendarFlow.test.tsx",
    '''    expect(screen.getByText("資金 700")).toBeInTheDocument();''',
    '''    expect(screen.getByText("資金 750")).toBeInTheDocument();''',
)
replace_exact(
    "tests/unit/features/school/AppSchoolCalendarFlow.test.tsx",
    '''      within(dialog).getByRole("button", { name: "70を使って強化" }),''',
    '''      within(dialog).getByRole("button", {\n        name: "+1 Lv・70を使って強化",\n      }),''',
)
replace_exact(
    "tests/unit/features/school/AppSchoolCalendarFlow.test.tsx",
    '''    expect(await screen.findByText("資金 630")).toBeInTheDocument();''',
    '''    expect(await screen.findByText("資金 680")).toBeInTheDocument();''',
)

# Soak baselines retain deterministic assertions while reflecting the new opening economy.
replace_exact(
    "tests/unit/soak/soakDeterminism.test.ts",
    '''      rank: "intermediate",''',
    '''      rank: "advanced",''',
)
replace_exact(
    "tests/unit/soak/soakDeterminism.test.ts",
    '''    expect(first.summary).toContain("coach=intermediate/attack");''',
    '''    expect(first.summary).toContain("coach=advanced/attack");''',
)
replace_exact(
    "tests/unit/soak/soakDeterminism.test.ts",
    '''  it("describes a ledger-only zero-funds dip without claiming zero observed weeks", async () => {\n    const { runBalanceSoak } = await loadSubject();\n    const result = runBalanceSoak({\n      seed: "phase18-release-a",\n      preset: "smoke",\n    });\n    const year = result.report.yearly[0]!;\n    const observation = result.report.observations.find(\n      (item) => item.code === "user_funds_zero",\n    );\n\n    expect(year.fundsMin).toBe(0);\n    expect(year.zeroFundWeeks).toBe(0);\n    expect(observation).toBeDefined();\n    expect(observation!.message).toContain("最小残高が0");\n    expect(observation!.message).toContain("週境界で0を観測した回数は0回");\n    expect(observation!.message).not.toContain("0週あります");\n  });''',
    '''  it("does not invent a zero-funds observation when the opening-year reserve is preserved", async () => {\n    const { runBalanceSoak } = await loadSubject();\n    const result = runBalanceSoak({\n      seed: "phase18-release-a",\n      preset: "smoke",\n    });\n    const year = result.report.yearly[0]!;\n    const observation = result.report.observations.find(\n      (item) => item.code === "user_funds_zero",\n    );\n\n    expect(year.fundsMin).toBe(300);\n    expect(year.zeroFundWeeks).toBe(0);\n    expect(observation).toBeUndefined();\n  });''',
)
replace_exact(
    "tests/unit/soak/soakDeterminism.test.ts",
    '''    expect(year.fundsStart).toBe(700);''',
    '''    expect(year.fundsStart).toBe(750);''',
)

# Give the management policy fixture enough funds to exercise both coach and facility actions.
replace_exact(
    "tests/unit/soak/soakDriver.test.ts",
    '''    const before = createSoakSnapshot("phase18-management-seed");\n    const schoolBefore = before.state.schools[before.state.userSchoolId]!;''',
    '''    const before = createSoakSnapshot("phase18-management-seed");\n    before.state.schools[before.state.userSchoolId]!.funds = 1000;\n    const schoolBefore = before.state.schools[before.state.userSchoolId]!;''',
)
replace_exact(
    "tests/unit/soak/soakDriver.test.ts",
    '''      rank: "intermediate",''',
    '''      rank: "advanced",''',
)
