const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');

const restingTimeoutArray = new Array();

module.exports = {
	name: 'rest',
	aliases: ['sleep'],
	stopResting(profileID) {
		clearTimeout(restingTimeoutArray[profileID]);
	},
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isPassedOut(message, profileData)) {

			return;
		}

		if (await checkValidity.hasCooldown(message, profileData)) {

			return;
		}

		if (await checkValidity.hasQuest(message, profileData)) {

			return true;
		}

		if (profileData.isResting == true) {

			return await message.reply({
				embeds: [{
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `${profileData.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} must be really tired to dream of sleeping!`,
				}],
			});
		}

		if (profileData.energy >= profileData.maxEnergy) {

			return await message.reply({
				embeds: [{
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} trots around the dens eyeing ${profileData.pronounArray[2]} comfortable moss-covered bed. A nap looks nice, but ${profileData.pronounArray[0]} ha${(profileData.pronounArray[5] == 'singular') ? 's' : 've'} far too much energy to rest!*`,
				}],
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
			{ upsert: true, new: true },
		);

		const botReply = await message.reply({
			embeds: [{
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name}'s chest rises and falls with the crickets. Snoring bounces off each wall, finally exiting the den and rising free to the clouds.*`,
				footer: { text: `+0 energy (${profileData.energy}/${profileData.maxEnergy})` },
			}],
		});

		restingTimeoutArray[message.author.id] = setTimeout(timerfunction, 30000);

		async function timerfunction() {
			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $inc: { energy: 1 } },
				{ upsert: true, new: true },
			);
			console.log(`\x1b[32m\x1b[0m${message.author.tag} is at \x1b[33m${profileData.energy} energy \x1b[0mfrom resting in \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			botReply.embeds[0].footer.text = `+${profileData.energy - profileData.energy} energy (${profileData.energy}/${profileData.maxEnergy})`;
			await botReply.edit({
				embeds: botReply.embeds,
			});

			if (profileData.energy >= profileData.maxEnergy) {

				await message.channel.sendTyping();

				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $set: { isResting: false } },
					{ upsert: true, new: true },
				);

				await botReply.delete();
				return await message.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name}'s eyes blink open, ${profileData.pronounArray[0]} sit${(profileData.pronounArray[5]) == 'singular' ? 's' : ''} up to stretch and then walk out into the light and buzz of late morning camp. Younglings are spilling out of the nursery, ambitious to start the day, Hunters and Healers are traveling in and out of the camp border. It is the start of the next good day!*`,
					}],
					allowedMentions: {
						repliedUser: true,
					},
				});
			}

			return restingTimeoutArray[message.author.id] = setTimeout(timerfunction, 30000);
		}
	},
};