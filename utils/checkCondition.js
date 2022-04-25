// @ts-check
const { profileModel } = require('../models/profileModel');
const { pronoun } = require('./getPronouns');
const { generateRandomNumber, pullFromWeightedTable } = require('./randomizers');

/**
 * Calculates an appropriate amount of thirst points to lose based on the users energy, and returns it.
 * @param {import('../typedef').ProfileSchema} profileData
 * @returns {Promise<number>}
 */
async function decreaseThirst(profileData) {

	const minimumThirstPoints = Math.round(10 - (profileData.energy / 10));
	let thirstPoints = 0;

	if (minimumThirstPoints > 0) {

		thirstPoints = Math.floor(Math.random() * 3) + minimumThirstPoints;

		if (profileData.thirst - thirstPoints < 0) {

			thirstPoints = profileData.thirst;
		}
	}

	return thirstPoints;
}

/**
 * Calculates an appropriate amount of hunger points to lose based on the users energy, and returns it.
 * @param {import('../typedef').ProfileSchema} profileData
 * @returns {Promise<number>}
 */
async function decreaseHunger(profileData) {

	let minimumHungerPoints = Math.round(10 - (profileData.energy / 10));
	let hungerPoints = 0;

	if (minimumHungerPoints > 0) {

		minimumHungerPoints = Math.round(minimumHungerPoints / 2);
		hungerPoints = Math.floor(Math.random() * 3) + minimumHungerPoints;

		if (profileData.hunger - hungerPoints < 0) {

			hungerPoints = profileData.hunger;
		}
	}

	return hungerPoints;
}

/**
 * Calculates an appropriate amount of energy points to lose based on the users health, and returns it.
 * @param {import('../typedef').ProfileSchema} profileData
 * @returns {Promise<number>}
 */
async function decreaseEnergy(profileData) {

	const minimumEnergyPoints = Math.round((10 - (profileData.health / 10)) / 2);
	let extraLostEnergyPoints = 0;

	if (minimumEnergyPoints > 0) {

		extraLostEnergyPoints = Math.floor(Math.random() * 2) + minimumEnergyPoints;

		if (profileData.energy - extraLostEnergyPoints < 0) {

			extraLostEnergyPoints = profileData.energy;
		}
	}

	return extraLostEnergyPoints;
}

/**
 * Checks if user has existing injuries.
 * If not, it adds modified injuries and return botReply.
 * If yes, it loops through them and either randomly heals them or calculates an appropriate amount on health points to lose based on the users health, edits the bots reply to include an embed displaying the changes, and updates the profile by subtracting the lost health and adding the modified injuries.
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {import('discord.js').Message} botReply
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} modifiedUserInjuryObject
 * @returns {Promise<import('discord.js').Message>} botReply
 */
async function decreaseHealth(profileData, botReply, modifiedUserInjuryObject) {

	if (Object.values(profileData.injuryObject).every((value) => value == 0)) {

		profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: profileData.userId, serverId: profileData.serverId },
			{ $set: { injuryObject: modifiedUserInjuryObject } },
		));

		return botReply;
	}

	let extraLostHealthPoints = 0;
	/** @type {import('discord.js').MessageEmbedOptions} */
	const embed = {
		color: profileData.color,
		description: '',
		footer: { text: '' },
	};

	for (let i = 0; i < profileData.injuryObject.wounds; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });
		const becomesInfection = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.wounds -= 1;

			embed.description += `\n*One of ${profileData.name}'s wounds healed! What luck!*`;
			continue;
		}

		extraLostHealthPoints += generateRandomNumber(3, 3);

		if (becomesInfection == 0) {

			modifiedUserInjuryObject.wounds -= 1;
			modifiedUserInjuryObject.infections += 1;

			embed.description += `\n*One of ${profileData.name}'s wounds turned into an infection!*`;
			continue;
		}

		embed.description += `\n*One of ${profileData.name}'s wounds is bleeding!*`;
	}

	for (let i = 0; i < profileData.injuryObject.infections; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.infections -= 1;

			embed.description += `\n*One of ${profileData.name}'s infections healed! What luck!*`;
			continue;
		}

		const minimumInfectionHealthPoints = Math.round((10 - (profileData.health / 10)) / 3);
		extraLostHealthPoints += generateRandomNumber(3, (minimumInfectionHealthPoints < 0) ? 3 : minimumInfectionHealthPoints + 3);

		embed.description += `\n*One of ${profileData.name}'s infections is getting worse!*`;
	}

	if (profileData.injuryObject.cold == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.cold = false;

			embed.description += `\n*${profileData.name} recovered from ${pronoun(profileData, 2)} cold! What luck!*`;
		}
		else {

			const minimumColdHealthPoints = Math.round((10 - (profileData.health / 10)) / 1.5);
			extraLostHealthPoints += generateRandomNumber(3, (minimumColdHealthPoints > 0) ? minimumColdHealthPoints : 1);

			embed.description += `\n*${profileData.name}'s cold is getting worse!*`;
		}
	}

	for (let i = 0; i < profileData.injuryObject.sprains; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.sprains -= 1;

			embed.description += `\n*One of ${profileData.name}'s sprains healed! What luck!*`;
			continue;
		}

		extraLostHealthPoints += generateRandomNumber(5, Math.round(profileData.levels / 2) < 11 ? Math.round(profileData.levels / 2) : 11);

		embed.description += `\n*One of ${profileData.name}'s sprains is getting worse!*`;
	}

	if (profileData.injuryObject.poison == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.poison = false;

			embed.description += `\n*${profileData.name} recovered from ${pronoun(profileData, 2)} poisoning! What luck!*`;
		}
		else {

			const minimumPoisonHealthPoints = Math.round((10 - (profileData.health / 10)) * 1.5) ;
			extraLostHealthPoints += generateRandomNumber(5, (minimumPoisonHealthPoints > 0) ? minimumPoisonHealthPoints : 1);

			embed.description += `\n*The poison in ${profileData.name}'s body is spreading!*`;
		}
	}

	if (profileData.health - extraLostHealthPoints < 0) {

		extraLostHealthPoints = profileData.health;
	}

	profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: profileData.userId, serverId: profileData.serverId },
		{
			$inc: { health: -extraLostHealthPoints },
			$set: { injuryObject: modifiedUserInjuryObject },
		},
	));

	if (extraLostHealthPoints > 0) {

		embed.footer.text = `-${extraLostHealthPoints} HP (${profileData.health}/${profileData.maxHealth})`;
	}

	botReply.embeds.push(/** @type {import('discord.js').MessageEmbed} */ (embed));
	botReply = await botReply
		.edit({
			embeds: botReply.embeds,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
			return botReply;
		});

	return botReply;
}

module.exports = {
	decreaseThirst,
	decreaseHunger,
	decreaseEnergy,
	decreaseHealth,
};