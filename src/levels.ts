import type { LevelConfig } from "./simulation";

export const starterLevel: LevelConfig = {
  id: "starter-basin",
  name: "Starter Basin",
  size: 9,
  maxActions: 3,
  propagationTurnsPerAction: 5,
  pressureDrift: 0.018,
  influenceDrift: 0.022,
  stabilityRecovery: 0.014,
  roadPressureRelief: 0.16,
  schoolReach: 1,
  signalReach: 2,
  scoreWeights: {
    opportunity: 65,
    stability: 25,
    pressure: -35,
    equitySpread: -12,
  },
};

