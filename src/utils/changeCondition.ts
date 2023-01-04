import { EmbedBuilder } from 'discord.js';
import { deepCopyObject, getArrayElement, getBiggerNumber, getMapData, getSmallerNumber } from './helperFunctions';
import { getRandomNumber, pullFromWeightedTable } from './randomizers';
import { CurrentRegionType, ProfileSchema, UserData } from '../typings/data/user';

/**
 * Calculate how much energy should be decreased based on how low the profile's health is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateEnergyDecrease(
	userData: UserData<never, never>,
): number {

	/* Calculate energy point decrease based on health, which is lowest (0) when health is highest, and highest (10) when health is lowest. */
	const healthDependentEnergyDecrease = Math.round(10 - (userData.quid.profile.health / (userData.quid.profile.maxHealth / 10)));

	/* If energyDependentHungerDecrease is 0, return 0. If it's not 0, compare healthDependentEnergyDecrease with the profiles energy and return the smaller number. */
	return healthDependentEnergyDecrease > 0 ? getSmallerNumber(healthDependentEnergyDecrease, userData.quid.profile.energy) : 0;
}

/**
 * Calculate how much hunger should be decreased based on how low the profile's energy is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateHungerDecrease(
	userData: UserData<never, never>,
): number {

	/* Calculate hunger point decrease based on energy, which is lowest (0) when energy is highest, and highest (10) when energy is lowest. */
	const energyDependentHungerDecrease = Math.round(10 - (userData.quid.profile.energy / (userData.quid.profile.maxEnergy / 10)));

	/* If energyDependentHungerDecrease is 0, return 0. If it's not 0, randomize a number between energyDependentHungerDecrease and 2 higher than that, compare it with the profiles hunger and return the smaller number. */
	return energyDependentHungerDecrease > 0 ? getSmallerNumber(getRandomNumber(3, energyDependentHungerDecrease), userData.quid.profile.hunger) : 0;
}

/**
 * Calculate how much thirst should be decreased based on how low the profile's energy is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateThirstDecrease(
	userData: UserData<never, never>,
): number {

	/* Calculate thirst point decrease based on energy, which is lowest (0) when energy is highest, and highest (10) when energy is lowest. */
	const energyDependentThirstDecrease = Math.ceil(10 - (userData.quid.profile.energy / (userData.quid.profile.maxEnergy / 10)));

	/* If energyDependentThirstDecrease is 0, return 0. If it's not 0, randomize a number between energyDependentThirstDecrease and 2 higher than that, compare it with the profiles thirst and return the smaller number. */
	return energyDependentThirstDecrease > 0 ? getSmallerNumber(getRandomNumber(3, energyDependentThirstDecrease), userData.quid.profile.thirst) : 0;
}

/**
 * It decreases the health of a profile based on its injuries
 * @param {UserSchema} userData - The user's data
 * @param {Quid} quidData - The quid data of the user
 * @param {Profile} profileData - The profile data of the user
 * @returns An object with an embed and profileData
 */
