const profileModel = require('../../models/profileModel');
const blockEntrance = require('../../utils/blockEntrance');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isPassedOut, hasCooldown } = require('../../utils/checkValidity');
const { startResting } = require('../../utils/executeResting');
const { upperCasePronoun, pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const { generateRandomNumber } = require('../../utils/randomizers');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');

module.exports = {
	name: 'rest',
	aliases: ['sleep'],
	async sendMessage(client, message, argumentsArray, profileData, serverData) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isPassedOut(message, profileData, false)) {

			return;
		}

		if (await hasCooldown(message, profileData, [module.exports.name].concat(module.exports.aliases))) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		const messageContent = remindOfAttack(message);

		if (profileData.isResting == true) {

			return await message
				.reply({
					content: messageContent,
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `${profileData.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${upperCasePronoun(profileData, 0)} must be really tired to dream of sleeping!`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (profileData.energy >= profileData.maxEnergy) {

			return await message
				.reply({
					content: messageContent,
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} trots around the dens eyeing ${pronoun(profileData, 2)} comfortable moss-covered bed. A nap looks nice, but ${pronounAndPlural(profileData, 0, 'has', 'have')} far too much energy to rest!*`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if ((profileData.rank !== 'Youngling' && serverData.blockedEntranceObject.den === null && generateRandomNumber(20, 0) === 0) || serverData.blockedEntranceObject.den === 'sleeping dens') {

			return await blockEntrance(message, messageContent, profileData, 'food den');
		}

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$set: {
					isResting: true,
					currentRegion: 'sleeping dens',
				},
			},
		);

		const botReply = await message
			.reply({
				content: messageContent,
				embeds: [{
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name}'s chest rises and falls with the crickets. Snoring bounces off each wall, finally exiting the den and rising free to the clouds.*`,
					footer: { text: `+0 energy (${profileData.energy}/${profileData.maxEnergy})${(profileData.currentRegion != 'sleeping dens') ? '\nYou are now at the sleeping dens' : ''}` },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await startResting(message, profileData, botReply);
	},
};