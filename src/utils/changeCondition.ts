import { EmbedBuilder } from 'discord.js';
import { getArrayElement } from './helperFunctions';
import { getRandomNumber, pullFromWeightedTable } from './randomizers';
import { CurrentRegionType } from '../typings/data/user';
import QuidToServer from '../models/quidToServer';
import Quid from '../models/quid';
import { pronoun } from './getQuidInfo';
import TemporaryStatIncrease from '../models/temporaryStatIncrease';

/**
 * Calculate how much energy should be decreased based on how low the profile's health is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateEnergyDecrease(
	quidToServer: QuidToServer,
): number {

	/* Calculate energy point decrease based on health, which is lowest (0) when health is highest, and highest (10) when health is lowest. */
	const healthDependentEnergyDecrease = Math.round(10 - (quidToServer.health / (quidToServer.maxHealth / 10)));

	/* If energyDependentHungerDecrease is 0, return 0. If it's not 0, compare healthDependentEnergyDecrease with the profiles energy and return the smaller number. */
	const energyDecrease = Math.min(healthDependentEnergyDecrease, quidToServer.energy);
	const maxEnergyDecrease = Math.floor(energyDecrease / 2) + 1;
	const minEnergyDecrease = Math.ceil(energyDecrease / 2);
	return healthDependentEnergyDecrease > 0 ? getRandomNumber(maxEnergyDecrease, minEnergyDecrease) : 0;
}

/**
 * Calculate how much hunger should be decreased based on how low the profile's energy is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateHungerDecrease(
	quidToServer: QuidToServer,
): number {

	/* Calculate hunger point decrease based on energy, which is lowest (0) when energy is highest, and highest (10) when energy is lowest. */
	const energyDependentHungerDecrease = Math.round(10 - (quidToServer.energy / (quidToServer.maxEnergy / 10)));

	/* If energyDependentHungerDecrease is 0, return 0. If it's not 0, randomize a number between energyDependentHungerDecrease and 2 higher than that, compare it with the profiles hunger and return the smaller number. */
	return energyDependentHungerDecrease > 0 ? Math.min(getRandomNumber(3, energyDependentHungerDecrease), quidToServer.hunger) : 0;
}

/**
 * Calculate how much thirst should be decreased based on how low the profile's energy is.
 * @param {Profile} profileData - Profile - The profile data of the user.
 * @returns A number.
 */
function calculateThirstDecrease(
	quidToServer: QuidToServer,
): number {

	/* Calculate thirst point decrease based on energy, which is lowest (0) when energy is highest, and highest (10) when energy is lowest. */
	const energyDependentThirstDecrease = Math.ceil(10 - (quidToServer.energy / (quidToServer.maxEnergy / 10)));

	/* If energyDependentThirstDecrease is 0, return 0. If it's not 0, randomize a number between energyDependentThirstDecrease and 2 higher than that, compare it with the profiles thirst and return the smaller number. */
	return energyDependentThirstDecrease > 0 ? Math.min(getRandomNumber(3, energyDependentThirstDecrease), quidToServer.thirst) : 0;
}

