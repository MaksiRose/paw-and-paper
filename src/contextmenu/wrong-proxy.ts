import { ActionRowBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, WebhookClient, ForumChannel, NewsChannel, StageChannel, StringSelectMenuInteraction, TextChannel, VoiceChannel, Message, APIMessage, Webhook as DiscordWebhook, time, EmbedBuilder } from 'discord.js';
import Channel from '../models/channel';
import DiscordUser from '../models/discordUser';
import ProxyLimits from '../models/proxyLimits';
import Quid from '../models/quid';
import QuidToServer from '../models/quidToServer';
import User from '../models/user';
import UserToServer from '../models/userToServer';
import Webhook from '../models/webhook';
import { ContextMenuCommand } from '../typings/handle';
import { hasName, isInGuild } from '../utils/checkUserState';
import { disableAllComponents } from '../utils/componentDisabling';
import { getDisplayname } from '../utils/getQuidInfo';
import { getArrayElement, respond } from '../utils/helperFunctions';
import { explainRuleset, ruleIsBroken } from '../utils/nameRules';
import { canManageWebhooks, missingPermissions } from '../utils/permissionHandler';

export const command: ContextMenuCommand = {
	data: {
		name: 'Wrong Proxy 🔀',
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (interaction, { user }) => {

		/* This shouldn't happen as dm_permission is false. */
		if (!isInGuild(interaction)) { return; }

		/* This gets the webhookData and discordUsers */
		const webhookData = await Webhook.findByPk(interaction.targetId, {
			include: [{
				model: Quid, as: 'quid', attributes: ['userId'],
			}],
		});
		const discordUsers = await DiscordUser.findAll({ where: { userId: webhookData?.quid?.userId } }) ?? [];

		/* This is checking if the user who is trying to delete the message is the same user who sent the message. */
		if (!user || !discordUsers.some(du => du.id === interaction.user.id)) {

			await interaction
				.reply({
					content: 'With this command, you can change which quid a proxied message you sent is from. The message you selected is not a proxied message sent by you!',
					ephemeral: true,
				});
			return;
		}

		const quids = await Quid.findAll({ where: { userId: user.id } });
		const quidMenu = getQuidsPage(quids, 0, interaction.targetId);
		// This is always a reply
		await respond(interaction, {
			content: 'Select a quid that you want the proxied message to be from instead.\n⚠️ CAUTION! This does *not edit* the message, but deletes it and sends a new one with the new avatar and username, but same content. It is therefore not adviced to use this feature on older messages.',
			components: quidMenu.options.length > 0 ? [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(quidMenu)] : [],
			ephemeral: true,
		});
	},
	async sendMessageComponentResponse(interaction, { user, userToServer, quidToServer, discordUser, server }) {

		if (!interaction.isStringSelectMenu()) { return; }
		if (await missingPermissions(interaction, [
			'ViewChannel', 'ReadMessageHistory', // Needed for message fetch call
			'ManageWebhooks', // Needed for webhook interaction
		]) === true) { return; }

		if (!interaction.inCachedGuild()) { throw new Error('interaction is not in cached guild'); }
		if (discordUser === undefined) { throw new TypeError('discordUser is undefined'); }
		if (user === undefined) { throw new TypeError('user is undefined'); }
		if (server === undefined) { throw new TypeError('server is undefined'); }
		const selectOptionId = getArrayElement(interaction.values, 0);
		const targetMessageId = getArrayElement(interaction.customId.split('_'), 2).replace('@', '');

		/* Checking if the user has clicked on the "Show more accounts" button, and if they have, it will increase the page number by 1, and if the page number is greater than the total number of pages, it will set the page number to 0. Then, it will edit the bot reply to show the next page of accounts. */
		if (selectOptionId.includes('nextpage')) {

			const quids = await Quid.findAll({ where: { userId: user.id } });

			/* Getting the quidsPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
			let quidsPage = Number(selectOptionId.split('_')[2]) + 1;
			if (quidsPage >= Math.ceil((quids.length + 1) / 24)) { quidsPage = 0; }

			const quidMenu = getQuidsPage(quids, quidsPage, targetMessageId);
			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: quidMenu.options.length > 0 ? [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(quidMenu)] : [],
			}, 'update', interaction.message.id);
			return;
		}

		if (selectOptionId.includes('replace')) {

			/* Getting the quid form the value Id */
			const quidId = getArrayElement(selectOptionId.split('_'), 2);
			const quid = await Quid.findByPk(quidId);
			if (!hasName(quid)) { return; }

			if (interaction.channel === null) { throw new Error('Interaction channel is null.'); }
			if (await canManageWebhooks(interaction.channel) === false) { return; }

			const quidName = await getDisplayname(quid, { serverId: interaction.guildId, user, userToServer });
			if (server.nameRuleSets.length > 0 && await ruleIsBroken(interaction.channel, interaction.user, server, quidName)) {

				await respond(interaction, {
					content: `Your message can't be proxied because your quid's displayname needs to include one of these:\n\n${server.nameRuleSets.map(nameRuleSet => `• ${explainRuleset(nameRuleSet)}`)}`,
					ephemeral: true,
					allowedMentions: { parse: [] },
				});
				return;
			}

			const webhookChannel = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
			if (webhookChannel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }

			const { botMessage, webhook, previousMessage } = await replaceWebhookMessage(webhookChannel, interaction, targetMessageId, quid, userToServer, quidToServer, user, discordUser);
			await Webhook.create({ id: botMessage.id, discordUserId: discordUser.id, quidId: quid.id });

			(async function() {
				if (server.logChannelId !== null) {

					const logLimits = await ProxyLimits.findByPk(server.logLimitsId);
					if (logLimits
					&& (
						(logLimits.setToWhitelist === true && !logLimits.whitelist.includes(interaction.channel!.id) && !logLimits.whitelist.includes(webhookChannel.id))
					|| (logLimits.setToWhitelist === false && (logLimits.blacklist.includes(interaction.channel!.id) || logLimits.blacklist.includes(webhookChannel.id)))
					)) { return; }

					const logChannel = await interaction.guild.channels.fetch(server.logChannelId);
					if (!logChannel || !logChannel.isTextBased()) { return; }

					logChannel.send({
						content: `**A message got replaced**\nMessage Link: https://discord.com/channels/${interaction.guildId}/${interaction.channelId!}/${botMessage.id}\nPrevious Message Link: ${previousMessage.url}\nSent by: <@${interaction.user.id}> ${interaction.user.tag}\nNew Quid ID: ${quid.id}\nOriginally sent on: ${time(Math.floor((previousMessage.createdTimestamp) / 1000), 'f')}`,
						embeds: [new EmbedBuilder()
							.setAuthor({
								name: quidName,
								iconURL: quid.avatarURL,
							})
							.setColor(quid.color)
							.setDescription((previousMessage.content || '') + '\n\n' + previousMessage.attachments.map(a => a.url).join('\n'))],
						allowedMentions: { parse: [] },
					});
				}
			})();

			/* Deleting the message. */
			await webhook.deleteMessage(targetMessageId, interaction.channel.isThread() ? interaction.channel.id : undefined);
			await Webhook.destroy({ where: { id: previousMessage.id } });

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: disableAllComponents(interaction.message.components),
			}, 'update', interaction.message.id);
		}
	},
};

