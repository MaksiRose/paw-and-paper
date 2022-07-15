// @ts-check
const { readFileSync } = require('fs');
const profileModel = require('../../models/profileModel');

module.exports.name = 'Delete ❌';
module.exports.data = {
	'name': module.exports.name,
	'type': 3,
	'dm_permission': false,
};

/**
 *
 * @param {import('../paw').client} client
 * @param {import('discord.js').MessageContextMenuInteraction} interaction
 * @returns {Promise<void>}
 */
module.exports.sendCommand = async (client, interaction) => {

	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8'));
	const userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: webhookCache?.[interaction.targetId]?.split('_')?.[0] }));

	if (userData === null || userData.userId !== interaction.user.id) {

		await interaction
			.reply({
				content: 'With this command, you can delete a proxied message you sent. The message you selected is not a proxied message sent by you!',
				ephemeral: true,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (!interaction.channel) { throw new Error('Interaction channel cannot be found.'); }
	const webhookChannel = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
	if (!webhookChannel || webhookChannel.type === 'DM') { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
	const webhook = (await webhookChannel
		.fetchWebhooks()
		.catch(async (error) => {
			if (error.httpStatus === 403) {
				await interaction.channel?.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		})
	).find(webhook => webhook.name === 'PnP Profile Webhook') || await webhookChannel
		.createWebhook('PnP Profile Webhook')
		.catch(async (error) => {
			if (error.httpStatus === 403) {
				await interaction.channel?.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		});

	await webhook
		.deleteMessage(interaction.targetId, interaction.channel.isThread() ? interaction.channel.id : undefined)
		.catch((error) => { throw new Error(error); });

	await interaction
		.reply({
			content: 'Deleted! ✅',
			ephemeral: true,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};