function decreaseHealth(
	quidToServer: QuidToServer,
	quid: Quid<true>,
): {
	injuryUpdateEmbed: EmbedBuilder[],
	totalHealthDecrease: number,
	modifiedInjuries: { wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean; };
} {

	/* Define the decreased health points, a modifiedInjuryObject */
	let totalHealthDecrease = 0;
	const modifiedInjuries = {
		wounds: quidToServer.injuries_wounds,
		infections: quidToServer.injuries_infections,
		cold: quidToServer.injuries_cold,
		sprains: quidToServer.injuries_sprains,
		poison: quidToServer.injuries_poison,
	};

	/* If there are no injuries, return null as an embed and profileData as the profileData */
	if (quidToServer.injuries_wounds === 0 && quidToServer.injuries_cold === false && quidToServer.injuries_infections === 0 && quidToServer.injuries_sprains === 0 && quidToServer.injuries_poison === false) { return { injuryUpdateEmbed: [], totalHealthDecrease, modifiedInjuries: modifiedInjuries }; }

	/* Define an embed with a color */
	const embed = new EmbedBuilder()
		.setColor(quid.color);
	let description = '';

	/* Cycle through the profile's wounds and for each one, let it heal (25% chance), become an infection (50% chance) or bleed */
	for (let i = 0; i < quidToServer.injuries_wounds; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 3 });
		const becomesInfection = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (getsHealed == 0) {

			modifiedInjuries.wounds -= 1;

			description += `\n*One of ${quid.name}'s wounds healed! What luck!*`;
			continue;
		}

		totalHealthDecrease += getRandomNumber(3, 3);

		if (becomesInfection == 0) {

			modifiedInjuries.wounds -= 1;
			modifiedInjuries.infections += 1;

			description += `\n*One of ${quid.name}'s wounds turned into an infection!*`;
			continue;
		}

		description += `\n*One of ${quid.name}'s wounds is bleeding!*`;
	}

	/* Cycle through the profile's infections and for each one, let it heal (33% chance) or get worse */
	for (let i = 0; i < quidToServer.injuries_infections; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 2 });

		if (getsHealed == 0) {

			modifiedInjuries.infections -= 1;

			description += `\n*One of ${quid.name}'s infections healed! What luck!*`;
			continue;
		}

		const minimumInfectionHealthDecrease = Math.round((10 - (quidToServer.health / (quidToServer.maxHealth / 10))) / 3);
		totalHealthDecrease += getRandomNumber(3, minimumInfectionHealthDecrease + 3);

		description += `\n*One of ${quid.name}'s infections is getting worse!*`;
	}

	/* Check if the user has a cold and let it heal (25% chance) or get worse */
	if (quidToServer.injuries_cold == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 3 });

		if (getsHealed == 0) {

			modifiedInjuries.cold = false;

			description += `\n*${quid.name} recovered from ${pronoun(quid, 2)} cold! What luck!*`;
		}
		else {

			const minimumColdHealthDecrease = Math.round((10 - (quidToServer.health / (quidToServer.maxHealth / 10))) / 1.5);
			totalHealthDecrease += getRandomNumber(3, Math.max(minimumColdHealthDecrease, 1));

			description += `\n*${quid.name}'s cold is getting worse!*`;
		}
	}

	/* Cycle through the profile's sprains and for each one, let it heal (30% chance) or get worse */
	for (let i = 0; i < quidToServer.injuries_sprains; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 3, 1: 7 });

		if (getsHealed == 0) {

			modifiedInjuries.sprains -= 1;

			description += `\n*One of ${quid.name}'s sprains healed! What luck!*`;
			continue;
		}

		const minimumSprainHealthDecrease = Math.round(quidToServer.levels / 2);
		totalHealthDecrease += getRandomNumber(5, Math.min(minimumSprainHealthDecrease, 11));

		description += `\n*One of ${quid.name}'s sprains is getting worse!*`;
	}

	/* Check if the user has poison and let it heal (20% chance) or get worse */
	if (quidToServer.injuries_poison == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedInjuries.poison = false;

			description += `\n*${quid.name} recovered from ${pronoun(quid, 2)} poisoning! What luck!*`;
		}
		else {

			const minimumPoisonHealthDecrease = Math.round((10 - (quidToServer.health / 10)) * 1.5);
			totalHealthDecrease += getRandomNumber(5, Math.max(minimumPoisonHealthDecrease, 1));

			description += `\n*The poison in ${quid.name}'s body is spreading!*`;
		}
	}

	if (description.length > 0) { embed.setDescription(description); }

	/* Add a footer to the embed if the total health decrease is more than 0, and return */
	if (totalHealthDecrease > 0) { embed.setFooter({ text: `-${totalHealthDecrease} HP (${quidToServer.health - totalHealthDecrease}/${quidToServer.maxHealth})` }); }
	return { injuryUpdateEmbed: [embed], totalHealthDecrease, modifiedInjuries: modifiedInjuries };
}

export type DecreasedStatsData = {
	statsUpdateText: string,
	injuryUpdateEmbed: EmbedBuilder[];
};

export async function addExperience(
	quidToServer: QuidToServer,
	experienceIncrease: number,
): Promise<string> {

	await quidToServer.update({ experience: quidToServer.experience + experienceIncrease });
	return `+${experienceIncrease} XP (${quidToServer.experience}/${quidToServer.levels * 50})`;
}

