import { ActionRowBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData } from 'discord.js';
import DiscordUser from '../models/discordUser';
import Quid from '../models/quid';
import User from '../models/user';
import Webhook from '../models/webhook';
import { ContextMenuCommand } from '../typings/handle';
import { hasName, isInGuild } from '../utils/checkUserState';
import { disableAllComponents } from '../utils/componentDisabling';
import { getDisplayname } from '../utils/getQuidInfo';
import { getArrayElement, respond } from '../utils/helperFunctions';
import { canManageWebhooks, missingPermissions } from '../utils/permissionHandler';

export const command: ContextMenuCommand = {
	data: {
		name: 'Wrong Proxy 🔀',
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (interaction) => {

		/* This shouldn't happen as dm_permission is false. */
		if (!isInGuild(interaction)) { return; }

		/* This gets the webhookData and discordUsers */
		const webhookData = await Webhook.findByPk(interaction.targetId, {
			attributes: [], include: [{
				model: Quid, as: 'quid', attributes: ['userId'], include: [{
					model: User, as: 'user', attributes: ['id'], include: [{
						model: DiscordUser, as: 'discordUsers', attributes: ['id'],
					}],
				}],
			}],
		});
		const discordUsers = webhookData?.quid?.user?.discordUsers ?? [];
		const user = webhookData?.quid?.user;

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
	async sendMessageComponentResponse(interaction, { user, userToServer, quidToServer, discordUser }) {

		if (!interaction.isStringSelectMenu()) { return; }
		if (await missingPermissions(interaction, [
			'ViewChannel', 'ReadMessageHistory', // Needed for message fetch call
			'ManageWebhooks', // Needed for webhook interaction
		]) === true) { return; }

		if (!interaction.inCachedGuild()) { throw new Error('interaction is not in cached guild'); }
		if (discordUser === undefined) { throw new TypeError('discordUser is undefined'); }
		if (user === undefined) { throw new TypeError('user is undefined'); }
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

			const channel = interaction.channel;

			const webhookChannel = (channel && channel.isThread()) ? channel.parent : channel;
			if (webhookChannel === null || channel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
			if (await canManageWebhooks(channel) === false) { return; }
			const webhook = (await webhookChannel.fetchWebhooks()).find(webhook => webhook.name === 'PnP Profile Webhook')
			|| await webhookChannel.createWebhook({ name: 'PnP Profile Webhook' });

			const previousMessage = await channel.messages.fetch(targetMessageId);
			if (previousMessage === undefined) { throw new TypeError('previousMessage is undefined'); }

			const botMessage = await webhook
				.send({
					username: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					avatarURL: quid.avatarURL,
					content: previousMessage.content || undefined,
					files: previousMessage.attachments.toJSON(),
					embeds: previousMessage.embeds,
					threadId: channel.isThread() ? channel.id : undefined,
				});
			await Webhook.create({ id: botMessage.id, discordUserId: discordUser.id, quidId: quid.id });

			/* Deleting the message. */
			await webhook.deleteMessage(targetMessageId, channel.isThread() ? channel.id : undefined);
			await Webhook.destroy({ where: { id: previousMessage.id } });

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: disableAllComponents(interaction.message.components),
			}, 'update', interaction.message.id);
		}

	},
};

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