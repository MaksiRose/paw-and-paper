// @ts-check
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const sendNoDM = require('../../utils/sendNoDM');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('./attack');

module.exports.name = 'scavenge';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	/* Checking if the user is sending the command in a DM. If they are, it will send a message saying
	that the command can only be used in a server. */
	if (await sendNoDM(message)) { return; }

	/* Getting the character data and profile data of the user. */
	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	/* Checking if the user has completed their account and if the user is invalid. */
	if (await hasNotCompletedAccount(message, characterData) || await isInvalid(message, userData, embedArray, [module.exports.name])) { return; }

	/* Starting the cooldown for the command. */
	userData = await startCooldown(message);
	/* Checking if the user is in a battle and if they are, it will send a message reminding them to use
	the `rp attack` command. */
	const messageContent = remindOfAttack(message);

	/* Checking if the user has more than 25 items in their inventory. */
	if (/** @type {Array<number>} */ Object.values(profileData.inventory).map(type => Object.values(type)).flat().filter(value => value > 0).length > 25) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} approaches the pack borders, ${pronoun(characterData, 2)} mouth filled with various things. As eager as ${pronounAndPlural(characterData, 0, 'is', 'are')} to go scavenging, ${pronounAndPlural(characterData, 0, 'decide')} to store some things away first.*`,
					footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* Checking if the user's rank is Youngling. If it is, it will send a message saying that they don't
	have enough experience to go into the wilderness. */
	if (profileData.rank === 'Youngling') {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*A hunter cuts ${characterData.name} as they see ${pronoun(characterData, 1)} running towards the pack borders.* "You don't have enough experience to go into the wilderness, ${profileData.rank}," *they say.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}
};