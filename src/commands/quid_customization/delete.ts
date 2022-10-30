import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder } from 'discord.js';
import { respond, update } from '../../utils/helperFunctions';
import serverModel from '../../models/serverModel';
import { saveCommandDisablingInfo, disableAllComponents } from '../../utils/componentDisabling';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { UserData } from '../../typings/data/user';
import userModel from '../../models/userModel';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
const { error_color } = require('../../../config.json');

type CustomIdArgs = ['individual' | 'server' | 'all' | 'cancel'] | ['individual' | 'server', 'options'] | ['confirm', 'individual' | 'server', string] | ['confirm', 'all']
type SelectOptionArgs = ['nextpage', `${number}`] | [string]

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('delete')
		.setDescription('Delete parts of or your entire account.')
		.toJSON(),
	category: 'page1',
	position: 10,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* Checking if the user has an account. If they do not, it will send a message saying they haave no account. */
		if (!userData) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('You have no account!')],
				ephemeral: true,
			}, false);
			return;
		}

		const botReply = await respond(interaction, await sendOriginalMessage(userData), true);

		saveCommandDisablingInfo(userData, interaction.guildId || 'DMs', interaction.channelId, botReply.id);
		return;
	},
	async sendMessageComponentResponse(interaction, userData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!customId) { throw new Error('customId is undefined'); }
		if (userData === null) { throw new Error('userData is null'); }

		/* Creating a new page for the user to select an account to delete. */
		if (interaction.isButton() && customId.args[0] === 'individual') {

			await update(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please select a quid that you want to delete.')],
				components: [
					await getOriginalComponents(userData),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([getQuidsPage(0, userData)]),
				],
			});
			return;
		}

		/* Creating a new page for the user to select their accounts on a server to delete. */
		if (interaction.isButton() && customId.args[0] === 'server') {

			await update(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please select a server that you want to delete all information off of.')],
				components: [
					await getOriginalComponents(userData),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([await getServersPage(0, userData)]),
				],
			});
			return;
		}

		/* Creating a new message asking the user if they are sure that they want to delete all their data. */
		if (interaction.isButton() && customId.args[0] === 'all') {

			await update(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Are you sure you want to delete all your data? This will be **permanent**!!!')
					.setDescription('Are you unhappy with your experience, or have other concerns? Let us know using `/ticket` (an account is not needed).')],
				components: [
					...disableAllComponents([await getOriginalComponents(userData)]),
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
			});
			return;
		}

		/* Deleting the data of the user. */
		if (interaction.isButton() && customId.args[0] === 'confirm') {

			const type = customId.args[1];

			/* Deleting a user from the database. */
			if (type === 'individual') {

				const quidId = customId.args[2];
				const quid = userData.quids.get(quidId);

				await userData.update(
					(u) => {
						delete u.quids[quidId];
						for (const serverId of Object.keys(u.currentQuid)) {
							if (u.currentQuid[serverId] === quidId) { delete u.currentQuid[serverId]; }
						}
						for (const serverInfo of Object.values(u.servers)) {
							if (serverInfo.currentQuid) { serverInfo.currentQuid = null; }
						}
					},
				);

				await update(interaction, await sendOriginalMessage(userData));

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle(`The quid \`${quid?.name}\` was deleted permanently!`)],
				}, false);
			}

			/* Deleting all accounts by a user on a server. */
			if (type === 'server') {

				const serverId = customId.args[2];
				const accountsOnServer = userData.quids.map(q => q.profiles[serverId]).filter(p => p !== undefined);

				await userData.update(
					(u) => {
						for (const userId of Object.values(u.userIds)) {
							if (userId[serverId] !== undefined) { delete userId[serverId]; }
						}
						for (const q of Object.values(u.quids)) {
							if (q.profiles[serverId] !== undefined) { delete q.profiles[serverId]; }
						}
						delete u.currentQuid[serverId];
						delete u.servers[serverId];
					},
				);

				const server = await serverModel.findOne(s => s.serverId === serverId);

				await update(interaction, await sendOriginalMessage(userData));

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle(`All the data of ${accountsOnServer.length} quids on the server \`${server.name}\` was deleted permanently!`)],
				}, false);
			}

			/* Deleting all the data of the user. */
			if (type === 'all') {

				await userModel.findOneAndDelete(u => u._id === userData?._id);

				await update(interaction, {
					components: disableAllComponents(interaction.message.components),
				});

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('All your data was deleted permanently!')],
				}, false);
				return;
			}
			return;
		}

		/* Editing the message to the original message. */
		if (interaction.isButton() && customId.args[0] === 'cancel') {

			await update(interaction, await sendOriginalMessage(userData));
			return;
		}

		if (interaction.isButton()) { return; }
		const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction);

		/* Checking if the interaction is a select menu and if the value starts with delete_individual_nextpage_. If it is, it increments the page number, and if the page number is greater than the number of pages, it sets the page number to 0. It will then edit the reply to have the new page of quids. */
		if (interaction.isSelectMenu() && customId.args[0] === 'individual' && customId.args[1] === 'options' && selectOptionId[0] === 'nextpage') {

			let deletePage = Number(selectOptionId[1]) + 1;
			if (deletePage >= Math.ceil(Object.keys(userData.quids).length / 24)) { deletePage = 0; }

			await update(interaction, {
				components: [
					await getOriginalComponents(userData),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([getQuidsPage(deletePage, userData)]),
				],
			});
			return;
		}

		/* Checking if the interaction is a select menu and if the quid ID of the value exists as a quid. If it does, it will edit the message to ask the user if they are sure they want to delete the quid. */
		if (interaction.isSelectMenu() && customId.args[0] === 'individual' && customId.args[1] === 'options') {

			const quidId = selectOptionId[0];
			const quid = userData.quids.get(quidId);

			await update(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`Are you sure you want to delete the quid named "${quid?.name}"? This will be **permanent**!!!`)],
				components: [
					...disableAllComponents([await getOriginalComponents(userData), new ActionRowBuilder<SelectMenuBuilder>().setComponents(SelectMenuBuilder.from(interaction.component))]),
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
			});
			return;
		}

		/* Checking if the interaction is a select menu and if the value starts with delete_server_nextpage_. If it does, it increments the page number, and if the page number is greater than the number of pages, it sets the page number to 0. It will then edit the reply to have the new page of servers. */
		if (interaction.isSelectMenu() && customId.args[0] === 'server' && customId.args[1] === 'options' && selectOptionId[0] === 'nextpage') {

			let deletePage = Number(selectOptionId[1]) + 1;
			if (deletePage >= Math.ceil([...new Set(userData.quids.map(q => Object.keys(q.profiles)).flat())].length / 24)) { deletePage = 0; }

			await update(interaction, {
				components: [
					await getOriginalComponents(userData),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([await getServersPage(deletePage, userData)]),
				],
			});
			return;
		}

		/* Checking if the interaction is a select menu and if the server ID is in the array of all servers. If it is, it will edit the message to ask the user if they are sure they want to delete all their information on the server. */
		if (interaction.isSelectMenu() && customId.args[0] === 'server' && customId.args[1] === 'options') {

			const serverId = selectOptionId[0];
			const accountsOnServer = userData.quids.map(q => q.profiles[serverId]).filter(p => p !== undefined);
			const server = await serverModel.findOne(s => s.serverId === selectOptionId[0]).catch(() => null);

			await update(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`Are you sure you want to delete all the information of ${accountsOnServer.length} quids on the server ${server?.name}? This will be **permanent**!!!`)],
				components: [
					...disableAllComponents([await getOriginalComponents(userData), new ActionRowBuilder<SelectMenuBuilder>().setComponents(SelectMenuBuilder.from(interaction.component))]),
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
			});
			return;
		}
	},
};

