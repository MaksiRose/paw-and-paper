import { EmbedBuilder } from 'discord.js';
import userModel from '../models/userModel';
import { commonPlantsInfo, CurrentRegionType, Profile, Quid, rarePlantsInfo, specialPlantsInfo, uncommonPlantsInfo, UserSchema } from '../typedef';
import { getMapData } from './helperFunctions';
import { pronoun } from './getPronouns';
import { generateRandomNumber, pullFromWeightedTable } from './randomizers';

/**
 * Return the smaller of two numbers
 * @param number1 - number
 * @param number2 - number - This is the second parameter, and it's a number.
 */
export const getSmallerNumber = (
	number1: number,
	number2: number,
): number => number1 > number2 ? number2 : number1;

/**
 * Calculate how much energy should be decreased based on how low the profile's health is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
const calculateEnergyDecrease = (
	profileData: Profile,
): number => {

	/* Calculate energy point decrease based on health, which is lowest (0) when health is highest, and highest (10) when health is lowest. */
	const healthDependentEnergyDecrease = Math.round(10 - (profileData.health / (profileData.maxHealth / 10)));

	/* If energyDependentHungerDecrease is 0, return 0. If it's not 0, randomize a number between half of healthDependentEnergyDecrease and 1 higher than that, compare it with the profiles energy and return the smaller number. */
	return healthDependentEnergyDecrease > 0 ? getSmallerNumber(generateRandomNumber(2, Math.round(healthDependentEnergyDecrease / 2)), profileData.energy) : 0;
};

/**
 * Calculate how much hunger should be decreased based on how low the profile's energy is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
const calculateHungerDecrease = (
	profileData: Profile,
): number => {

	/* Calculate hunger point decrease based on energy, which is lowest (0) when energy is highest, and highest (10) when energy is lowest. */
	const energyDependentHungerDecrease = Math.round(10 - (profileData.energy / (profileData.maxEnergy / 10)));

	/* If energyDependentHungerDecrease is 0, return 0. If it's not 0, randomize a number between energyDependentHungerDecrease and 2 higher than that, compare it with the profiles hunger and return the smaller number. */
	return energyDependentHungerDecrease > 0 ? getSmallerNumber(generateRandomNumber(3, energyDependentHungerDecrease), profileData.hunger) : 0;
};

/**
 * Calculate how much thirst should be decreased based on how low the profile's energy is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
const calculateThirstDecrease = (
	profileData: Profile,
): number => {

	/* Calculate thirst point decrease based on energy, which is lowest (0) when energy is highest, and highest (10) when energy is lowest. */
	const energyDependentThirstDecrease = Math.ceil(10 - (profileData.energy / (profileData.maxEnergy / 10)));

	/* If energyDependentThirstDecrease is 0, return 0. If it's not 0, randomize a number between energyDependentThirstDecrease and 2 higher than that, compare it with the profiles thirst and return the smaller number. */
	return energyDependentThirstDecrease > 0 ? getSmallerNumber(generateRandomNumber(3, energyDependentThirstDecrease), profileData.thirst) : 0;
};

/**
 * It decreases the health of a profile based on its injuries
 * @param {UserSchema} userData - The user's data
 * @param {Quid} quidData - The quid data of the user
 * @param {Profile} profileData - The profile data of the user
 * @returns An object with an embed and profileData
 */
