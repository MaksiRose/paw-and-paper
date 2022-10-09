import { EmbedBuilder } from 'discord.js';
import userModel from '../models/userModel';
import { commonPlantsInfo, CurrentRegionType, materialsInfo, Profile, Quid, rarePlantsInfo, specialPlantsInfo, uncommonPlantsInfo, UserSchema } from '../typedef';
import { deepCopyObject, getBiggerNumber, getMapData, getSmallerNumber } from './helperFunctions';
import { pronoun } from './getPronouns';
import { getRandomNumber, pullFromWeightedTable } from './randomizers';

/**
 * Calculate how much energy should be decreased based on how low the profile's health is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateEnergyDecrease(
	profileData: Profile,
): number {

	/* Calculate energy point decrease based on health, which is lowest (0) when health is highest, and highest (10) when health is lowest. */
	const healthDependentEnergyDecrease = Math.round(10 - (profileData.health / (profileData.maxHealth / 10)));

	/* If energyDependentHungerDecrease is 0, return 0. If it's not 0, randomize a number between half of healthDependentEnergyDecrease and 1 higher than that, compare it with the profiles energy and return the smaller number. */
	return healthDependentEnergyDecrease > 0 ? getSmallerNumber(getRandomNumber(2, Math.round(healthDependentEnergyDecrease / 2)), profileData.energy) : 0;
}

/**
 * Calculate how much hunger should be decreased based on how low the profile's energy is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateHungerDecrease(
	profileData: Profile,
): number {

	/* Calculate hunger point decrease based on energy, which is lowest (0) when energy is highest, and highest (10) when energy is lowest. */
	const energyDependentHungerDecrease = Math.round(10 - (profileData.energy / (profileData.maxEnergy / 10)));

	/* If energyDependentHungerDecrease is 0, return 0. If it's not 0, randomize a number between energyDependentHungerDecrease and 2 higher than that, compare it with the profiles hunger and return the smaller number. */
	return energyDependentHungerDecrease > 0 ? getSmallerNumber(getRandomNumber(3, energyDependentHungerDecrease), profileData.hunger) : 0;
}

/**
 * Calculate how much thirst should be decreased based on how low the profile's energy is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateThirstDecrease(
	profileData: Profile,
): number {

	/* Calculate thirst point decrease based on energy, which is lowest (0) when energy is highest, and highest (10) when energy is lowest. */
	const energyDependentThirstDecrease = Math.ceil(10 - (profileData.energy / (profileData.maxEnergy / 10)));

	/* If energyDependentThirstDecrease is 0, return 0. If it's not 0, randomize a number between energyDependentThirstDecrease and 2 higher than that, compare it with the profiles thirst and return the smaller number. */
	return energyDependentThirstDecrease > 0 ? getSmallerNumber(getRandomNumber(3, energyDependentThirstDecrease), profileData.thirst) : 0;
}

/**
 * It decreases the health of a profile based on its injuries
 * @param {UserSchema} userData - The user's data
 * @param {Quid} quidData - The quid data of the user
 * @param {Profile} profileData - The profile data of the user
 * @returns An object with an embed and profileData
 */
