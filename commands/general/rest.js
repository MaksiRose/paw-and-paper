const profileModel = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isPassedOut, hasCooldown } = require('../../utils/checkValidity');
const { startResting } = require('../../utils/executeResting');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../specific/attack');

module.exports = {
	name: 'rest',
	aliases: ['sleep'],
	async sendMessage(client, message, argumentsArray, profileData) {

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
						description: `${profileData.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} must be really tired to dream of sleeping!`,
					}],
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
						description: `*${profileData.name} trots around the dens eyeing ${profileData.pronounArray[2]} comfortable moss-covered bed. A nap looks nice, but ${profileData.pronounArray[0]} ha${(profileData.pronounArray[5] == 'singular') ? 's' : 've'} far too much energy to rest!*`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
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
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await startResting(message, profileData, botReply);
	},
};