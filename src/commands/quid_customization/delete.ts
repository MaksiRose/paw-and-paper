import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import serverModel from '../../oldModels/serverModel';
import { saveCommandDisablingInfo, disableAllComponents } from '../../utils/componentDisabling';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { UserData } from '../../typings/data/user';
import { userModel } from '../../oldModels/userModel';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
const { error_color } = require('../../../config.json');

type CustomIdArgs = ['individual' | 'server' | 'all' | 'cancel'] | ['individual' | 'server', 'options'] | ['confirm', 'individual' | 'server', string] | ['confirm', 'all'];
type SelectOptionArgs = ['nextpage', `${number}`] | [string];

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('delete')
		.setDescription('Delete parts of or your entire account.')
		.toJSON(),
	category: 'page1',
	position: 11,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* Checking if the user has an account. If they do not, it will send a message saying they haave no account. */
		if (!userData) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('You have no account!')],
				ephemeral: true,
			});
			return;
		}

		// This is always a reply
		const { id: messageId } = await respond(interaction, { ...sendOriginalMessage(userData), fetchReply: true });

		if (userToServer) { saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, messageId); }
		return;
	},
	async sendMessageComponentResponse(interaction, userData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!customId) { throw new Error('customId is undefined'); }
		if (userData === null) { throw new Error('userData is null'); }

		/* Creating a new page for the user to select an account to delete. */
		if (interaction.isButton() && customId.args[0] === 'individual') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please select a quid that you want to delete.')],
				components: [
					getOriginalComponents(userData),
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents([getQuidsPage(0, userData)]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Creating a new page for the user to select their accounts on a server to delete. */
		if (interaction.isButton() && customId.args[0] === 'server') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please select a server that you want to delete all information off of.')],
				components: [
					getOriginalComponents(userData),
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents([getServersPage(0, userData)]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Creating a new message asking the user if they are sure that they want to delete all their data. */
		if (interaction.isButton() && customId.args[0] === 'all') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Are you sure you want to delete all your data? This will be **permanent**!!!')
					.setDescription('Are you unhappy with your experience, or have other concerns? Let us know using `/ticket` (an account is not needed).')],
				components: [
					...disableAllComponents([getOriginalComponents(userData)]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['confirm', 'all']))
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['cancel']))
								.setLabel('Cancel')
								.setEmoji('✖')
								.setStyle(ButtonStyle.Secondary),
						]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Deleting the data of the user. */
		if (interaction.isButton() && customId.args[0] === 'confirm') {

			const type = customId.args[1];

			/* Deleting a user from the database. */
			if (type === 'individual') {

				const quidId = customId.args[2];
				const quid = quids.get(quidId);

				await userData.update(
					(u) => {
						delete u.quids[quidId];
						// eslint-disable-next-line deprecation/deprecation
						for (const serverId of Object.keys(u.currentQuid)) {
							// eslint-disable-next-line deprecation/deprecation
							if (u.currentQuid[serverId] === quidId) { delete u.currentQuid[serverId]; }
						}
						for (const serverInfo of Object.values(u.servers)) {
							if (serverInfo.currentQuid) { serverInfo.currentQuid = null; }
						}
					},
				);

				// This is always an update to the message with the button
				await respond(interaction, sendOriginalMessage(userData), 'update', interaction.message.id);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle(`The quid \`${quid?.name}\` was deleted permanently!`)],
				});
			}

			/* Deleting all accounts by a user on a server. */
			if (type === 'server') {

				const serverId = customId.args[2];
				const accountsOnServer = quids.map(q => q.profiles[serverId]).filter(p => p !== undefined);

				await userData.update(
					(u) => {
						for (const userId of Object.values(u.userIds)) {
							if (userId[serverId] !== undefined) { delete userId[serverId]; }
						}
						for (const q of Object.values(u.quids)) {
							if (q.profiles[serverId] !== undefined) { delete q.profiles[serverId]; }
						}
						// eslint-disable-next-line deprecation/deprecation
						delete u.currentQuid[serverId];
						delete u.servers[serverId];
					},
				);

				const server = await serverModel.findOne(s => s.serverId === serverId);

				// This is always an update to the message with the button
				await respond(interaction, sendOriginalMessage(userData), 'update', interaction.message.id);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle(`All the data of ${accountsOnServer.length} quids on the server \`${server.name}\` was deleted permanently!`)],
				});
			}

			/* Deleting all the data of the user. */
			if (type === 'all') {

				await userModel.findOneAndDelete(u => u._id === userData?._id);

				// This is always an update to the message with the button
				await respond(interaction, {
					components: disableAllComponents(interaction.message.components),
				}, 'update', interaction.message.id);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('All your data was deleted permanently!')],
				});
				return;
			}
			return;
		}

		/* Editing the message to the original message. */
		if (interaction.isButton() && customId.args[0] === 'cancel') {

			// This is always an update to the message with the button
			await respond(interaction, sendOriginalMessage(userData), 'update', interaction.message.id);
			return;
		}

		if (interaction.isButton()) { return; }
		const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
		if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

		/* Checking if the interaction is a select menu and if the value starts with delete_individual_nextpage_. If it is, it increments the page number, and if the page number is greater than the number of pages, it sets the page number to 0. It will then edit the reply to have the new page of quids. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'individual' && customId.args[1] === 'options' && selectOptionId[0] === 'nextpage') {

			let deletePage = Number(selectOptionId[1]) + 1;
			if (deletePage >= Math.ceil(Object.keys(quids).length / 24)) { deletePage = 0; }

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: [
					getOriginalComponents(userData),
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents([getQuidsPage(deletePage, userData)]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Checking if the interaction is a select menu and if the quid ID of the value exists as a quid. If it does, it will edit the message to ask the user if they are sure they want to delete the quid. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'individual' && customId.args[1] === 'options') {

			const quidId = selectOptionId[0];
			const quid = quids.get(quidId);

			// This is always an update to the message with the select menu
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`Are you sure you want to delete the quid named "${quid?.name}"? This will be **permanent**!!!`)],
				components: [
					...disableAllComponents([getOriginalComponents(userData), new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(StringSelectMenuBuilder.from(interaction.component))]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['confirm', 'individual', quidId]))
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['cancel']))
								.setLabel('Cancel')
								.setEmoji('✖')
								.setStyle(ButtonStyle.Secondary),
						]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Checking if the interaction is a select menu and if the value starts with delete_server_nextpage_. If it does, it increments the page number, and if the page number is greater than the number of pages, it sets the page number to 0. It will then edit the reply to have the new page of servers. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'server' && customId.args[1] === 'options' && selectOptionId[0] === 'nextpage') {

			let deletePage = Number(selectOptionId[1]) + 1;
			if (deletePage >= Math.ceil([...new Set(quids.map(q => Object.keys(q.profiles)).flat())].length / 24)) { deletePage = 0; }

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: [
					getOriginalComponents(userData),
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents([getServersPage(deletePage, userData)]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Checking if the interaction is a select menu and if the server ID is in the array of all servers. If it is, it will edit the message to ask the user if they are sure they want to delete all their information on the server. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'server' && customId.args[1] === 'options') {

			const serverId = selectOptionId[0];
			const accountsOnServer = quids.map(q => q.profiles[serverId]).filter(p => p !== undefined);
			const server = (() => {
				try { return serverModel.findOne(s => s.serverId === selectOptionId[0]); }
				catch { return null; }
			})();

			// This is always an update to the message with the select menu
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`Are you sure you want to delete all the information of ${accountsOnServer.length} quids on the server ${server?.name}? This will be **permanent**!!!`)],
				components: [
					...disableAllComponents([getOriginalComponents(userData), new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(StringSelectMenuBuilder.from(interaction.component))]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['confirm', 'server', serverId]))
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['cancel']))
								.setLabel('Cancel')
								.setEmoji('✖')
								.setStyle(ButtonStyle.Secondary),
						]),
				],
			}, 'update', interaction.message.id);
			return;
		}
	},
};

function sendOriginalMessage(
	userData: UserData<undefined, ''>,
): InteractionReplyOptions {

	return {
		embeds: [new EmbedBuilder()
			.setColor(error_color)
			.setTitle('Please select what you want to delete.')],
		components: [getOriginalComponents(userData)],
	};
}

function getOriginalComponents(
	userData: UserData<undefined, ''>,
): ActionRowBuilder<ButtonBuilder> {

	const allServers = getServersPage(0, userData);
	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents([new ButtonBuilder()
			.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['individual']))
			.setLabel('A quid')
			.setDisabled(getQuidsPage(0, userData).options.length <= 0)
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['server']))
			.setLabel('All information on one server')
			.setDisabled(allServers.options.length <= 0)
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['all']))
			.setLabel('Everything')
			.setStyle(ButtonStyle.Danger)]);
}

/**
 * Creates a select menu with the users accounts
 */
