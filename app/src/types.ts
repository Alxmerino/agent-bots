export type AgentState = "working" | "waiting" | "idle";

export interface Session {
  session_id: string;
  name?: string;
  project: string;
  state: AgentState;
  last_tool: string;
  subagents: Record<string, { type: string; since: number }>;
  term_program?: string | null;
}

export interface Config {
  show: boolean;
  size: "S" | "M" | "L";
  speed: "slow" | "normal" | "fast";
  subagents: boolean;
  show_names: boolean;
  skin: string;
}

export const DEFAULT_CONFIG: Config = { show: true, size: "M", speed: "normal", subagents: true, show_names: true, skin: "robot" };
export const SCALE = { S: 2, M: 3, L: 4 } as const;
export const SPEED = { slow: 0.6, normal: 1, fast: 1.6 } as const;
