// @ts-check
const profileModel = require('../models/profileModel');
const { prefix } = require('../config.json');
const { stopResting } = require('./executeResting');
const { decreaseLevel } = require('./levelHandling');
const { pronounAndPlural, pronoun, upperCasePronoun } = require('./getPronouns');
const { passingoutAdvice } = require('./adviceMessages');

/**
 * Checks if the user is passed out. If yes, then send a message and return true, as well as decrease their level if it's new. Else, return false.
 * @param {import('discord.js').Message<true>} message
 * @param {string} uuid
 * @param {boolean} isNew
 * @returns {Promise<boolean>}
 */
async function isPassedOut(message, uuid, isNew) {

	const userData = /** @type {import('../typedef').ProfileSchema | null} */ (await profileModel.findOne({ uuid: uuid }));
	const characterData = userData?.characters?.[userData?.currentCharacter?.[message?.guildId]];
	const profileData = characterData?.profiles?.[message?.guildId];

	if (userData && characterData && profileData && (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0)) {

		const botReply = await message
			.reply({
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} lies on the ground near the pack borders, barely awake.* "Healer!" *${pronounAndPlural(characterData, 0, 'screeches', 'screech')} with ${pronoun(characterData, 2)} last energy. Without help, ${pronoun(characterData, 0)} will not be able to continue.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		if (isNew === true) {

			await decreaseLevel(userData, botReply);
		}

		await passingoutAdvice(message, userData);

		return true;
	}

	return false;
}

/**
 * Checks if the user is on a cooldown. If yes, then send a message and return true, as well as decrease their level if it's new. Else, return false.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 * @param {Array<string>} callerNameArray
 * @returns {Promise<boolean>}
 */
async function hasCooldown(message, userData, callerNameArray) {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	const commandName = message.content.slice(prefix.length).trim().split(/ +/).shift()?.toLowerCase() || '';

	if (profileData.hasCooldown === true && callerNameArray.includes(commandName)) {

		await message
			.reply({
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} is so eager to get things done today that ${pronounAndPlural(characterData, 0, 'is', 'are')} somersaulting. ${upperCasePronoun(characterData, 0)} should probably take a few seconds to calm down.*`,
				}],
				failIfNotExists: false,
			})
			.then(reply => {
				setTimeout(async function() {

					await reply
						.delete()
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
				}, 10000);
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return true;
	}

	return false;
}

/**
 * Checks if the user is resting. If yes, then wake user up and attach an embed to the message. Returns the updated `userData`.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 * @param {Array<import('discord.js').MessageEmbed | import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<import('../typedef').ProfileSchema>}
 */
async function isResting(message, userData, embedArray) {

	const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	const profileData = characterData.profiles[message.guild.id];

	if (profileData.isResting == true) {

		userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id },
			(/** @type {import('../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].isResting = false;
			},
		));

		stopResting(message.author.id, message.guild.id);

		embedArray.unshift({
			color: characterData.color,
			author: { name: characterData.name, icon_url: characterData.avatarURL },
			description: `*${characterData.name} opens ${pronoun(characterData, 2)} eyes, blinking at the bright sun. After a long stretch, ${pronounAndPlural(characterData, 0, 'leave')} ${pronoun(characterData, 2)} den to continue ${pronoun(characterData, 2)} day.*`,
			footer: { text: `Current energy: ${profileData.energy}` },
		});
	}

	return userData;
}

/**
 * Checks if the user is passed out, on a cooldown or resting, sends or attaches the appropriate message/embed, and returns a boolean of the result.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 * @param {Array<import('discord.js').MessageEmbed | import('discord.js').MessageEmbedOptions>} embedArray
 * @param {Array<string>} callerNameArray
 * @returns {Promise<boolean>}
 */
async function isInvalid(message, userData, embedArray, callerNameArray) {

	if (await isPassedOut(message, userData.uuid, false)) {

		return true;
	}

	if (await hasCooldown(message, userData, callerNameArray)) {

		return true;
	}

	await isResting(message, userData, embedArray);

	return false;
}

module.exports = {
	isPassedOut,
	hasCooldown,
	isResting,
	isInvalid,
};