function getQuidsPage(
	deletePage: number,
	userData: UserData<undefined, ''>,
): StringSelectMenuBuilder {

	let accountsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = quids.map(quid => ({
		label: quid.name,
		value: constructSelectOptions<SelectOptionArgs>([quid._id]),
	}));

	if (accountsMenuOptions.length > 25) {

		accountsMenuOptions = accountsMenuOptions.splice(deletePage * 24, 24);
		accountsMenuOptions.push({
			label: 'Show more quids',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${deletePage}`]),
			description: `You are currently on page ${deletePage + 1}`,
			emoji: '📋',
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['individual', 'options']))
		.setPlaceholder('Select a quid')
		.setOptions(accountsMenuOptions);
}

/**
 * Creates a select menu with the servers that have accounts with this user
 */
function getServersPage(
	deletePage: number,
	userData: UserData<undefined, ''>,
): StringSelectMenuBuilder {

	let accountsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	const serverIdList = [...new Set([...quids.map(q => Object.keys(q.profiles)), ...Object.keys(userData.servers)].flat())];
	for (const serverId of serverIdList) {

		const server = (() => {
			try { return serverModel.findOne(s => s.serverId === serverId); }
			catch { return null; }
		})();
		if (server === null) { continue; }
		accountsMenuOptions.push({
			label: server.name,
			value: constructSelectOptions<SelectOptionArgs>([server.serverId]),
		});
	}

	if (accountsMenuOptions.length > 25) {

		accountsMenuOptions = accountsMenuOptions.splice(deletePage * 24, 24);
		accountsMenuOptions.push({
			label: 'Show more servers',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${deletePage}`]),
			description: `You are currently on page ${deletePage + 1}`,
			emoji: '📋',
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['server', 'options']))
		.setPlaceholder('Select a server')
		.setOptions(accountsMenuOptions);
}