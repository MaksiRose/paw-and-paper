import { SpeciesNames } from './data/general';

export interface DiscordEvent {
	/** Name of the event */
	name: string;
	/** Whether the event should be executed once */
	once: boolean;
	execute: (...args: Array<any>) => Promise<void>;
}


export enum PlantEdibilityType {
	Edible = 1,
	Inedible = 2,
	Toxic = 3
}

export interface PlantInfo {
	/** Description of the plant */
	description: string;
	/** Edibabilty of the plant */
	edibility: PlantEdibilityType;
	/** Whether the plant heals wounds */
	healsWounds: boolean;
	/** Whether the plant heals infectionsWhether the plant heals infections */
	healsInfections: boolean;
	/** Whether the plant heals colds */
	healsColds: boolean;
	/** Whether the plant heals sprains */
	healsSprains: boolean;
	/** Whether the plant heals poison */
	healsPoison: boolean;
	/** Whether the plant gives energy */
	givesEnergy: boolean;
	/** Whether the plant increases the maximum of one condition */
	increasesMaxCondition: boolean;
}


export interface MaterialInfo {
	/** Description of the material */
	description: string;
	/** Whether the material reinforces the structure of a den */
	reinforcesStructure: boolean;
	/** Whether the material improves the bedding of the den */
	improvesBedding: boolean;
	/** Whether the material thickens the walls of the den */
	thickensWalls: boolean;
	/** Whether the material removes overhang from the walls of the hang */
	removesOverhang: boolean;
}


export enum SpeciesDietType {
	Omnivore = 1,
	Herbivore = 2,
	Carnivore = 3
}

export enum SpeciesHabitatType {
	Cold = 1,
	Warm = 2,
	Water = 3
}

export interface SpeciesInfo {
	/** Diet of the species */
	diet: SpeciesDietType;
	/** Habitat that the species lives in */
	habitat: SpeciesHabitatType;
	/** Opponents that the species meets in biome 1 */
	biome1OpponentArray: Array<SpeciesNames>;
	/** Opponents that the species meets in biome 2 */
	biome2OpponentArray: Array<SpeciesNames>;
	/** Opponents that the species meets in biome 3 */
	biome3OpponentArray: Array<SpeciesNames>;
}


export type OmitFirstArgAndChangeReturn<F, Return> = F extends (x: any, ...args: infer P) => any ? (...args: P) => Return : never