const decreaseHealth = async (
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
): Promise<{ injuryUpdateEmbed: EmbedBuilder | null, profileData: Profile; }> => {

	/* If there are no injuries, return null as an embed and profileData as the profileData */
	if (Object.values(profileData.injuries).every((value) => value == 0)) { return { injuryUpdateEmbed: null, profileData }; }

	/* Define the decreased health points, a modifiedInjuryObject and an embed with a color */
	let totalHealthDecrease = 0;
	const modifiedInjuryObject = { ...profileData.injuries };
	const embed = new EmbedBuilder().setColor(quidData.color).setDescription('').toJSON();

	/* Cycle through the profile's wounds and for each one, let it heal (25% chance), become an infection (50% chance) or bleed */
	for (let i = 0; i < profileData.injuries.wounds; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 3 });
		const becomesInfection = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (getsHealed == 0) {

			modifiedInjuryObject.wounds -= 1;

			embed.description += `\n*One of ${quidData.name}'s wounds healed! What luck!*`;
			continue;
		}

		totalHealthDecrease += generateRandomNumber(3, 3);

		if (becomesInfection == 0) {

			modifiedInjuryObject.wounds -= 1;
			modifiedInjuryObject.infections += 1;

			embed.description += `\n*One of ${quidData.name}'s wounds turned into an infection!*`;
			continue;
		}

		embed.description += `\n*One of ${quidData.name}'s wounds is bleeding!*`;
	}

	/* Cycle through the profile's infections and for each one, let it heal (33% chance) or get worse */
	for (let i = 0; i < profileData.injuries.infections; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 2 });

		if (getsHealed == 0) {

			modifiedInjuryObject.infections -= 1;

			embed.description += `\n*One of ${quidData.name}'s infections healed! What luck!*`;
			continue;
		}

		const minimumInfectionHealthDecrease = Math.round((10 - (profileData.health / (profileData.maxHealth / 10))) / 3);
		totalHealthDecrease += generateRandomNumber(3, minimumInfectionHealthDecrease + 3);

		embed.description += `\n*One of ${quidData.name}'s infections is getting worse!*`;
	}

	/* Check if the user has a cold and let it heal (25% chance) or get worse */
	if (profileData.injuries.cold == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 3 });

		if (getsHealed == 0) {

			modifiedInjuryObject.cold = false;

			embed.description += `\n*${quidData.name} recovered from ${pronoun(quidData, 2)} cold! What luck!*`;
		}
		else {

			const minimumColdHealthDecrease = Math.round((10 - (profileData.health / (profileData.maxHealth / 10))) / 1.5);
			totalHealthDecrease += generateRandomNumber(3, minimumColdHealthDecrease > 0 ? minimumColdHealthDecrease : 1);

			embed.description += `\n*${quidData.name}'s cold is getting worse!*`;
		}
	}

	/* Cycle through the profile's sprains and for each one, let it heal (30% chance) or get worse */
	for (let i = 0; i < profileData.injuries.sprains; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 3, 1: 7 });

		if (getsHealed == 0) {

			modifiedInjuryObject.sprains -= 1;

			embed.description += `\n*One of ${quidData.name}'s sprains healed! What luck!*`;
			continue;
		}

		const minimumSprainHealthDecrease = Math.round(profileData.levels / 2);
		totalHealthDecrease += generateRandomNumber(5, minimumSprainHealthDecrease < 11 ? minimumSprainHealthDecrease : 11);

		embed.description += `\n*One of ${quidData.name}'s sprains is getting worse!*`;
	}

	/* Check if the user has poison and let it heal (20% chance) or get worse */
	if (profileData.injuries.poison == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedInjuryObject.poison = false;

			embed.description += `\n*${quidData.name} recovered from ${pronoun(quidData, 2)} poisoning! What luck!*`;
		}
		else {

			const minimumPoisonHealthDecrease = Math.round((10 - (profileData.health / 10)) * 1.5);
			totalHealthDecrease += generateRandomNumber(5, (minimumPoisonHealthDecrease > 0) ? minimumPoisonHealthDecrease : 1);

			embed.description += `\n*The poison in ${quidData.name}'s body is spreading!*`;
		}
	}

	/* Change total health decrease if it would get the health below zero, and update the user information */
	totalHealthDecrease = getSmallerNumber(totalHealthDecrease, profileData.health);
	userData = await userModel.findOneAndUpdate(
		u => u.uuid === userData.uuid,
		(u) => {
			const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, profileData.serverId)).profiles, profileData.serverId);
			p.health -= totalHealthDecrease;
			p.injuries = modifiedInjuryObject;
		},
	);
	quidData = getMapData(userData.quids, getMapData(userData.currentQuid, profileData.serverId));
	profileData = getMapData(quidData.profiles, profileData.serverId);

	/* Add a footer to the embed if the total health decrease is more than 0, and return */
	if (totalHealthDecrease > 0) { embed.footer = { text: `-${totalHealthDecrease} HP (${profileData.health}/${profileData.maxHealth})` }; }
	return { injuryUpdateEmbed: new EmbedBuilder(embed), profileData };
};

