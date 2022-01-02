const restingTimeoutArray = new Array();
const profileModel = require('../models/profileSchema');

module.exports = {

	stopResting(userId) {

		clearTimeout(restingTimeoutArray[userId]);
	},

	async startResting(message, profileData, botReply) {

		let energyPoints = 0;
		restingTimeoutArray[message.author.id] = setTimeout(timerfunction, 30000);

		async function timerfunction() {

			++energyPoints;
			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $inc: { energy: 1 } },
				{ upsert: true, new: true },
			);

			console.log(`\x1b[32m\x1b[0m${message.author.tag} is at \x1b[33m${profileData.energy} energy \x1b[0mfrom resting in \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			botReply.embeds[0].footer.text = `+${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;
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