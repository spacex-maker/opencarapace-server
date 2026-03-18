const syncState = {
  danger: { running: false, total: 0, synced: 0 },
  skills: { running: false, total: 0, synced: 0 },
};

function updateDangerProgress(p) {
  syncState.danger = {
    running: true,
    total: typeof p.total === "number" ? p.total : syncState.danger.total,
    synced: typeof p.synced === "number" ? p.synced : syncState.danger.synced,
  };
}

function finishDangerProgress(p) {
  syncState.danger = {
    running: false,
    total: typeof p.total === "number" ? p.total : syncState.danger.total,
    synced: typeof p.synced === "number" ? p.synced : syncState.danger.synced,
  };
}

function startSkillsProgress() {
  syncState.skills = { running: true, total: 0, synced: 0 };
}

function finishSkillsProgress(total, synced) {
  syncState.skills = {
    running: false,
    total: total ?? synced ?? 0,
    synced: synced ?? total ?? 0,
  };
}

module.exports = {
  syncState,
  updateDangerProgress,
  finishDangerProgress,
  startSkillsProgress,
  finishSkillsProgress,
};
