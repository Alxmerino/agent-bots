import type { Skin } from "./types";
import { robot } from "./robot";
import { critter } from "./critter";
import { alien } from "./alien";
import { dog, cat } from "./pets";
import { blob } from "./blob";

/** All skins, in menu order. The first is the default. Add new skins here. */
export const SKINS: Skin[] = [robot, critter, dog, cat, alien, blob];

export const getSkin = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];
