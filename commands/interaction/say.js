// @ts-check
const { profileModel } = require('../../models/profileModel');
const { default_color } = require('../../config.json');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { readFileSync, writeFileSync } = require('fs');

module.exports.name = 'say';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @param {boolean} pingRuins
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData, embedArray, pingRuins) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	const webHook = (await /** @type {import('discord.js').TextChannel} */ (message.channel)
		.fetchWebhooks()
		.catch((error) => {
			if (error.httpStatus === 403) {
				message.channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		})
	).find(webhook => webhook.name === 'PnP Profile Webhook') || await /** @type {import('discord.js').TextChannel} */ (message.channel)
		.createWebhook('PnP Profile Webhook')
		.catch((error) => {
			if (error.httpStatus === 403) {
				message.channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		});

	let userText = argumentsArray.join(' ');

	if (!userText) {

		await message
			.reply({
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Talk to your fellow packmates! Gives 1 experience point each time. Here is how to use the command:',
					description: '\n\nrp say "text"\nReplace "text" with your text.',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
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

	if (pingRuins === true) {

		const allRuinProfilesArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel
			.find({
				serverId: message.guild.id,
				currentRegion: profileData.currentRegion,
			}))
			.map(user => user.userId)
			.filter(userId => userId != profileData.userId);

		for (let i = 0; i < allRuinProfilesArray.length; i++) {

			allRuinProfilesArray[i] = `<@${allRuinProfilesArray[i]}>`;
		}

		if (allRuinProfilesArray.length === 0) {

			userText = allRuinProfilesArray.join(' ') + '\n' + userText;
		}
	}

	/** @type {import('../../typedef').WebhookMessages} */
	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8'));
	/** @type {Array<import('discord.js').MessageEmbedOptions>} */
	let embeds = [];

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

	writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));

	return;
};