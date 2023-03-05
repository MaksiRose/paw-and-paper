import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { saveCommandDisablingInfo, disableAllComponents } from '../../utils/componentDisabling';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import DiscordUserToServer from '../../models/discordUserToServer';
import { Op } from 'sequelize';
import DiscordUser from '../../models/discordUser';
import Group from '../../models/group';
import GroupToServer from '../../models/groupToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import UserToServer from '../../models/userToServer';
import User from '../../models/user';
import Webhook from '../../models/webhook';
import Friendship from '../../models/friendship';
import GroupToQuid from '../../models/groupToQuid';
import QuidToServerToShopRole from '../../models/quidToServerToShopRole';
import TemporaryStatIncrease from '../../models/temporaryStatIncrease';
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
	sendCommand: async (interaction, { user, userToServer }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* Checking if the user has an account. If they do not, it will send a message saying they haave no account. */
		if (!user) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('You have no account!')],
				ephemeral: true,
			});
			return;
		}


		const quids = await Quid.findAll({ where: { userId: user.id } });
		const quidsToServers = await QuidToServer.findAll({ where: { quidId: { [Op.in]: quids.map(q => q.id) } } });

		const usersToServers = (quidsToServers.length > 0)
			? undefined
			: await UserToServer.findAll({ where: { userId: user.id } });

		const discordUsers = (usersToServers && usersToServers.length > 0)
			? undefined
			: await DiscordUser.findAll({ where: { userId: user.id } });
		const discordUsersToServers = discordUsers ? await DiscordUserToServer.findAll({ where: { discordUserId: { [Op.in]: discordUsers.map(du => du.id) } } }) : undefined;

		const groups = (discordUsersToServers && discordUsersToServers.length > 0)
			? undefined
			: await Group.findAll({ where: { userId: user.id } });
		const groupsToServers = groups ? await GroupToServer.findAll({ where: { groupId: { [Op.in]: groups.map(g => g.id) } } }) : undefined;

		const hasQuids = quids.length > 0;
		const hasServerInfo = quidsToServers.length > 0 || (!!usersToServers && usersToServers.length > 0) || (!!discordUsersToServers && discordUsersToServers.length > 0) || (!!groupsToServers && groupsToServers.length > 0);


		// This is always a reply
		const { id: messageId } = await respond(interaction, { ...sendOriginalMessage(user, hasQuids, hasServerInfo), fetchReply: true });

		if (userToServer) { saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, messageId); }
		return;
	},
	async sendMessageComponentResponse(interaction, { user }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!customId) { throw new Error('customId is undefined'); }
		if (user === undefined) { throw new Error('userData is undefined'); }


		/* Creating a new message asking the user if they are sure that they want to delete all their data. */
		if (interaction.isButton() && customId.args[0] === 'all') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Are you sure you want to delete all your data? This will be **permanent**!!!')
					.setDescription('Are you unhappy with your experience, or have other concerns? Let us know using `/ticket` (an account is not needed).')],
				components: [
					...disableAllComponents([getOriginalComponents(user, false, false)]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['confirm', 'all']))
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['cancel']))
								.setLabel('Cancel')
								.setEmoji('✖')
								.setStyle(ButtonStyle.Secondary),
						]),
				],
			}, 'update', interaction.message.id);
			return;
		}


		const quids = await Quid.findAll({ where: { userId: user.id } });
		const quidsToServers = await QuidToServer.findAll({ where: { quidId: { [Op.in]: quids.map(q => q.id) } } });

		let usersToServers = (quidsToServers.length > 0)
			? undefined
			: await UserToServer.findAll({ where: { userId: user.id } });

		let discordUsers = (usersToServers && usersToServers.length > 0)
			? undefined
			: await DiscordUser.findAll({ where: { userId: user.id } });
		let discordUsersToServers = discordUsers ? await DiscordUserToServer.findAll({ where: { discordUserId: { [Op.in]: discordUsers.map(du => du.id) } } }) : undefined;

		let groups = (discordUsersToServers && discordUsersToServers.length > 0)
			? undefined
			: await Group.findAll({ where: { userId: user.id } });
		let groupsToServers = groups ? await GroupToServer.findAll({ where: { groupId: { [Op.in]: groups.map(g => g.id) } } }) : undefined;

		const hasQuids = quids.length > 0;
		const hasServerInfo = quidsToServers.length > 0 || (!!usersToServers && usersToServers.length > 0) || (!!discordUsersToServers && discordUsersToServers.length > 0) || (!!groupsToServers && groupsToServers.length > 0);


		/* Deleting the data of the user. */
		if (interaction.isButton() && customId.args[0] === 'confirm') {

			const type = customId.args[1];

			/* Deleting a quid from the database. */
			if (type === 'individual') {

				const quidId = customId.args[2];
				const quid = await Quid.findByPk(quidId, { rejectOnEmpty: true });

				await QuidToServer.destroy({ where: { quidId: quidId } });
				await Quid.destroy({ where: { id: quidId } });

				// This is always an update to the message with the button
				await respond(interaction, sendOriginalMessage(user, quids.length > 1, hasServerInfo), 'update', interaction.message.id);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle(`The quid \`${quid.name}\` was deleted permanently!`)],
				});
				return;
			}

			/* Deleting all information by a user on a server. */
			if (type === 'server') {

				const serverId = customId.args[2];
				const server = await interaction.client.guilds.fetch({ guild: serverId, withCounts: false }).catch(() => undefined);

				await QuidToServer.destroy({ where: { serverId: serverId, quidId: { [Op.in]: quids.map(q => q.id) } } });
				const newQuidsToServers = await QuidToServer.findAll({ where: { quidId: { [Op.in]: quids.map(q => q.id) } } });

				await UserToServer.destroy({ where: { serverId: serverId, userId: user.id } });
				usersToServers = await UserToServer.findAll({ where: { userId: user.id } });

				discordUsers = discordUsers ?? await DiscordUser.findAll({ where: { userId: user.id } });
				await DiscordUserToServer.destroy({ where: { serverId: serverId, discordUserId: { [Op.in]: discordUsers.map(du => du.id) } } });
				discordUsersToServers = await DiscordUserToServer.findAll({ where: { discordUserId: { [Op.in]: discordUsers.map(du => du.id) } } });

				groups = groups ?? await Group.findAll({ where: { userId: user.id } });
				await GroupToServer.destroy({ where: { groupId: { [Op.in]: groups.map(g => g.id) } } });
				groupsToServers = await GroupToServer.findAll({ where: { groupId: { [Op.in]: groups.map(g => g.id) } } });

				// This is always an update to the message with the button
				await respond(interaction, sendOriginalMessage(user, hasQuids, newQuidsToServers.length > 0 || usersToServers.length > 0 || discordUsersToServers.length > 0 || groupsToServers.length > 0), 'update', interaction.message.id);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle(`All the data associated with the server \`${server?.name ?? serverId}\` was deleted permanently!`)],
				});
				return;
			}

			/* Deleting all the data of the user. */
			if (type === 'all') {

				discordUsers = discordUsers ?? await DiscordUser.findAll({ where: { userId: user.id } });
				const discordUserIdIn = { [Op.in]: discordUsers.map(du => du.id) };
				await DiscordUserToServer.destroy({ where: { discordUserId: discordUserIdIn } });
				await DiscordUser.destroy({ where: { id: discordUserIdIn } });

				const quidIdIn = { [Op.in]: quids.map(q => q.id) };
				await Webhook.destroy({ where: { quidId: quidIdIn } });
				await Friendship.destroy({ where: { [Op.or]: [ { quidId_1: quidIdIn }, { quidId_2: quidIdIn }] } });
				await GroupToQuid.destroy({ where: { quidId: quidIdIn } });

				const quidToServerIdIn = { [Op.in]: quidsToServers.map(qts => qts.id) };
				await QuidToServerToShopRole.destroy({ where: { quidToServerId: quidToServerIdIn } });
				await TemporaryStatIncrease.destroy({ where: { quidToServerId: quidToServerIdIn } });
				await QuidToServer.destroy({ where: { id: quidToServerIdIn } });

				await Quid.destroy({ where: { id: quidIdIn } });

				groups = groups ?? await Group.findAll({ where: { userId: user.id } });
				const groupIdIn = { [Op.in]: groups.map(g => g.id) };
				await GroupToServer.destroy({ where: { groupId: groupIdIn } });
				await Group.destroy({ where: { id: groupIdIn } });

				await UserToServer.destroy({ where: { userId: user.id } });
				await user.destroy();

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

		/* Checking if the interaction is a select menu and if the quid ID of the value exists as a quid. If it does, it will edit the message to ask the user if they are sure they want to delete the quid. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'individual' && customId.args[1] === 'options') {

			const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
			if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

			const quidId = selectOptionId[0];
			const quid = await Quid.findByPk(quidId, { rejectOnEmpty: true });

			// This is always an update to the message with the select menu
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`Are you sure you want to delete the quid named "${quid.name}"? This will be **permanent**!!!`)],
				components: [
					...disableAllComponents([getOriginalComponents(user, hasQuids, hasServerInfo), new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(StringSelectMenuBuilder.from(interaction.component))]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['confirm', 'individual', quidId]))
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['cancel']))
								.setLabel('Cancel')
								.setEmoji('✖')
								.setStyle(ButtonStyle.Secondary),
						]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Editing the message to the original message. */
		if (interaction.isButton() && customId.args[0] === 'cancel') {

			// This is always an update to the message with the button
			await respond(interaction, sendOriginalMessage(user, hasQuids, hasServerInfo), 'update', interaction.message.id);
			return;
		}

		/* Creating a new page for the user to select an account to delete. */
		if (interaction.isButton() && customId.args[0] === 'individual') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please select a quid that you want to delete.')],
				components: [
					getOriginalComponents(user, hasQuids, hasServerInfo),
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents([getQuidsPage(0, user, quids)]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Creating a new page for the user to select their accounts on a server to delete. */
		if (interaction.isButton() && customId.args[0] === 'server') {

			usersToServers = usersToServers ?? await UserToServer.findAll({ where: { userId: user.id } });

			discordUsers = discordUsers ?? await DiscordUser.findAll({ where: { userId: user.id } });
			discordUsersToServers = discordUsersToServers ?? await DiscordUserToServer.findAll({ where: { discordUserId: { [Op.in]: discordUsers.map(du => du.id) } } });

			groups = groups ?? await Group.findAll({ where: { userId: user.id } });
			groupsToServers = groupsToServers ?? await GroupToServer.findAll({ where: { groupId: { [Op.in]: groups.map(g => g.id) } } });

			const serverIds = [...new Set([
				...discordUsersToServers.map(duts => duts.serverId),
				...groupsToServers.map(gts => gts.serverId),
				...quidsToServers.map(qts => qts.serverId),
				...usersToServers.map(uts => uts.serverId),
			])];

			const servers = await Promise.all(
				serverIds.map((serverId) => interaction.client.guilds.fetch({ guild: serverId, withCounts: false }).catch(() => ({ id: serverId }))),
			);

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please select a server that you want to delete all information off of.')],
				components: [
					getOriginalComponents(user, hasQuids, hasServerInfo),
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents([getServersPage(0, user, servers)]),
				],
			}, 'update', interaction.message.id);
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
					getOriginalComponents(user, hasQuids, hasServerInfo),
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents([getQuidsPage(deletePage, user, quids)]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Checking if the interaction is a select menu and if the value starts with delete_server_nextpage_. If it does, it increments the page number, and if the page number is greater than the number of pages, it sets the page number to 0. It will then edit the reply to have the new page of servers. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'server' && customId.args[1] === 'options' && selectOptionId[0] === 'nextpage') {

			const deletePage = Number(selectOptionId[1]) + 1;

			usersToServers = usersToServers ?? await UserToServer.findAll({ where: { userId: user.id } });

			discordUsers = discordUsers ?? await DiscordUser.findAll({ where: { userId: user.id } });
			discordUsersToServers = discordUsersToServers ?? await DiscordUserToServer.findAll({ where: { discordUserId: { [Op.in]: discordUsers.map(du => du.id) } } });

			groups = groups ?? await Group.findAll({ where: { userId: user.id } });
			groupsToServers = groupsToServers ?? await GroupToServer.findAll({ where: { groupId: { [Op.in]: groups.map(g => g.id) } } });

			const serverIds = [...new Set([
				...discordUsersToServers.map(duts => duts.serverId),
				...groupsToServers.map(gts => gts.serverId),
				...quidsToServers.map(qts => qts.serverId),
				...usersToServers.map(uts => uts.serverId),
			])];

			const servers = await Promise.all(
				serverIds.map((serverId) => interaction.client.guilds.fetch({ guild: serverId, withCounts: false }).catch(() => ({ id: serverId }))),
			);

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: [
					getOriginalComponents(user, hasQuids, hasServerInfo),
					new ActionRowBuilder<StringSelectMenuBuilder>()
						.setComponents([getServersPage(deletePage, user, servers)]),
				],
			}, 'update', interaction.message.id);
			return;
		}

		/* Checking if the interaction is a select menu and if the server ID is in the array of all servers. If it is, it will edit the message to ask the user if they are sure they want to delete all their information on the server. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'server' && customId.args[1] === 'options') {

			const serverId = selectOptionId[0];
			const server = await interaction.client.guilds.fetch({ guild: serverId, withCounts: false }).catch(() => undefined);

			// This is always an update to the message with the select menu
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`Are you sure you want to delete all the information associated with the server ${server?.name ?? serverId}? This will be **permanent**!!!`)],
				components: [
					...disableAllComponents([getOriginalComponents(user, hasQuids, hasServerInfo), new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(StringSelectMenuBuilder.from(interaction.component))]),
					new ActionRowBuilder<ButtonBuilder>()
						.setComponents([
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['confirm', 'server', serverId]))
								.setLabel('Confirm')
								.setEmoji('✔')
								.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
								.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['cancel']))
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
	user: User,
	hasQuids: boolean,
	hasServerInfo: boolean,
): InteractionReplyOptions {

	return {
		embeds: [new EmbedBuilder()
			.setColor(error_color)
			.setTitle('Please select what you want to delete.')],
		components: [getOriginalComponents(user, hasQuids, hasServerInfo)],
	};
}

function getOriginalComponents(
	user: User,
	hasQuids: boolean,
	hasServerInfo: boolean,
): ActionRowBuilder<ButtonBuilder> {

	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents([new ButtonBuilder()
			.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['individual']))
			.setLabel('A quid')
			.setDisabled(hasQuids)
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['server']))
			.setLabel('All information on one server')
			.setDisabled(hasServerInfo)
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['all']))
			.setLabel('Everything')
			.setStyle(ButtonStyle.Danger)]);
}

/**
 * Creates a select menu with the users accounts
 */
