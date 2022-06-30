// @ts-check
const { MessageActionRow, MessageButton } = require('discord.js');
const profileModel = require('../../models/profileModel');
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { error_color } = require('../../../config.json');
const isInGuild = require('../../utils/isInGuild');

module.exports.name = 'stats';
module.exports.aliases = ['status'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	if (!isInGuild(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];
	let isYourself = true;

	const firstMentionedUser = message.mentions.users.first();
	if (firstMentionedUser) {

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: firstMentionedUser.id }));
		characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
		profileData = characterData?.profiles?.[message.guild.id];
		isYourself = false;

		if (!profileData) {

			await message
				.reply({
					embeds: [{
						color: /** @type {`#${string}`} */ (error_color),
						title: 'There is nothing to show here :(',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	}
	else if (!hasCompletedAccount(message, characterData)) {

		return;
	}


	await message
		.reply(module.exports.getMessageContent(profileData, characterData.name, isYourself))
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};

/**
 * It takes in a profileData and a name, and returns a message object
 * @param {import('../../typedef').Profile} profileData - The profile data from the database.
 * @param {string} name - The name of the character that the profile data belongs to.
 * @param {boolean} isYourself - Whether the profile is by the user who executed the command
 * @returns {import('discord.js').MessageOptions} The message object.
 */
module.exports.getMessageContent = (profileData, name, isYourself) => {

	/** @type {Array<Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions>} */
	const components = [ new MessageActionRow({
		components: [ new MessageButton({
			customId: 'stats-refresh',
			emoji: '🔁',
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'profile-store',
			label: 'Store food away',
			style: 'SECONDARY',
		})],
	})];

	if (Object.values(profileData.inventory).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0 || !isYourself) {

		components[0].components.pop();
	}

	// "item" needs to be == and not === in order to catch the booleans as well
	let injuryText = Object.values(profileData.injuries).every(item => item == 0) ? null : '';

	for (const [injuryKind, injuryAmount] of Object.entries(profileData.injuries)) {

		if (injuryAmount > 0) {

			if (typeof injuryAmount === 'number') {

				injuryText += `, ${injuryAmount} ${(injuryAmount < 2) ? injuryKind.slice(0, -1) : injuryKind}`;
			}
			else {

				injuryText += `, ${injuryKind}: yes`;
			}
		}
	}

	const message = /** @type {import('discord.js').MessageOptions} */ ({
		content: `🚩 Levels: \`${profileData.levels}\` - 🏷️ Rank: ${profileData.rank}\n` +
			`✨ XP: \`${profileData.experience}/${profileData.levels * 50}\` - 🗺️ Region: ${profileData.currentRegion}\n` +
			`❤️ HP: \`${profileData.health}/${profileData.maxHealth}\` - ⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n` +
			`🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\` - 🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\`` +
			(injuryText === null ? '' : `\n🩹 Injuries/Illnesses: ${injuryText.slice(2)}`) +
			(profileData.sapling.exists === false ? '' : `\n🌱 Ginkgo Sapling: ${profileData.sapling.waterCycles} days alive - ${profileData.sapling.health} health - Next watering <t:${Math.floor((profileData.sapling.nextWaterTimestamp || 0) / 1000)}:R>`) +
			(profileData.hasQuest === false ? '' : `\n${name} has one open quest!`),
		components: components,
		failIfNotExists: false,
	});
	return message;
};