export async function changeCondition(
	quidToServer: QuidToServer,
	quid: Quid<true>,
	experienceIncrease: number,
	currentRegion?: CurrentRegionType,
	secondPlayer = false,
	update = true,
): Promise<DecreasedStatsData> {

	const { injuryUpdateEmbed, totalHealthDecrease, modifiedInjuries } = decreaseHealth(quidToServer, quid);
	const energyDecrease = Math.min(calculateEnergyDecrease(quidToServer) + getRandomNumber(2, 1), quidToServer.energy);
	const hungerDecrease = calculateHungerDecrease(quidToServer);
	const thirstDecrease = calculateThirstDecrease(quidToServer);
	const previousRegion = quidToServer.currentRegion;

	if (update === false) {

		quidToServer.injuries_wounds = modifiedInjuries.wounds;
		quidToServer.injuries_infections = modifiedInjuries.infections;
		quidToServer.injuries_cold = modifiedInjuries.cold;
		quidToServer.injuries_sprains = modifiedInjuries.sprains;
		quidToServer.injuries_poison = modifiedInjuries.poison;
		quidToServer.health -= totalHealthDecrease;
		quidToServer.energy -= energyDecrease;
		quidToServer.hunger -= hungerDecrease;
		quidToServer.thirst -= thirstDecrease;
		quidToServer.experience += experienceIncrease;
		if (currentRegion) { quidToServer.currentRegion = currentRegion; }
	}
	else {

		await quidToServer.update({
			injuries_wounds: modifiedInjuries.wounds,
			injuries_infections: modifiedInjuries.infections,
			injuries_cold: modifiedInjuries.cold,
			injuries_sprains: modifiedInjuries.sprains,
			injuries_poison: modifiedInjuries.poison,
			health: quidToServer.health - totalHealthDecrease,
			energy: quidToServer.energy - energyDecrease,
			hunger: quidToServer.hunger - hungerDecrease,
			thirst: quidToServer.thirst - thirstDecrease,
			experience: quidToServer.experience + experienceIncrease,
			currentRegion: currentRegion ? currentRegion : quidToServer.currentRegion,
		});
	}

	let statsUpdateText = '';
	if (experienceIncrease > 0) { statsUpdateText += `\n+${experienceIncrease} XP (${quidToServer.experience}/${quidToServer.levels * 50})${secondPlayer ? ` for ${quid.name}` : ''}`; }
	if (energyDecrease > 0) { statsUpdateText += `\n-${energyDecrease} energy (${quidToServer.energy}/${quidToServer.maxEnergy})${secondPlayer ? ` for ${quid.name}` : ''}`; }
	if (hungerDecrease > 0) { statsUpdateText += `\n-${hungerDecrease} hunger (${quidToServer.hunger}/${quidToServer.maxHunger})${secondPlayer ? ` for ${quid.name}` : ''}`; }
	if (thirstDecrease > 0) { statsUpdateText += `\n-${thirstDecrease} thirst (${quidToServer.thirst}/${quidToServer.maxThirst})${secondPlayer ? ` for ${quid.name}` : ''}`; }
	if (currentRegion && previousRegion !== currentRegion) { statsUpdateText += `\n${secondPlayer ? `${quid.name} is` : 'You are'} now at the ${currentRegion}`; }

	return { statsUpdateText, injuryUpdateEmbed };
}

export async function infectWithChance(
	quidToServer1: QuidToServer,
	quid1: Quid<true> | Quid<false>,
	quidToServer2: QuidToServer,
	quid2: Quid<true> | Quid<false>,
): Promise<EmbedBuilder[]> {

	if (quidToServer2.injuries_cold === true && quidToServer1.injuries_cold === false && pullFromWeightedTable({ 0: 3, 1: 7 }) === 0) {

		const healthPoints = Math.min(getRandomNumber(5, 3), quidToServer1.health);

		await quidToServer1.update({ health: quidToServer1.health - healthPoints, injuries_cold: true });

		return [new EmbedBuilder()
			.setColor(quid1.color)
			.setDescription(`*Suddenly, ${quid1.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${quid2.name}, who was coughing as well. That was probably not the best idea!*`)
			.setFooter({ text: `-${healthPoints} HP (from cold)` })];
	}
	return [];
}

/**
 * If the user has a quest or hasn't ranked up from their quest, it returns false. Else, it checks the minimum level at which a quest can appear, and if the user's level is lower than that, it returns false. Else, it calculates the chance of the user getting a quest, and returns true or false based on that.
 * @param userData - The database entry of the user for which to whether they are getting a quest.
 * @returns boolean
 */
export async function userFindsQuest(
	quidToServer: QuidToServer,
): Promise<boolean> {

	const { id, levels: currLevel, experience: currExperience, hasQuest, rank, unlockedRanks, maxHealth, maxEnergy, maxHunger, maxThirst } = quidToServer;
	if (hasQuest === true) { return false; }

	const rankToNr = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Elderly: 3 }[rank];

	/* If this is true, the person has gotten and successfully finished a quest (therefore unlocking the next rank), but hasn't ranked up yet */
	if (rankToNr !== unlockedRanks) { return false; }

	/* To calculate the minLevel for elderlies, it calculates how many quests an elderly has had already based on their stat increase amount, since with every successful quest, one of their maxStats goes up by 10. */
	const maxStatsIncrease = maxHealth + maxEnergy + maxHunger + maxThirst - 400;
	const temporaryStatIncreases = await TemporaryStatIncrease.count({ where: { quidToServerId: id } });
	const statIncreaseAmount = Math.round(maxStatsIncrease / 10) - temporaryStatIncreases;

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