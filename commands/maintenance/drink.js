const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber } = require('../../utils/randomizers');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { remindOfAttack } = require('../gameplay/attack');
const { pronounAndPlural, pronoun } = require('../../utils/getPronouns');

module.exports = {
	name: 'drink',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		const messageContent = remindOfAttack(message);

		if (profileData.thirst >= profileData.maxThirst) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*Water sounds churned in ${profileData.name}'s ear, ${pronoun(profileData, 2)} mouth longing for just one more drink. It seems like ${pronoun(profileData, 0)} can never be as hydrated as ${pronounAndPlural(profileData, 0, 'want')}, but  ${pronoun(profileData, 0)} had plenty of water today.*`,
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (profileData.currentRegion != 'lake') {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { currentRegion: 'lake' } },
			);
		}

		embedArray.push({
			color: config.default_color,
			author: { name: message.guild.name, icon_url: message.guild.iconURL() },
			description: 'For the next 15 seconds, click the button as many times as you can!',
		});

		const botReply = await message
			.reply({
				content: messageContent,
				embeds: embedArray,
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'water',
						emoji: { name: '💧' },
						style: 'PRIMARY',
					}],
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		return await new Promise((resolve) => {

			const filter = i => i.customId === 'water' && i.user.id === message.author.id;

			const collector = message.channel.createMessageComponentCollector({ filter, time: 15000 });
			collector.on('end', async collected => {

				let thirstPoints = generateRandomNumber(3, collected.size);

				if (profileData.thirst + thirstPoints > profileData.maxThirst) {

					thirstPoints -= (profileData.thirst + thirstPoints) - profileData.maxThirst;
				}

				profileData = await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: { thirst: +thirstPoints },
					},
				);
				embedArray.splice(-1, 1, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} scurries over to the river and takes hasty gulps. The fresh water runs down ${pronoun(profileData, 2)} throat and fills ${pronoun(profileData, 2)} body with new energy.*`,
					footer: { text: `+${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})${(profileData.currentRegion != 'lake') ? '\nYou are now at the lake' : ''}\n\nDon't forget to stay hydrated in real life too!` },
				});

				await botReply
					.edit({
						embeds: embedArray, components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return resolve();
			});
		});
	},
};