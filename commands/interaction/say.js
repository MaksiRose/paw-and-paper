const profileModel = require('../../models/profileModel');
const config = require('../../config.json');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const fs = require('fs');

module.exports = {
	name: 'say',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray, pingRuins) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		const webHook = (await message.channel
			.fetchWebhooks()
			.catch((error) => {
				if (error.httpStatus === 403) {
					message.channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
				}
				throw new Error(error);
			})
		).find(webhook => webhook.name === 'PnP Profile Webhook') || await message.channel
			.createWebhook('PnP Profile Webhook')
			.catch((error) => {
				if (error.httpStatus === 403) {
					message.channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
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
					if (error.httpStatus !== 404) { throw new Error(error); }
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

		const webhookCache = JSON.parse(fs.readFileSync('./database/webhookCache.json'));
		let embeds = undefined;

		if (message.reference !== null) {

			const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

			if (webhookCache[referencedMessage.id] !== undefined) {

				const user = await client.users.fetch(webhookCache[referencedMessage.id]);
				referencedMessage.author = user;
			}

			embeds = [{
				author: { name: referencedMessage.member.displayName, icon_url: referencedMessage.member.displayAvatarURL() },
				color: referencedMessage.member.displayColor,
				description: referencedMessage.content,
			}];
		}

		const botMessage = await webHook
			.send({
				username: `${profileData.name} (${message.author.tag})`,
				avatarURL: profileData.avatarURL,
				content: userText || undefined,
				files: Array.from(message.attachments.values()) || undefined,
				embeds: embeds,
			})
			.catch((error) => { throw new Error(error); });

		webhookCache[botMessage.id] = message.author.id;

		fs.writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));

		return;
	},
};