function decreaseHealth(
	userData: UserData<never, never>,
): {
	injuryUpdateEmbed: EmbedBuilder[],
	totalHealthDecrease: number,
	modifiedInjuryObject: ProfileSchema['injuries'];
	} {

	/* Define the decreased health points, a modifiedInjuryObject */
	let totalHealthDecrease = 0;
	const modifiedInjuryObject = deepCopyObject(userData.quid.profile.injuries);

	/* If there are no injuries, return null as an embed and profileData as the profileData */
	if (Object.values(userData.quid.profile.injuries).every((value) => value == 0)) { return { injuryUpdateEmbed: [], totalHealthDecrease, modifiedInjuryObject }; }

	/* Define an embed with a color */
	const embed = new EmbedBuilder()
		.setColor(userData.quid.color);
	let description = '';

	/* Cycle through the profile's wounds and for each one, let it heal (25% chance), become an infection (50% chance) or bleed */
	for (let i = 0; i < userData.quid.profile.injuries.wounds; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 3 });
		const becomesInfection = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (getsHealed == 0) {

			modifiedInjuryObject.wounds -= 1;

			description += `\n*One of ${userData.quid.name}'s wounds healed! What luck!*`;
			continue;
		}

		totalHealthDecrease += getRandomNumber(3, 3);

		if (becomesInfection == 0) {

			modifiedInjuryObject.wounds -= 1;
			modifiedInjuryObject.infections += 1;

			description += `\n*One of ${userData.quid.name}'s wounds turned into an infection!*`;
			continue;
		}

		description += `\n*One of ${userData.quid.name}'s wounds is bleeding!*`;
	}

	/* Cycle through the profile's infections and for each one, let it heal (33% chance) or get worse */
	for (let i = 0; i < userData.quid.profile.injuries.infections; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 2 });

		if (getsHealed == 0) {

			modifiedInjuryObject.infections -= 1;

			description += `\n*One of ${userData.quid.name}'s infections healed! What luck!*`;
			continue;
		}

		const minimumInfectionHealthDecrease = Math.round((10 - (userData.quid.profile.health / (userData.quid.profile.maxHealth / 10))) / 3);
		totalHealthDecrease += getRandomNumber(3, minimumInfectionHealthDecrease + 3);

		description += `\n*One of ${userData.quid.name}'s infections is getting worse!*`;
	}

	/* Check if the user has a cold and let it heal (25% chance) or get worse */
	if (userData.quid.profile.injuries.cold == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 3 });

		if (getsHealed == 0) {

			modifiedInjuryObject.cold = false;

			description += `\n*${userData.quid.name} recovered from ${userData.quid.pronoun(2)} cold! What luck!*`;
		}
		else {

			const minimumColdHealthDecrease = Math.round((10 - (userData.quid.profile.health / (userData.quid.profile.maxHealth / 10))) / 1.5);
			totalHealthDecrease += getRandomNumber(3, getBiggerNumber(minimumColdHealthDecrease, 1));

			description += `\n*${userData.quid.name}'s cold is getting worse!*`;
		}
	}

	/* Cycle through the profile's sprains and for each one, let it heal (30% chance) or get worse */
	for (let i = 0; i < userData.quid.profile.injuries.sprains; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 3, 1: 7 });

		if (getsHealed == 0) {

			modifiedInjuryObject.sprains -= 1;

			description += `\n*One of ${userData.quid.name}'s sprains healed! What luck!*`;
			continue;
		}

		const minimumSprainHealthDecrease = Math.round(userData.quid.profile.levels / 2);
		totalHealthDecrease += getRandomNumber(5, getSmallerNumber(minimumSprainHealthDecrease, 11));

		description += `\n*One of ${userData.quid.name}'s sprains is getting worse!*`;
	}

	/* Check if the user has poison and let it heal (20% chance) or get worse */
	if (userData.quid.profile.injuries.poison == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedInjuryObject.poison = false;

			description += `\n*${userData.quid.name} recovered from ${userData.quid.pronoun(2)} poisoning! What luck!*`;
		}
		else {

			const minimumPoisonHealthDecrease = Math.round((10 - (userData.quid.profile.health / 10)) * 1.5);
			totalHealthDecrease += getRandomNumber(5, getBiggerNumber(minimumPoisonHealthDecrease, 1));

			description += `\n*The poison in ${userData.quid.name}'s body is spreading!*`;
		}
	}

	if (description.length > 0) { embed.setDescription(description); }

	/* Add a footer to the embed if the total health decrease is more than 0, and return */
	if (totalHealthDecrease > 0) { embed.setFooter({ text: `-${totalHealthDecrease} HP (${userData.quid.profile.health - totalHealthDecrease}/${userData.quid.profile.maxHealth})` }); }
	return { injuryUpdateEmbed: [embed], totalHealthDecrease, modifiedInjuryObject };
}

export type DecreasedStatsData = {
	statsUpdateText: string,
	injuryUpdateEmbed: EmbedBuilder[]
};