function decreaseHealth(
	quidData: Quid,
	profileData: Profile,
): {
	injuryUpdateEmbed: EmbedBuilder | null,
	totalHealthDecrease: number,
	modifiedInjuryObject: Profile['injuries'];
	} {

	/* Define the decreased health points, a modifiedInjuryObject */
	let totalHealthDecrease = 0;
	const modifiedInjuryObject = deepCopyObject(profileData.injuries);

	/* If there are no injuries, return null as an embed and profileData as the profileData */
	if (Object.values(profileData.injuries).every((value) => value == 0)) { return { injuryUpdateEmbed: null, totalHealthDecrease, modifiedInjuryObject }; }

	/* Define an embed with a color */
	const embed = new EmbedBuilder()
		.setColor(quidData.color);
	let description = '';

	/* Cycle through the profile's wounds and for each one, let it heal (25% chance), become an infection (50% chance) or bleed */
	for (let i = 0; i < profileData.injuries.wounds; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 3 });
		const becomesInfection = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (getsHealed == 0) {

			modifiedInjuryObject.wounds -= 1;

			description += `\n*One of ${quidData.name}'s wounds healed! What luck!*`;
			continue;
		}

		totalHealthDecrease += getRandomNumber(3, 3);

		if (becomesInfection == 0) {

			modifiedInjuryObject.wounds -= 1;
			modifiedInjuryObject.infections += 1;

			description += `\n*One of ${quidData.name}'s wounds turned into an infection!*`;
			continue;
		}

		description += `\n*One of ${quidData.name}'s wounds is bleeding!*`;
	}

	/* Cycle through the profile's infections and for each one, let it heal (33% chance) or get worse */
	for (let i = 0; i < profileData.injuries.infections; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 2 });

		if (getsHealed == 0) {

			modifiedInjuryObject.infections -= 1;

			description += `\n*One of ${quidData.name}'s infections healed! What luck!*`;
			continue;
		}

		const minimumInfectionHealthDecrease = Math.round((10 - (profileData.health / (profileData.maxHealth / 10))) / 3);
		totalHealthDecrease += getRandomNumber(3, minimumInfectionHealthDecrease + 3);

		description += `\n*One of ${quidData.name}'s infections is getting worse!*`;
	}

	/* Check if the user has a cold and let it heal (25% chance) or get worse */
	if (profileData.injuries.cold == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 3 });

		if (getsHealed == 0) {

			modifiedInjuryObject.cold = false;

			description += `\n*${quidData.name} recovered from ${pronoun(quidData, 2)} cold! What luck!*`;
		}
		else {

			const minimumColdHealthDecrease = Math.round((10 - (profileData.health / (profileData.maxHealth / 10))) / 1.5);
			totalHealthDecrease += getRandomNumber(3, getBiggerNumber(minimumColdHealthDecrease, 1));

			description += `\n*${quidData.name}'s cold is getting worse!*`;
		}
	}

	/* Cycle through the profile's sprains and for each one, let it heal (30% chance) or get worse */
	for (let i = 0; i < profileData.injuries.sprains; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 3, 1: 7 });

		if (getsHealed == 0) {

			modifiedInjuryObject.sprains -= 1;

			description += `\n*One of ${quidData.name}'s sprains healed! What luck!*`;
			continue;
		}

		const minimumSprainHealthDecrease = Math.round(profileData.levels / 2);
		totalHealthDecrease += getRandomNumber(5, getSmallerNumber(minimumSprainHealthDecrease, 11));

		description += `\n*One of ${quidData.name}'s sprains is getting worse!*`;
	}

	/* Check if the user has poison and let it heal (20% chance) or get worse */
	if (profileData.injuries.poison == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedInjuryObject.poison = false;

			description += `\n*${quidData.name} recovered from ${pronoun(quidData, 2)} poisoning! What luck!*`;
		}
		else {

			const minimumPoisonHealthDecrease = Math.round((10 - (profileData.health / 10)) * 1.5);
			totalHealthDecrease += getRandomNumber(5, getBiggerNumber(minimumPoisonHealthDecrease, 1));

			description += `\n*The poison in ${quidData.name}'s body is spreading!*`;
		}
	}

	if (description.length > 0) { embed.setDescription(description); }

	/* Add a footer to the embed if the total health decrease is more than 0, and return */
	if (totalHealthDecrease > 0) { embed.setFooter({ text: `-${totalHealthDecrease} HP (${profileData.health - totalHealthDecrease}/${profileData.maxHealth})` }); }
	return { injuryUpdateEmbed: embed, totalHealthDecrease, modifiedInjuryObject };
}

export type DecreasedStatsData = {
	statsUpdateText: string,
	injuryUpdateEmbed: EmbedBuilder | null,
	profileData: Profile;
};

/**
 * It changes the user's experience, energy, hunger, thirst and returns a string based on these changes, decreases the health of a profile based on its injuries, and returns an embed containing those changes if so, and returns an updated profileData.
 * @param userData - UserSchema - The user's data
 * @param quidData - Quid - The quid that the profile belongs to
 * @param profileData - The profile of the quid that is being changed
 * @param experienceIncrease - number - The amount of experience to add to the profile.
 * @param [currentRegion] - The region the user will be in
 * @param [secondPlayer] - Whether there is a second player. If true, stats will include who the stat is for
 * @returns DecreasedStatsData
 */
export async function changeCondition(
	userData: UserSchema | undefined,
	quidData: Quid,
	profileData: Profile,
	experienceIncrease: number,
	currentRegion?: CurrentRegionType,
	secondPlayer = false,
): Promise<DecreasedStatsData> {

	const { injuryUpdateEmbed, totalHealthDecrease, modifiedInjuryObject } = decreaseHealth(quidData, profileData);
	const energyDecrease = getSmallerNumber(calculateEnergyDecrease(profileData) + getRandomNumber(3, 1), profileData.energy);
	const hungerDecrease = calculateHungerDecrease(profileData);
	const thirstDecrease = calculateThirstDecrease(profileData);
	const previousRegion = profileData.currentRegion;

	if (userData === undefined) {

		profileData.health -= totalHealthDecrease;
		profileData.injuries = modifiedInjuryObject;
		profileData.energy -= energyDecrease;
		profileData.hunger -= hungerDecrease;
		profileData.thirst -= thirstDecrease;
		profileData.experience += experienceIncrease;
		if (currentRegion) { profileData.currentRegion = currentRegion; }
	}
	else {

		userData = await userModel.findOneAndUpdate(
			u => u._id === userData!._id,
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, profileData.serverId)).profiles, profileData.serverId);
				p.health -= totalHealthDecrease;
				p.injuries = modifiedInjuryObject;
				p.energy -= energyDecrease;
				p.hunger -= hungerDecrease;
				p.thirst -= thirstDecrease;
				p.experience += experienceIncrease;
				if (currentRegion) { p.currentRegion = currentRegion; }
			},
		);
		quidData = getMapData(userData.quids, getMapData(userData.currentQuid, profileData.serverId));
		profileData = getMapData(quidData.profiles, profileData.serverId);
	}

	let statsUpdateText = '';
	if (experienceIncrease > 0) { statsUpdateText += `\n+${experienceIncrease} XP (${profileData.experience}/${profileData.levels * 50})${secondPlayer ? ` for ${quidData.name}` : ''}`; }
	if (energyDecrease > 0) { statsUpdateText += `\n-${energyDecrease} energy (${profileData.energy}/${profileData.maxEnergy})${secondPlayer ? ` for ${quidData.name}` : ''}`; }
	if (hungerDecrease > 0) { statsUpdateText += `\n-${hungerDecrease} hunger (${profileData.hunger}/${profileData.maxHunger})${secondPlayer ? ` for ${quidData.name}` : ''}`; }
	if (thirstDecrease > 0) { statsUpdateText += `\n-${thirstDecrease} thirst (${profileData.thirst}/${profileData.maxThirst})${secondPlayer ? ` for ${quidData.name}` : ''}`; }
	if (currentRegion && previousRegion !== currentRegion) { statsUpdateText += `\n${secondPlayer ? `${quidData.name} is` : 'You are'} now at the ${currentRegion}`; }

	return { statsUpdateText, injuryUpdateEmbed, profileData };
}

