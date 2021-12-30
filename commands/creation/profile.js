const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');

module.exports = {
	name: 'profile',
	aliases: ['info', 'about'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkValidity.hasCooldown(message, profileData)) {

			return;
		}

		let components = [{
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'profile-refresh',
				emoji: { name: '🔁' },
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'profile-store',
				label: 'Store food away',
				style: 'SECONDARY',
			}],
		}];

		if (message.mentions.users.size) {

			try {

				profileData = await profileModel.findOne({ userId: message.mentions.users.first().id, serverId: message.guild.id });
			}
			catch (err) {

				console.log(err);
			}

			if (!profileData || profileData.species === '') {

				return await message.reply({
					embeds: [{
						color: '#9d9e51',
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: 'This user has no roleplay account, or the account setup process was not completed!',
					}],
				});
			}

			components = [{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'profile-refresh',
					emoji: { name: '🔁' },
					style: 'SECONDARY',
				}],
			}];
		}

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		let injuryText = (profileData.injuryArray.every(item => item == 0)) ? 'none' : '';
		const injuryNameArray = ['Wound', 'Infection', 'Cold', 'Sprain', 'Poison'];

		for (let i; i < profileData.injuryArray; i++) {

			if (profileData.injuryArray[i] > 0) {

				injuryText += `${profileData.injuryArray[i]} ${injuryNameArray[i]}${(profileData.injuryArray[i] > 1) ? 's' : ''}\n`;
			}
		}

		const description = (profileData.description == '') ? '' : `*${profileData.description}*`;
		const user = await client.users.fetch(profileData.userId);

		return await message.reply({
			embeds: [{
				color: profileData.color,
				title: `Profile - ${user.tag}`,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: description,
				thumbnail: { url: profileData.avatarURL },
				fields: [
					{ name: '**🦑 Species**', value: profileData.species.charAt(0).toUpperCase() + profileData.species.slice(1), inline: true },
					{ name: '**🏷️ Rank**', value: profileData.rank, inline: true },
					{ name: '**🍂 Pronouns**', value: `${profileData.pronounArray[0]}/${profileData.pronounArray[1]} (${profileData.pronounArray[2]}/${profileData.pronounArray[3]}/${profileData.pronounArray[4]})` },
					{ name: '**🗺️ Region**', value: profileData.currentRegion },
					{ name: '**🚩 Levels**', value: `\`${profileData.levels}\``, inline: true },
					{ name: '**✨ XP**', value: `\`${profileData.experience}/${profileData.levels * 50}\``, inline: true },
					{ name: '**Condition**', value: `❤️ Health: \`${profileData.health}/${profileData.maxHealth}\`\n⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\`\n🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\`` },
					{ name: '**🩹 Injuries/Illnesses**', value: injuryText },
				],
			}],
			components: components,
		});
	},
};