export function addExperience(
	userData: UserData<never, never>,
	experienceIncrease: number,
): string {

	userData.update(
		(u) => {
			const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, userData.quid.profile.serverId);
			p.experience += experienceIncrease;
		},
	);

	return `+${experienceIncrease} XP (${userData.quid.profile.experience}/${userData.quid.profile.levels * 50})`;
}

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
	userData: UserData<never, never>,
	experienceIncrease: number,
	currentRegion?: CurrentRegionType,
	secondPlayer = false,
	update = true,
): Promise<DecreasedStatsData> {

	const { injuryUpdateEmbed, totalHealthDecrease, modifiedInjuryObject } = decreaseHealth(userData);
	const energyDecrease = getSmallerNumber(calculateEnergyDecrease(userData) + getRandomNumber(3, 1), userData.quid.profile.energy);
	const hungerDecrease = calculateHungerDecrease(userData);
	const thirstDecrease = calculateThirstDecrease(userData);
	const previousRegion = userData.quid.profile.currentRegion;

	if (update === false) {

		userData.quid.profile.health -= totalHealthDecrease;
		userData.quid.profile.injuries = modifiedInjuryObject;
		userData.quid.profile.energy -= energyDecrease;
		userData.quid.profile.hunger -= hungerDecrease;
		userData.quid.profile.thirst -= thirstDecrease;
		userData.quid.profile.experience += experienceIncrease;
		if (currentRegion) { userData.quid.profile.currentRegion = currentRegion; }
	}
	else {

		await userData.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, userData.quid.profile.serverId);
				p.health -= totalHealthDecrease;
				p.injuries = modifiedInjuryObject;
				p.energy -= energyDecrease;
				p.hunger -= hungerDecrease;
				p.thirst -= thirstDecrease;
				p.experience += experienceIncrease;
				if (currentRegion) { p.currentRegion = currentRegion; }
			},
		);
	}

	let statsUpdateText = '';
	if (experienceIncrease > 0) { statsUpdateText += `\n+${experienceIncrease} XP (${userData.quid.profile.experience}/${userData.quid.profile.levels * 50})${secondPlayer ? ` for ${userData.quid.name}` : ''}`; }
	if (energyDecrease > 0) { statsUpdateText += `\n-${energyDecrease} energy (${userData.quid.profile.energy}/${userData.quid.profile.maxEnergy})${secondPlayer ? ` for ${userData.quid.name}` : ''}`; }
	if (hungerDecrease > 0) { statsUpdateText += `\n-${hungerDecrease} hunger (${userData.quid.profile.hunger}/${userData.quid.profile.maxHunger})${secondPlayer ? ` for ${userData.quid.name}` : ''}`; }
	if (thirstDecrease > 0) { statsUpdateText += `\n-${thirstDecrease} thirst (${userData.quid.profile.thirst}/${userData.quid.profile.maxThirst})${secondPlayer ? ` for ${userData.quid.name}` : ''}`; }
	if (currentRegion && previousRegion !== currentRegion) { statsUpdateText += `\n${secondPlayer ? `${userData.quid.name} is` : 'You are'} now at the ${currentRegion}`; }

	return { statsUpdateText, injuryUpdateEmbed };
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
	userData1: UserData<never, never>,
	userData2: UserData<never, never>,
): Promise<EmbedBuilder[]> {

	if (userData2.quid.profile.injuries.cold === true && userData1.quid.profile.injuries.cold === false && pullFromWeightedTable({ 0: 3, 1: 7 }) === 0) {

		const healthPoints = getSmallerNumber(getRandomNumber(5, 3), userData1.quid.profile.health);

		await userData1.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, userData1.quid._id).profiles, userData1.quid.profile.serverId);
				p.health -= healthPoints;
				p.injuries.cold = true;
			},
		);

		return [new EmbedBuilder()
			.setColor(userData1.quid.color)
			.setDescription(`*Suddenly, ${userData1.quid.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${userData2.quid.name}, who was coughing as well. That was probably not the best idea!*`)
			.setFooter({ text: `-${healthPoints} HP (from cold)` })];
	}
	return [];
}

/**
 * If the user has a quest or hasn't ranked up from their quest, it returns false. Else, it checks the minimum level at which a quest can appear, and if the user's level is lower than that, it returns false. Else, it calculates the chance of the user getting a quest, and returns true or false based on that.
 * @param userData - The database entry of the user for which to whether they are getting a quest.
 * @returns boolean
 */
export function userFindsQuest(
	userData: UserData<never, never>,
): boolean {

	const { levels: currLevel, experience: currExperience, hasQuest, rank, unlockedRanks, maxHealth, maxEnergy, maxHunger, maxThirst, temporaryStatIncrease } = userData.quid.profile;
	if (hasQuest === true) { return false; }

	const rankToNr = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Elderly: 3 }[rank];

	/* If this is true, the person has gotten and successfully finished a quest (therefore unlocking the next rank), but hasn't ranked up yet */
	if (rankToNr !== unlockedRanks) { return false; }

	/* To calculate the minLevel for elderlies, it calculates how many quests an elderly has had already based on their stat increase amount, since with every successful quest, one of their maxStats goes up by 10. */
	const maxStatsIncrease = maxHealth + maxEnergy + maxHunger + maxThirst - 400;
	const statIncreaseAmount = Math.round(maxStatsIncrease / 10) - Object.keys(temporaryStatIncrease).length;

	/* The minimum levels at which a quest can potentially appear are:
	Youngling - 2
	Apprentice - 10
	Hunter/Healer - 20
	Elderly - every 10th after it (30, 40, 50, etc) */
	const minLevel = getArrayElement([2, 10, 20, (3 + statIncreaseAmount) * 10], rankToNr);

	if (currLevel < minLevel) { return false; }

	const loosingChance = minLevel * (minLevel - 1) * 50;
	const winningChance = currLevel * (currLevel - 1) * 25 + currExperience;

	/* If currLevel is exactly the same as minLevel, this is a 33% chance, and from that point the chance is always increasing */
	return pullFromWeightedTable({ 0: winningChance, 1: loosingChance }) === 0;
}