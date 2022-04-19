// @ts-check
const { profileModel } = require('../models/profileModel');

/**
 * Sends advice message to play.
 * @param {import('discord.js').Message} message
 */
async function playAdvice(message) {

	await message.channel
		.send({
			content: `${message.author.toString()} ❓ **Tip:**\nGo playing via \`rp play\` to find quests and rank up!`,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}

/**
 * Sends advice to rest.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} profileData
 */
async function restAdvice(message, profileData) {

	if (profileData.energy <= 80 && profileData.advice.resting === false) {

		profileData.advice.resting = true;

		await profileModel.findOneAndUpdate(
			{ userId: profileData.userId, serverId: profileData.serverId },
			{ $set: { advice: profileData.advice } },
		);

		await message.channel
			.send({
				content: `<@${profileData.userId}> ❓ **Tip:**\nRest via \`rp rest\` to fill up your energy. Resting takes a while, so be patient!\nYou can also do \`rp vote\` to get +30 energy per vote!`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}

/**
 * Sends advice to drink.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} profileData
 */
async function drinkAdvice(message, profileData) {

	if (profileData.thirst <= 80 && profileData.advice.drinking === false) {

		profileData.advice.drinking = true;

		await profileModel.findOneAndUpdate(
			{ userId: profileData.userId, serverId: profileData.serverId },
			{ $set: { advice: profileData.advice } },
		);

		await message.channel
			.send({
				content: `<@${profileData.userId}> ❓ **Tip:**\nDrink via \`rp drink\` to fill up your thirst.`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}

/**
 * Sends advice to eat.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} profileData
 */
async function eatAdvice(message, profileData) {

	if (profileData.hunger <= 80 && profileData.advice.eating === false) {

		profileData.advice.eating = true;

		await profileModel.findOneAndUpdate(
			{ userId: profileData.userId, serverId: profileData.serverId },
			{ $set: { advice: profileData.advice } },
		);

		await message.channel
			.send({
				content: `<@${profileData.userId}> ❓ **Tip:**\nEat via \`rp eat\` to fill up your hunger. Carnivores prefer meat, and herbivores prefer plants! Omnivores can eat both.`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}

/**
 * Sends advice of what to do when passing out.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} profileData
 */
async function passingoutAdvice(message, profileData) {

	if (profileData.advice.passingout === false) {

		profileData.advice.passingout = true;

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { advice: profileData.advice } },
		);

		await message.channel
			.send({
				content: `${message.author.toString()} ❓ **Tip:**\nIf your health, energy, hunger or thirst points hit zero, you pass out. Another player has to heal you so you can continue playing.\nMake sure to always watch your stats to prevent passing out!`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}

/**
 * Sends advice of how the colors work.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} profileData
 */
async function coloredButtonsAdvice(message, profileData) {

	if (profileData.advice.coloredbuttons === false) {

		profileData.advice.coloredbuttons = true;

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { advice: profileData.advice } },
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

/**
 * Sends advice of what changes as Apprentice.
 * @param {import('discord.js').Message} message
 */
async function apprenticeAdvice(message) {

	await message.channel
		.send({
			content: `${message.author.toString()} ❓ **Tip:**\nAs apprentice, you unlock new commands: \`explore\`, \`heal\`, \`practice\`, and \`dispose\`.\nCheck \`rp help\` to see what they do!\nGo exploring via \`rp explore\` to find more quests and rank up higher!`,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}

/**
 * Sends advice of what changes as Hunter/Healer.
 * @param {import('discord.js').Message} message
 */
async function hunterhealerAdvice(message) {

	await message.channel
		.send({
			content: `${message.author.toString()} ❓ **Tip:**\nHunters and Healers have different strengths and weaknesses!\nHealers can \`heal\` perfectly, but they are not able to use the \`practice\` and \`dispose\` commands or fight when \`exploring\`.\nHunters can \`dispose\` perfectly, but they are not able to use the \`heal\` command or pick up plants when \`exploring\`.\nHunters and Healers lose their ability to use the \`play\` command.`,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}

/**
 * Sends advice of what changes as Elderly.
 * @param {import('discord.js').Message} message
 */
async function elderlyAdvice(message) {

	await message.channel
		.send({
			content: `${message.author.toString()} ❓ **Tip:**\nElderlies have the abilities of both Hunters and Healers!\nAdditionally, they can use the \`share\` command.`,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}

module.exports = {
	playAdvice,
	restAdvice,
	drinkAdvice,
	eatAdvice,
	passingoutAdvice,
	coloredButtonsAdvice,
	apprenticeAdvice,
	hunterhealerAdvice,
	elderlyAdvice,
};