function getQuidsPage(
	page: number,
	user: User,
	quids: Quid[],
): StringSelectMenuBuilder {

	let accountsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = quids.map(quid => ({
		label: quid.name,
		value: constructSelectOptions<SelectOptionArgs>([quid.id]),
	}));

	if (accountsMenuOptions.length > 25) {

		const pageCount = Math.ceil(accountsMenuOptions.length / 24);
		page = page % pageCount;
		if (page < 0) { page += pageCount; }

		accountsMenuOptions = accountsMenuOptions.splice(page * 24, 24);
		accountsMenuOptions.push({
			label: 'Show more quids',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${page}`]),
			description: `You are currently on page ${page + 1}`,
			emoji: '📋',
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['individual', 'options']))
		.setPlaceholder('Select a quid')
		.setOptions(accountsMenuOptions);
}

/**
 * Creates a select menu with the servers that have accounts with this user
 */
function getServersPage(
	page: number,
	user: User,
	servers: ({name?: string, id: string})[],
): StringSelectMenuBuilder {

	let accountsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	for (const server of servers) {

		accountsMenuOptions.push({
			label: server?.name ?? server.id,
			value: constructSelectOptions<SelectOptionArgs>([server.id]),
		});
	}

	if (accountsMenuOptions.length > 25) {

		const pageCount = Math.ceil(accountsMenuOptions.length / 24);
		page = page % pageCount;
		if (page < 0) { page += pageCount; }

		accountsMenuOptions = accountsMenuOptions.splice(page * 24, 24);
		accountsMenuOptions.push({
			label: 'Show more servers',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${page}`]),
			description: `You are currently on page ${page + 1}`,
			emoji: '📋',
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['server', 'options']))
		.setPlaceholder('Select a server')
		.setOptions(accountsMenuOptions);
}