async function replaceWebhookMessage(
	webhookChannel: NewsChannel | StageChannel | TextChannel | VoiceChannel | ForumChannel,
	interaction: StringSelectMenuInteraction<'cached'>,
	targetMessageId: string,
	quid: Quid,
	userToServer: UserToServer | undefined,
	quidToServer: QuidToServer | undefined,
	user: User | undefined,
	discordUser: DiscordUser | undefined,
): Promise<{ botMessage: APIMessage | Message, webhook: WebhookClient | DiscordWebhook, previousMessage: Message; }> {

	const channelData = await Channel.findByPk(webhookChannel.id);
	const webhook = channelData
		? new WebhookClient({ url: channelData.webhookUrl })
		: (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
		|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

	if (webhook instanceof DiscordWebhook) { Channel.create({ id: webhookChannel.id, serverId: webhookChannel.guildId, webhookUrl: webhook.url }); }

	const previousMessage = await interaction.channel!.messages.fetch(targetMessageId);
	if (previousMessage === undefined) { throw new TypeError('previousMessage is undefined'); }

	return await webhook
		.send({
			username: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
			avatarURL: quid.avatarURL,
			content: previousMessage.content || undefined,
			files: previousMessage.attachments.toJSON(),
			embeds: previousMessage.embeds,
			threadId: interaction.channel?.isThread() ? interaction.channel.id : undefined,
		})
		.then(botMessage => ({ botMessage, webhook, previousMessage }))
		.catch(async (err) => {
			if (err.message && err.message.includes('Unknown Webhook') && channelData) {

				await channelData.destroy();
				return await replaceWebhookMessage(webhookChannel, interaction, targetMessageId, quid, userToServer, quidToServer, user, discordUser);
			}
			throw err;
		});
}

function getQuidsPage(
	quids: Quid[],
	quidsPage: number,
	targetMessageId: string,
): StringSelectMenuBuilder {

	let quidMenuOptions: RestOrArray<SelectMenuComponentOptionData> = quids.map(quid => ({ label: quid.name, value: `wrongproxy_replace_${quid.id}` }));

	if (quidMenuOptions.length > 25) {

		quidMenuOptions = quidMenuOptions.splice(quidsPage * 24, 24);
		quidMenuOptions.push({ label: 'Show more quids', value: `wrongproxy_nextpage_${quidsPage}`, description: `You are currently on page ${quidsPage + 1}`, emoji: '📋' });
	}

	return new StringSelectMenuBuilder()
		.setCustomId(`${command.data.name}_quidselect_@${targetMessageId}`)
		.setPlaceholder('Select a quid')
		.setOptions(quidMenuOptions);
}