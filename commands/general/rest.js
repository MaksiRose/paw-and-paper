const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const executeResting = require('../../utils/executeResting');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'rest',
	aliases: ['sleep'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isPassedOut(message, profileData)) {

			return;
		}

		if (await checkValidity.hasCooldown(message, profileData, [module.exports.name].concat(module.exports.aliases))) {

			return;
		}

		if (await checkValidity.hasQuest(message, profileData)) {

			return true;
		}

		profileData = await startCooldown(message, profileData);

		if (profileData.isResting == true) {

			return await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `${profileData.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} must be really tired to dream of sleeping!`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		if (profileData.energy >= profileData.maxEnergy) {

			return await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} trots around the dens eyeing ${profileData.pronounArray[2]} comfortable moss-covered bed. A nap looks nice, but ${profileData.pronounArray[0]} ha${(profileData.pronounArray[5] == 'singular') ? 's' : 've'} far too much energy to rest!*`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): isResting changed from \x1b[33m${profileData.isResting} \x1b[0mto \x1b[33mtrue \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): currentRegion changed from \x1b[33m${profileData.currentRegion} \x1b[0mto \x1b[33msleeping dens \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$set: {
						isResting: true,
						currentRegion: 'sleeping dens',
					},
				},
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		const botReply = await message
			.reply({
				embeds: [{
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name}'s chest rises and falls with the crickets. Snoring bounces off each wall, finally exiting the den and rising free to the clouds.*`,
					footer: { text: `+0 energy (${profileData.energy}/${profileData.maxEnergy})${(profileData.currentRegion != 'sleeping dens') ? '\nYou are now at the sleeping dens' : ''}` },
				}],
			})
			.catch((error) => {
				if (error.httpStatus == 404) {
					console.log('Message already deleted');
				}
				else {
					throw new Error(error);
				}
			});

		await executeResting.startResting(message, profileData, botReply);
	},
};