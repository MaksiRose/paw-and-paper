const profileModel = require('../../models/profileModel');
const config = require('../../config.json');
const startCooldown = require('../../utils/startCooldown');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');

module.exports = {
	name: 'say',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray, pingRuins) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		const webHook = (await message.channel
			.fetchWebhooks()
			.catch((error) => {
				if (error.httpStatus === 403) {
					message.channel.send('Please give me permission to create webhooks 😣');
				}
				throw new Error(error);
			})
		).find(webhook => webhook.name === 'PnP Profile Webhook') || await message.channel
			.createWebhook('PnP Profile Webhook')
			.catch((error) => {
				if (error.httpStatus === 403) {
					message.channel.send('Please give me permission to create webhooks 😣');
				}
				throw new Error(error);
			});

		let userText = argumentsArray.join(' ');

		if (!userText) {

			embedArray.push({
				color: config.default_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'Talk to your fellow packmates! Gives 1 experience point each time. Here is how to use the command:',
				description: '\n\nrp say "text"\nReplace "text" with your text.',
			});

			return await message
				.reply({
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		message
			.delete()
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $inc: { experience: 1 } },
		);

		if (pingRuins == true) {

			const allRuinProfilesArray = (await profileModel
				.find({
					serverId: message.guild.id,
					currentRegion: profileData.currentRegion,
				}))
				.map(user => user.userId)
				.filter(userId => userId != profileData.userId);

			for (let i = 0; i < allRuinProfilesArray.length; i++) {

				allRuinProfilesArray[i] = `<@${allRuinProfilesArray[i]}>`;
			}

			if (allRuinProfilesArray != '') {

				userText = allRuinProfilesArray.join(' ') + '\n' + userText;
			}
		}

		console.log(message.reference);
		if (message.reference !== null) {

			const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

			const mention = `\n${referencedMessage.author.toString()} [jump](https://discord.com/channels/${referencedMessage.guild.id}/${referencedMessage.channel.id}/${referencedMessage.id})\n`;
			const extraContent = referencedMessage.content.split('\n').map(line => `> ${line}`).join('\n').substring(0, 2000 - mention.length - userText.length);

			userText = extraContent + mention + userText;
		}

		return await webHook
			.send({
				content: userText,
				username: profileData.name,
				avatarURL: profileData.avatarURL,
			})
			.catch((error) => {
				throw new Error(error);
			});
	},
};