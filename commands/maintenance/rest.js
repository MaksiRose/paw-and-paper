// @ts-check
const { MessageActionRow, MessageButton } = require('discord.js');
const profileModel = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isPassedOut, hasCooldown } = require('../../utils/checkValidity');
const { startResting } = require('../../utils/executeResting');
const { upperCasePronoun, pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const sendNoDM = require('../../utils/sendNoDM');
const startCooldown = require('../../utils/startCooldown');
const wearDownDen = require('../../utils/wearDownDen');
const { remindOfAttack } = require('../gameplay/attack');

module.exports.name = 'rest';
module.exports.aliases = ['sleep'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData) => {

	if (await sendNoDM(message)) {

		return;
	}

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	if (await isPassedOut(message, userData, false)) {

		return;
	}

	if (await hasCooldown(message, userData, [module.exports.name].concat(module.exports.aliases))) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (profileData.isResting === true) {

		await message
			.reply({
				content: messageContent,
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `${characterData.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${upperCasePronoun(characterData, 0)} must be really tired to dream of sleeping!`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (profileData.energy >= profileData.maxEnergy) {

		await message
			.reply({
				content: messageContent,
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} trots around the dens eyeing ${pronoun(characterData, 2)} comfortable moss-covered bed. A nap looks nice, but ${pronounAndPlural(characterData, 0, 'has', 'have')} far too much energy to rest!*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].isResting = true;
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].currentRegion = 'sleeping dens';
			p.advice.resting = true;
		},
	);

	const weardownText = await wearDownDen(serverData, 'sleeping dens');

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [{
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name}'s chest rises and falls with the crickets. Snoring bounces off each wall, finally exiting the den and rising free to the clouds.*`,
				footer: { text: `+0 energy (${profileData.energy}/${profileData.maxEnergy})${(profileData.currentRegion != 'sleeping dens') ? '\nYou are now at the sleeping dens' : ''}${argumentsArray[0] === 'auto' ? '\nYour character started resting because you were inactive for 10 minutes' : ''}\n\n${weardownText}\n\nTip: You can also do "rp vote" to get +30 energy per vote!` },
			}],
			components: argumentsArray[0] === 'auto' ? [ new MessageActionRow({
				components: [ new MessageButton({
					customId: `resting-reminder-${userData.reminders.resting === true ? 'off' : 'on'}`,
					label: `Turn automatic resting pings ${userData.reminders.resting === true ? 'off' : 'on'}`,
					style: 'SECONDARY',
				})],
			})] : [],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	await startResting(message, userData, botReply, profileData.currentRegion, argumentsArray[0] === 'auto', weardownText);
};