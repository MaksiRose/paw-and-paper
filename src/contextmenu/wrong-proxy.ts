import { ActionRowBuilder, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import userModel from '../models/userModel';
import { ContextMenuCommand, UserSchema, WebhookMessages } from '../typedef';
import { disableAllComponents } from '../utils/componentDisabling';
import { getMapData, respond, update } from '../utils/helperFunctions';

const name: ContextMenuCommand['name'] = 'Wrong Proxy 🔀';
export const command: ContextMenuCommand = {
	name: name,
	data: {
		name: name,
		type: 3,
		dm_permission: false,
	},
	sendCommand: async (client, interaction) => {

		/* This gets the webhookCache and userData */
		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;
		const userData = await userModel.findOne(u => u.userId.includes(webhookCache[interaction.targetId]?.split('_')[0] || '')).catch(() => { return null; });

		/* This is checking if the user who is trying to edit the message is the same user who sent the message. */
		if (userData === null || !userData.userId.includes(interaction.user.id)) {

			await interaction
				.reply({
					content: 'With this command, you can change which quid a proxied message you sent is from. The message you selected is not a proxied message sent by you!',
					ephemeral: true,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		const quidMenu = getQuidsPage(userData, 0, interaction.targetId);
		await respond(interaction, {
			content: 'Select a quid that you want the proxied message to be from instead.\n⚠️ CAUTION! This does *not edit* the message, but deletes it and sends a new one with the new avatar and username, but same content. It is therefore not adviced to use this feature on older messages.',
			components: quidMenu.options.length > 0 ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents(quidMenu)] : [],
			ephemeral: true,
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	},
};

/**
 * It takes a user's quids, a page number, and a message ID, and returns a select menu builder with the user's quids as options
 * @param {UserSchema} userData - The user's data
 * @param {number} quidsPage - The page of quids to show.
 * @param {string} targetMessageId - The message ID of the message that the user wants to replace the quid in
 * @returns A SelectMenuBuilder object
 */
function getQuidsPage(
	userData: UserSchema,
	quidsPage: number,
	targetMessageId: string,
): SelectMenuBuilder {

	let quidMenuOptions: RestOrArray<SelectMenuComponentOptionData> = Object.values(userData.quids).map(quid => ({ label: quid.name, value: `wrongproxy_replace_${quid._id}` }));

	if (quidMenuOptions.length > 25) {

		quidMenuOptions = quidMenuOptions.splice(quidsPage * 24, 24);
		quidMenuOptions.push({ label: 'Show more quids', value: `wrongproxy_nextpage_${quidsPage}`, description: `You are currently on page ${quidsPage + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId(`wrongproxy_quidselect_${targetMessageId}`)
		.setPlaceholder('Select a quid')
		.setOptions(quidMenuOptions);
}

export async function wrongproxyInteractionCollector(
	interaction: SelectMenuInteraction,
	userData: UserSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('interaction is not in cached guild'); }
	if (userData === null) { throw new TypeError('userData is null'); }
	const selectOptionId = interaction.values[0];
	if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }
	const targetMessageId = interaction.customId.split('_')[2];
	if (targetMessageId === undefined) { throw new TypeError('targetMessageId is undefined'); }

	/* Checking if the user has clicked on the "Show more accounts" button, and if they have, it will increase the page number by 1, and if the page number is greater than the total number of pages, it will set the page number to 0. Then, it will edit the bot reply to show the next page of accounts. */
	if (selectOptionId.includes('nextpage')) {

		/* Getting the quidsPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
		let quidsPage = Number(selectOptionId.split('_')[2]) + 1;
		if (quidsPage >= Math.ceil((Object.keys(userData.quids).length + 1) / 24)) { quidsPage = 0; }

		const quidMenu = getQuidsPage(userData, quidsPage, targetMessageId);
		await update(interaction, {
			components: quidMenu.options.length > 0 ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents(quidMenu)] : [],
		})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (selectOptionId.includes('replace')) {

		/* Getting the quid form the value Id */
		const quidId = selectOptionId.split('_')[2];
		if (quidId === undefined) { throw new TypeError('quidId is undefined'); }
		const quidData = getMapData(userData.quids, quidId);

		const channel = interaction.channel;

		const webhookChannel = (channel && channel.isThread()) ? channel.parent : channel;
		if (webhookChannel === null || channel === null) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
		const webhook = (await webhookChannel
			.fetchWebhooks()
			.catch(async (error) => {
				if (error.httpStatus === 403) {
					await channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
				}
				throw new Error(error);
			})
		).find(webhook => webhook.name === 'PnP Profile Webhook') || await webhookChannel
			.createWebhook({ name: 'PnP Profile Webhook' })
			.catch(async (error) => {
				if (error.httpStatus === 403) {
					await channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
				}
				throw new Error(error);
			});

		const previousMessage = await channel.messages.fetch(targetMessageId);
		if (previousMessage === undefined) { throw new TypeError('previousMessage is undefined'); }

		/* This gets the webhookCache and userData */
		const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8')) as WebhookMessages;

		const botMessage = await webhook
			.send({
				username: quidData.name,
				avatarURL: quidData.avatarURL,
				content: previousMessage.content || null,
				files: previousMessage.attachments.toJSON(),
				embeds: previousMessage.embeds,
				threadId: channel.isThread() ? channel.id : undefined,
			})
			.catch((error) => { throw new Error(error); });

		webhookCache[botMessage.id] = interaction.user.id + (quidData?._id !== undefined ? `_${quidData?._id}` : '');
		writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));

		/* Deleting the message. */
		await webhook
			.deleteMessage(targetMessageId, channel.isThread() ? channel.id : undefined)
			.catch((error) => { throw new Error(error); });

		await update(interaction, {
			components: disableAllComponents(interaction.message.components),
		})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
}
