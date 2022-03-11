const profileModel = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'profile',
	aliases: ['info', 'about'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		const components = [{
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

		if (message.mentions.users.size > 0) {

			profileData = await profileModel.findOne({
				userId: message.mentions.users.first().id,
				serverId: message.guild.id,
			});

			if (!profileData || profileData.species === '') {

				return await message
					.reply({
						embeds: [{
							color: '#9d9e51',
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							description: 'This user has no roleplay account, or the account setup process was not completed!',
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			components[0].components.pop();
		}
		else if (Object.values(profileData.inventoryObject).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0) {

			components[0].components.pop();
		}

		let injuryText = Object.values(profileData.injuryObject).every(item => item == 0) ? 'none' : '';

		for (const [injuryKind, injuryAmount] of Object.entries(profileData.injuryObject)) {

			if (injuryAmount > 0) {

				if (typeof injuryAmount === 'number') {

					injuryText += `${injuryAmount} ${(injuryAmount < 2) ? injuryKind.slice(0, -1) : injuryKind}\n`;
				}
				else {

					injuryText += `${injuryKind}: yes\n`;
				}
			}
		}

		const description = (profileData.description == '') ? '' : `*${profileData.description}*`;
		const user = await client.users
			.fetch(profileData.userId)
			.catch((error) => {
				throw new Error(error);
			});

		return await message
			.reply({
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
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};
