// @ts-check
const { MessageActionRow, MessageButton } = require('discord.js');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports.name = 'stats';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	userData = await startCooldown(message);

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

	if (Object.values(profileData.injuries).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0) {

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

	await message
		.reply({
			content: `🚩 Levels: \`${profileData.levels}\` - ✨ XP: \`${profileData.experience}/${profileData.levels * 50}\`\n❤️ Health: \`${profileData.health}/${profileData.maxHealth}\` - ⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\` - 🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\`\n${injuryText === null ? '' : `🩹 Injuries/Illnesses: ${injuryText.slice(2)}`}`,
			components: components,
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};