/**
 * If user 1 does not have a cold, but user 2 does, there's a chance that user 1 will get infected. Updates user 1's account with a lower health and the added cold, and returns an embed if true
 * @param {UserSchema} userData1 - The user data of the user who is being infected.
 * @param {Quid} quidData1 - The quid that is being infected.
 * @param {Profile} profileData1 - The profile of the user who is being infected.
 * @param {Quid} quidData2 - Quid - The quid that is coughing
 * @param {Profile} profileData2 - The profile of the quid that is coughing.
 * @returns EmbedBuilder | null
 */
export async function infectWithChance(
	userData1: UserSchema,
	quidData1: Quid,
	profileData1: Profile,
	quidData2: Quid,
	profileData2: Profile,
): Promise<EmbedBuilder | null> {

	if (profileData2.injuries.cold === true && profileData1.injuries.cold === false && pullFromWeightedTable({ 0: 3, 1: 7 }) === 0) {

		const healthPoints = getSmallerNumber(getRandomNumber(5, 3), profileData1.health);

		await userModel.findOneAndUpdate(
			u => u._id === userData1._id,
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, profileData1.serverId)).profiles, profileData1.serverId);
				p.health -= healthPoints;
				p.injuries.cold = true;
			},
		);

		return new EmbedBuilder()
			.setColor(quidData1.color)
			.setDescription(`*Suddenly, ${quidData1.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${quidData2.name}, who was coughing as well. That was probably not the best idea!*`)
			.setFooter({ text: `-${healthPoints} HP (from cold)` });
	}
	return null;
}

export function pickRandomCommonPlant() {

	const commonPlantsKeys = Object.keys(commonPlantsInfo) as Array<keyof typeof commonPlantsInfo>;
	const randomCommonPlant = commonPlantsKeys[getRandomNumber(commonPlantsKeys.length)];
	if (randomCommonPlant === undefined) { throw new TypeError('randomCommonPlant is undefined'); }
	return randomCommonPlant;
}

export function pickRandomUncommonPlant() {

	const uncommonPlantsKeys = Object.keys(uncommonPlantsInfo) as Array<keyof typeof uncommonPlantsInfo>;
	const randomUncommonPlant = uncommonPlantsKeys[getRandomNumber(uncommonPlantsKeys.length)];
	if (randomUncommonPlant === undefined) { throw new TypeError('randomUncommonPlant is undefined'); }
	return randomUncommonPlant;
}

export function pickRandomRarePlant() {

	const rarePlantsKeys = Object.keys(rarePlantsInfo) as Array<keyof typeof rarePlantsInfo>;
	const randomRarePlant = rarePlantsKeys[getRandomNumber(rarePlantsKeys.length)];
	if (randomRarePlant === undefined) { throw new TypeError('randomRarePlant is undefined'); }
	return randomRarePlant;
}

export function pickRandomSpecialPlant() {

	const specialPlantsKeys = Object.keys(specialPlantsInfo) as Array<keyof typeof specialPlantsInfo>;
	const randomSpecialPlant = specialPlantsKeys[getRandomNumber(specialPlantsKeys.length)];
	if (randomSpecialPlant === undefined) { throw new TypeError('randomSpecialPlant is undefined'); }
	return randomSpecialPlant;
}

export function pickRandomMaterial() {

	const materialsKeys = Object.keys(materialsInfo) as Array<keyof typeof materialsInfo>;
	const randomMaterial = materialsKeys[getRandomNumber(materialsKeys.length)];
	if (randomMaterial === undefined) { throw new TypeError('randomMaterial is undefined'); }
	return randomMaterial;
}