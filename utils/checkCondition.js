// @ts-check
const profileModel = require('../models/profileModel');
const { pronoun } = require('./getPronouns');
const { generateRandomNumber, pullFromWeightedTable } = require('./randomizers');

/**
 * Calculates an appropriate amount of thirst points to lose based on the users energy, and returns it.
 * @param {import('../typedef').Profile} profileData
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
 * @param {import('../typedef').Profile} profileData
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
 * @param {import('../typedef').Profile} profileData
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
 * @param {import('../typedef').ProfileSchema} userData
 * @param {import('discord.js').Message} botReply
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} modifiedUserInjuryObject
 * @returns {Promise<import('discord.js').Message>} botReply
 */
async function decreaseHealth(userData, botReply, modifiedUserInjuryObject) {

	const characterData = userData.characters[userData.currentCharacter[botReply.guild.id]];
	const profileData = characterData.profiles[botReply.guild.id];

	if (Object.values(profileData.injuries).every((value) => value == 0)) {

		userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].injuries = modifiedUserInjuryObject;
			},
		));

		return botReply;
	}

	let extraLostHealthPoints = 0;
	/** @type {import('discord.js').MessageEmbedOptions} */
	const embed = {
		color: characterData.color,
		description: '',
		footer: { text: '' },
	};

	for (let i = 0; i < profileData.injuries.wounds; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });
		const becomesInfection = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.wounds -= 1;

			embed.description += `\n*One of ${characterData.name}'s wounds healed! What luck!*`;
			continue;
		}

		extraLostHealthPoints += generateRandomNumber(3, 3);

		if (becomesInfection == 0) {

			modifiedUserInjuryObject.wounds -= 1;
			modifiedUserInjuryObject.infections += 1;

			embed.description += `\n*One of ${characterData.name}'s wounds turned into an infection!*`;
			continue;
		}

		embed.description += `\n*One of ${characterData.name}'s wounds is bleeding!*`;
	}

	for (let i = 0; i < profileData.injuries.infections; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.infections -= 1;

			embed.description += `\n*One of ${characterData.name}'s infections healed! What luck!*`;
			continue;
		}

		const minimumInfectionHealthPoints = Math.round((10 - (profileData.health / 10)) / 3);
		extraLostHealthPoints += generateRandomNumber(3, (minimumInfectionHealthPoints < 0) ? 3 : minimumInfectionHealthPoints + 3);

		embed.description += `\n*One of ${characterData.name}'s infections is getting worse!*`;
	}

	if (profileData.injuries.cold == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.cold = false;

			embed.description += `\n*${characterData.name} recovered from ${pronoun(characterData, 2)} cold! What luck!*`;
		}
		else {

			const minimumColdHealthPoints = Math.round((10 - (profileData.health / 10)) / 1.5);
			extraLostHealthPoints += generateRandomNumber(3, (minimumColdHealthPoints > 0) ? minimumColdHealthPoints : 1);

			embed.description += `\n*${characterData.name}'s cold is getting worse!*`;
		}
	}

	for (let i = 0; i < profileData.injuries.sprains; i++) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.sprains -= 1;

			embed.description += `\n*One of ${characterData.name}'s sprains healed! What luck!*`;
			continue;
		}

		extraLostHealthPoints += generateRandomNumber(5, Math.round(profileData.levels / 2) < 11 ? Math.round(profileData.levels / 2) : 11);

		embed.description += `\n*One of ${characterData.name}'s sprains is getting worse!*`;
	}

	if (profileData.injuries.poison == true) {

		const getsHealed = pullFromWeightedTable({ 0: 1, 1: 4 });

		if (getsHealed == 0) {

			modifiedUserInjuryObject.poison = false;

			embed.description += `\n*${characterData.name} recovered from ${pronoun(characterData, 2)} poisoning! What luck!*`;
		}
		else {

			const minimumPoisonHealthPoints = Math.round((10 - (profileData.health / 10)) * 1.5) ;
			extraLostHealthPoints += generateRandomNumber(5, (minimumPoisonHealthPoints > 0) ? minimumPoisonHealthPoints : 1);

			embed.description += `\n*The poison in ${characterData.name}'s body is spreading!*`;
		}
	}

	if (profileData.health - extraLostHealthPoints < 0) {

		extraLostHealthPoints = profileData.health;
	}

	userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].health -= extraLostHealthPoints;
			p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].injuries = modifiedUserInjuryObject;
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