/**
 * It changes the user's experience, energy, hunger, thirst and returns a string based on these changes, decreases the health of a profile based on its injuries, and returns an embed containing those changes if so, and returns an updated profileData.
 * @param userData - UserSchema - The user's data
 * @param quidData - Quid - The quid that the profile belongs to
 * @param profileData - The profile of the quid that is being changed
 * @param experienceIncrease - number - The amount of experience to add to the profile.
 * @param [currentRegion] - The region the user will be in
 * @returns An object with the following properties:
 *
 * `statsUpdateText`: string, `injuryUpdateEmbed`: EmbedBuilder | null, `profileData`: Profile
 */
export const changeCondition = async (
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	experienceIncrease: number,
	currentRegion?: CurrentRegionType,
): Promise<{ statsUpdateText: string, injuryUpdateEmbed: EmbedBuilder | null, profileData: Profile; }> => {

	const energyDecrease = getSmallerNumber(calculateEnergyDecrease(profileData), profileData.energy);
	const hungerDecrease = calculateHungerDecrease(profileData);
	const thirstDecrease = calculateThirstDecrease(profileData);
	const previousRegion = profileData.currentRegion;

	userData = await userModel.findOneAndUpdate(
		u => u.uuid === userData.uuid,
		(u) => {
			const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, profileData.serverId)).profiles, profileData.serverId);
			p.energy -= energyDecrease;
			p.hunger -= hungerDecrease;
			p.thirst -= thirstDecrease;
			p.experience += experienceIncrease;
			if (currentRegion) { p.currentRegion = currentRegion; }
		},
	);
	quidData = getMapData(userData.quids, getMapData(userData.currentQuid, profileData.serverId));
	profileData = getMapData(quidData.profiles, profileData.serverId);

	let statsUpdateText = '';
	if (experienceIncrease > 0) { statsUpdateText += `\n+${experienceIncrease} XP (${profileData.experience}/${profileData.levels * 50}) for ${quidData.name}`; }
	if (energyDecrease > 0) { statsUpdateText += `\n-${energyDecrease} energy (${profileData.energy}/${profileData.maxEnergy}) for ${quidData.name}`; }
	if (hungerDecrease > 0) { statsUpdateText += `\n-${hungerDecrease} hunger (${profileData.hunger}/${profileData.maxHunger}) for ${quidData.name}`; }
	if (thirstDecrease > 0) { statsUpdateText += `\n-${thirstDecrease} thirst (${profileData.thirst}/${profileData.maxThirst}) for ${quidData.name}`; }
	if (currentRegion && previousRegion !== currentRegion) { statsUpdateText += `\nYou are now at the ${currentRegion}`; }

	return { statsUpdateText, ...await decreaseHealth(userData, quidData, profileData) };
};

export const pickRandomCommonPlant = () => {

	const commonPlantsKeys = Object.keys(commonPlantsInfo) as Array<keyof typeof commonPlantsInfo>;
	const randomCommonPlant = commonPlantsKeys[generateRandomNumber(commonPlantsKeys.length, 0)];
	if (!randomCommonPlant) { throw new TypeError('randomCommonPlant is undefined'); }
	return randomCommonPlant;
};

export const pickRandomUncommonPlant = () => {

	const uncommonPlantsKeys = Object.keys(uncommonPlantsInfo) as Array<keyof typeof uncommonPlantsInfo>;
	const randomUncommonPlant = uncommonPlantsKeys[generateRandomNumber(uncommonPlantsKeys.length, 0)];
	if (!randomUncommonPlant) { throw new TypeError('randomUncommonPlant is undefined'); }
	return randomUncommonPlant;
};

export const pickRandomRarePlant = () => {

	const rarePlantsKeys = Object.keys(rarePlantsInfo) as Array<keyof typeof rarePlantsInfo>;
	const randomRarePlant = rarePlantsKeys[generateRandomNumber(rarePlantsKeys.length, 0)];
	if (!randomRarePlant) { throw new TypeError('randomRarePlant is undefined'); }
	return randomRarePlant;
};

export const pickRandomSpecialPlant = () => {

	const specialPlantsKeys = Object.keys(specialPlantsInfo) as Array<keyof typeof specialPlantsInfo>;
	const randomSpecialPlant = specialPlantsKeys[generateRandomNumber(specialPlantsKeys.length, 0)];
	if (!randomSpecialPlant) { throw new TypeError('randomSpecialPlant is undefined'); }
	return randomSpecialPlant;
};