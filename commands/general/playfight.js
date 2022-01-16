const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');

module.exports = {
	name: 'playfight',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} believes that ${profileData.pronouns[0]} ${(profileData.pronouns[5] == 'singular') ? 'is' : 'are'} so unmatched that only ${profileData.pronouns[0]} could defeat ${profileData.pronouns[4]}. But it doesn't take ${profileData.pronouns[1]} long to realize that it is more fun to fight a partner after all.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
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

		if (!message.mentions.users.size) {

			embedArray.push({
				color: config.error_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'Please mention a user that you want to playfight with!',
			});

			return await message
				.reply({
					embeds: embedArray,
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

		const partnerProfileData = await profileModel
			.findOne({
				userId: message.mentions.users.first().id,
				serverId: message.guild.id,
			})
			.catch((error) => {
				throw new Error(error);
			});

		embedArray.push({
			color: config.default_color,
			author: { name: message.guild.name, icon_url: message.guild.iconURL() },
			title: `${partnerProfileData.name}, you were challenged to a playfight by ${profileData.name}. Do you accept?`,
			footer: { text: 'You have 30 seconds to click the button before the invitation expires.' },
		});

		let botReply = await message
			.reply({
				content: `<@!${partnerProfileData.id}>`,
				embeds: embedArray,
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'playfight-confirm',
						label: 'Accept challenge',
						emoji: { name: '🎭' },
						style: 'SUCCESS',
					}],
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

		const filter = async (i) => {

			if (!i.message.reference || !i.message.reference.messageId) {

				return false;
			}

			const userMessage = await i.channel.messages
				.fetch(i.message.reference.messageId)
				.catch((error) => {
					throw new Error(error);
				});

			return userMessage.id == message.id && (i.customId == 'playfight-confirm') && i.user.id == message.mentions.users.first().id;
		};

		const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
		collector.on('end', async function collectorEnd(collected) {

			if (!collected.size) {

				return await botReply
					.edit({
						components: [],
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

			await botReply
				.delete()
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});

			botReply = await message
				.reply()
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		});
	},
};