async function sendOriginalMessage(
	userData: UserData<undefined, ''>,
): Promise<InteractionReplyOptions> {

	return {
		embeds: [new EmbedBuilder()
			.setColor(error_color)
			.setTitle('Please select what you want to delete.')],
		components: [await getOriginalComponents(userData)],
	};
}

async function getOriginalComponents(
	userData: UserData<undefined, ''>,
): Promise<ActionRowBuilder<ButtonBuilder>> {

	const allServers = await getServersPage(0, userData);
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
): SelectMenuBuilder {

	let accountsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = userData.quids.map(quid => ({
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

	return new SelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['individual', 'options']))
		.setPlaceholder('Select a quid')
		.setOptions(accountsMenuOptions);
}

/**
 * Creates a select menu with the servers that have accounts with this user
 */
async function getServersPage(
	deletePage: number,
	userData: UserData<undefined, ''>,
): Promise<SelectMenuBuilder> {

	let accountsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	const serverIdList = [...new Set([...userData.quids.map(q => Object.keys(q.profiles)), ...Object.keys(userData.servers)].flat())];
	for (const serverId of serverIdList) {

		const server = await serverModel.findOne(s => s.serverId === serverId).catch(() => null);
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

	return new SelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['server', 'options']))
		.setPlaceholder('Select a server')
		.setOptions(accountsMenuOptions);
}