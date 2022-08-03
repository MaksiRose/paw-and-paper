import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder, WebhookEditMessageOptions } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { SlashCommand, UserSchema } from '../../typedef';
import { createCommandComponentDisabler, disableAllComponents } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/getInfo';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'delete';
const description: SlashCommand['description'] = 'Delete parts of or your entire account.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData) => {

		/* Checking if the user has an account. If they do not, it will send a message saying they haave no account. */
		if (!userData) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('You have no account!')],
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		const botReply = await respond(interaction, sendOriginalMessage(), true)
			.catch((error) => { throw new Error(error); });

		createCommandComponentDisabler(userData.uuid, interaction.guildId || 'DM', botReply);
		return;
	},
};

export async function deleteInteractionCollector(interaction: ButtonInteraction | SelectMenuInteraction, userData: UserSchema | null) {

	if (!userData) { throw new Error('userData is null'); }
	const selectOptionId = interaction.isSelectMenu() ? interaction.values[0] : undefined;

	/* Creating a new page for the user to select an account to delete. */
	if (interaction.isButton() && interaction.customId === 'delete_individual') {

		await interaction
			.update({
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please select a quid that you want to delete.')],
				components: [
					getOriginalComponents(),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([getQuidsPage(0, userData)]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Checking if the interaction is a select menu and if the value starts with delete_individual_nextpage_. If it is, it increments the page number, and if the page number is greater than the number of pages, it sets the page number to 0. It will then edit the reply to have the new page of quids. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.startsWith('delete_individual_nextpage_')) {

		let deletePage = Number(selectOptionId.replace('delete_individual_nextpage_', '')) + 1;
		if (deletePage >= Math.ceil(Object.keys(userData.quids).length / 24)) { deletePage = 0; }

		await interaction
			.update({
				components: [
					getOriginalComponents(),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([getQuidsPage(deletePage, userData)]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Checking if the interaction is a select menu and if the quid ID of the value exists as a quid. If it does, it will edit the message to ask the user if they are sure they want to delete the quid. */
	if (interaction.isSelectMenu() && selectOptionId && Object.keys(userData.quids).includes(selectOptionId.replace('delete_individual_', ''))) {

		const _id = selectOptionId.replace('delete_individual_', '');
		const quid = getMapData(userData.quids, _id);

		await interaction
			.update({
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`Are you sure you want to delete the quid named "${quid.name}"? This will be **permanent**!!!`)],
				components: [
					...disableAllComponents([getOriginalComponents().toJSON(), new ActionRowBuilder<SelectMenuBuilder>().setComponents([SelectMenuBuilder.from(interaction.component)]).toJSON()]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId(`delete_confirm_individual_${_id}`)
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId('delete_cancel')
								.setLabel('Cancel')
								.setEmoji('✖')
								.setStyle(ButtonStyle.Secondary),
						]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Creating a new page for the user to select their accounts on a server to delete. */
	if (interaction.isButton() && interaction.customId === 'delete_server') {

		await interaction
			.update({
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please select a server that you want to delete all information off of.')],
				components: [
					getOriginalComponents(),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([await getServersPage(0, userData)]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Checking if the interaction is a select menu and if the value starts with delete_server_nextpage_. If it does, it increments the page number, and if the page number is greater than the number of pages, it sets the page number to 0. It will then edit the reply to have the new page of servers. */
	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.startsWith('delete_server_nextpage_')) {

		let deletePage = Number(selectOptionId.replace('delete_server_nextpage_', '')) + 1;
		if (deletePage >= Math.ceil([...new Set(Object.values(userData.quids).map(q => Object.keys(q.profiles)).flat())].length / 24)) { deletePage = 0; }

		await interaction
			.update({
				components: [
					getOriginalComponents(),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([await getServersPage(deletePage, userData)]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Checking if the interaction is a select menu and if the server ID is in the array of all servers. If it is, it will edit the message to ask the user if they are sure they want to delete all their information on the server. */
	if (interaction.isSelectMenu() && selectOptionId && [...new Set([...Object.values(userData.quids).map(q => Object.keys(q.profiles)), ...Object.keys(userData.currentQuid)].flat())].includes(selectOptionId.replace('delete_server_', ''))) {

		const server = await serverModel.findOne(s => s.serverId === selectOptionId.replace('delete_server_', ''));
		const accountsOnServer = Object.values(userData.quids).map(q => q.profiles[server.serverId]).filter(p => p !== undefined);

		await interaction
			.update({
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`Are you sure you want to delete all the information of ${accountsOnServer.length} quids on the server ${server.name}? This will be **permanent**!!!`)],
				components: [
					...disableAllComponents([getOriginalComponents().toJSON(), new ActionRowBuilder<SelectMenuBuilder>().setComponents([SelectMenuBuilder.from(interaction.component)]).toJSON()]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId(`delete_confirm_server_${server.serverId}`)
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId('delete_cancel')
								.setLabel('Cancel')
								.setEmoji('✖')
								.setStyle(ButtonStyle.Secondary),
						]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Creating a new message asking the user if they are sure that they want to delete all their data. */
	if (interaction.isButton() && interaction.customId === 'delete_all') {

		await interaction
			.update({
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Are you sure you want to delete all your data? This will be **permanent**!!!')
					.setDescription('Are you unhappy with your experience, or have other concerns? Let us know using `/ticket` (an account is not needed).')],
				components: [
					...disableAllComponents([getOriginalComponents().toJSON()]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId('delete_confirm_all')
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId('delete_cancel')
								.setLabel('Cancel')
								.setEmoji('✖')
								.setStyle(ButtonStyle.Secondary),
						]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	/* Deleting the data of the user. */
	if (interaction.customId.startsWith('delete_confirm')) {

		const type = (interaction.customId.split('_')[2]) as 'individual' | 'server' | 'all';

		/* Deleting a user from the database. */
		if (type === 'individual') {

			const _id = interaction.customId.replace('delete_confirm_individual_', '');
			const quid = getMapData(userData.quids, _id);

			await userModel.findOneAndUpdate(
				u => u.uuid === userData?.uuid,
				(u) => {
					delete u.quids[_id];
					for (const serverId of Object.keys(u.currentQuid)) {
						if (u.currentQuid[serverId] === _id) { delete u.currentQuid[serverId]; }
					}
				},
			);

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`The quid \`${quid.name}\` was deleted permanently!`)],
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		/* Deleting all accounts by a user on a server. */
		if (type === 'server') {

			const serverId = interaction.customId.replace('delete_confirm_server_', '');
			const accountsOnServer = Object.values(userData.quids).map(q => q.profiles[serverId]).filter(p => p !== undefined);

			await userModel.findOneAndUpdate(
				u => u.uuid === userData?.uuid,
				(u) => {
					for (const q of Object.values(u.quids)) {
						if (q.profiles[serverId] !== undefined) { delete q.profiles[serverId]; }
					}
					delete u.currentQuid[serverId];
				},
			);

			const server = await serverModel.findOne(s => s.serverId === serverId);

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`All the data of ${accountsOnServer.length} quids on the server \`${server.name}\` was deleted permanently!`)],
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		/* Deleting all the data of the user. */
		if (type === 'all') {

			await userModel.findOneAndDelete(u => u.uuid === userData?.uuid);

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('All your data was deleted permanently!')],
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			await interaction.message
				.edit({
					components: disableAllComponents(interaction.message.components.map(component => component.toJSON())),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		await interaction.message
			.edit(sendOriginalMessage())
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/* Editing the message to the original message. */
	if (interaction.customId === 'delete_cancel') {

		await interaction
			.update(sendOriginalMessage())
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}
}

function sendOriginalMessage(): WebhookEditMessageOptions {

	return {
		embeds: [new EmbedBuilder()
			.setColor(error_color)
			.setTitle('Please select what you want to delete.')],
		components: [getOriginalComponents()],
	};
}

function getOriginalComponents(): ActionRowBuilder<ButtonBuilder> {

	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents([new ButtonBuilder()
			.setCustomId('delete_individual')
			.setLabel('A quid')
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId('delete_server')
			.setLabel('All information on one server')
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId('delete_all')
			.setLabel('Everything')
			.setStyle(ButtonStyle.Danger)]);
}

/**
 * Creates a select menu with the users accounts
 */
function getQuidsPage(deletePage: number, userData: UserSchema): SelectMenuBuilder {

	let accountsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = Object.values(userData.quids).map(quid => ({ label: quid.name, value: `delete_individual_${quid._id}` }));

	if (accountsMenuOptions.length > 25) {

		accountsMenuOptions = accountsMenuOptions.splice(deletePage * 24, 24);
		accountsMenuOptions.push({ label: 'Show more quids', value: `delete_individual_nextpage_${deletePage}`, description: `You are currently on page ${deletePage + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId('delete_individual_options')
		.setPlaceholder('Select a quid')
		.setOptions(accountsMenuOptions);
}

/**
 * Creates a select menu with the servers that have accounts with this user
 */
async function getServersPage(deletePage: number, userData: UserSchema): Promise<SelectMenuBuilder> {

	let accountsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	const serverIdList = [...new Set([...Object.values(userData.quids).map(q => Object.keys(q.profiles)), ...Object.keys(userData.currentQuid)].flat())];
	for (const serverId of serverIdList) {

		const server = await serverModel.findOne(s => s.serverId === serverId).catch(() => { return null; });
		if (server === null) { continue; }
		accountsMenuOptions.push({ label: server.name, value: `delete_server_${server.serverId}` });
	}

	if (accountsMenuOptions.length > 25) {

		accountsMenuOptions = accountsMenuOptions.splice(deletePage * 24, 24);
		accountsMenuOptions.push({ label: 'Show more servers', value: `delete_server_nextpage_${deletePage}`, description: `You are currently on page ${deletePage + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId('delete_server_options')
		.setPlaceholder('Select a server')
		.setOptions(accountsMenuOptions);
}