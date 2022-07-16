// @ts-check
const profileModel = require('../models/profileModel');


/**
 * Sends advice to rest.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function restAdvice(message, userData) {

	const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	const profileData = characterData.profiles[message.guild.id];

	if (profileData.energy <= 80 && userData.advice.resting === false) {

		await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../typedef').ProfileSchema} */ p) => {
				p.advice.resting = true;
			},
		);

		await message.channel
			.send({
				content: `<@${userData.userId}> ❓ **Tip:**\nRest via \`rp rest\` to fill up your energy. Resting takes a while, so be patient!\nYou can also do \`rp vote\` to get +30 energy per vote!`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}

/**
 * Sends advice to drink.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function drinkAdvice(message, userData) {

	const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	const profileData = characterData.profiles[message.guild.id];

	if (profileData.thirst <= 80 && userData.advice.drinking === false) {

		await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../typedef').ProfileSchema} */ p) => {
				p.advice.drinking = true;
			},
		);

		await message.channel
			.send({
				content: `<@${userData.userId}> ❓ **Tip:**\nDrink via \`rp drink\` to fill up your thirst.`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}

/**
 * Sends advice to eat.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function eatAdvice(message, userData) {

	const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	const profileData = characterData.profiles[message.guild.id];

	if (profileData.hunger <= 80 && userData.advice.eating === false) {

		await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../typedef').ProfileSchema} */ p) => {
				p.advice.eating = true;
			},
		);

		await message.channel
			.send({
				content: `<@${userData.userId}> ❓ **Tip:**\nEat via \`rp eat\` to fill up your hunger. Carnivores prefer meat, and herbivores prefer plants! Omnivores can eat both.`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}


/**
 * Sends advice of how the colors work.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} userData
 */
async function coloredButtonsAdvice(message, userData) {

	if (userData.advice.coloredbuttons === false) {

		await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../typedef').ProfileSchema} */ p) => {
				p.advice.coloredbuttons = true;
			},
		);

		await message.channel
			.send({
				content: `${message.author.toString()} ❓ **Tip:**\nA red button means that you picked wrong, the blue button is what you should've picked instead. A green button means that you picked correct.`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}


module.exports = {
	restAdvice,
	drinkAdvice,
	eatAdvice,
	coloredButtonsAdvice,
};