import { PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { addCommasAndAnd, respond } from '../../utils/helperFunctions';
import { client } from '../..';
import { SlashCommand } from '../../typings/handle';
import BannedUser from '../../models/bannedUser';
import DiscordUser from '../../models/discordUser';
import UserModel from '../../models/user';
import DiscordUserToServer from '../../models/discordUserToServer';
import Quid from '../../models/quid';
import Webhook from '../../models/webhook';
import Friendship from '../../models/friendship';
import { Op } from 'sequelize';
import QuidToServer from '../../models/quidToServer';
import QuidToServerToShopRole from '../../models/quidToServerToShopRole';
import TemporaryStatIncrease from '../../models/temporaryStatIncrease';
import GroupToQuid from '../../models/groupToQuid';
import Group from '../../models/group';
import GroupToServer from '../../models/groupToServer';
import UserToServer from '../../models/userToServer';
import Server from '../../models/server';
import Den from '../../models/den';
import ProxyLimits from '../../models/proxyLimits';
import ShopRole from '../../models/shopRole';
import BannedServer from '../../models/bannedServer';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('ban')
		.setDescription('Ban a user or server from using the bot')
		.addStringOption(option =>
			option.setName('type')
				.setDescription('Whether you want to ban a user or server')
				.setChoices(
					{ name: 'user', value: 'user' },
					{ name: 'server', value: 'server' },
				)
				.setRequired(true))
		.addStringOption(option =>
			option.setName('id')
				.setDescription('The ID of what you want to ban')
				.setRequired(true))
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		if (!client.isReady()) { throw new Error('client isn\'t ready'); }

		await client.application.fetch();
		if ((client.application.owner instanceof User) ? interaction.user.id !== client.application.owner.id : client.application.owner ? !client.application.owner.members.has(interaction.user.id) : false) { throw new Error('403: user is not bot owner'); }

		const notified: string[] = [];
		const type = interaction.options.getString('type');
		const id = interaction.options.getString('id');
		if (type === null || id === null) { throw new TypeError('type or id is null'); }

		if (type === 'user') {

			const userData = (await DiscordUser.findByPk(id, { include: [{ model: UserModel, as: 'user' }] }))?.user;
			const discordUserIds = userData === undefined ? [id] : (await DiscordUser.findAll({ where: { userId: userData.id } })).map(du => du.id);

			for (const discordUserId of discordUserIds) {

				await BannedUser.create({ id: discordUserId }, { ignoreDuplicates: true });
				await DiscordUserToServer.destroy({ where: { discordUserId: discordUserId } });
				await DiscordUser.destroy({ where: { id: discordUserId } });

				if (userData !== undefined) {

					const user = await client.users.fetch(discordUserId).catch(() => { return null; });
					if (user) {

						await user.send({ content: 'I am sorry to inform you that you have been banned from using this bot.' });
						notified.push(user.tag);
					}
				}
			}

			if (userData !== undefined) {

				const quids = await Quid.findAll({ where: { userId: userData.id } });
				for (const quid of quids) {

					await Webhook.destroy({ where: { quidId: quid.id } });
					await Friendship.destroy({ where: { [Op.or]: [{ quidId1: quid.id }, { quidId2: quid.id }] } });
					await GroupToQuid.destroy({ where: { quidId: quid.id } });
					const quidToServers = await QuidToServer.findAll({ where: { quidId: quid.id } });
					for (const quidToServer of quidToServers) {
						await QuidToServerToShopRole.destroy({ where: { quidToServerId: quidToServer.id } });
						await TemporaryStatIncrease.destroy({ where: { quidToServerId: quidToServer.id } });
						await quidToServer.destroy();
					}
					await quid.destroy();
				}

				const groups = await Group.findAll({ where: { userId: userData.id } });
				for (const group of groups) {

					await GroupToServer.destroy({ where: { groupId: group.id } });
					await group.destroy();
				}

				await UserToServer.destroy({ where: { userId: userData.id } });
				await userData.destroy();
			}

			// This is always a reply
			await respond(interaction, {
				content: notified.length > 0 ? `Banned user(s) ${addCommasAndAnd(notified)}, deleted their account and was able to notify them about it.` : userData !== undefined ? `Banned user(s) ${addCommasAndAnd(discordUserIds)} and deleted their account but was not able to notify them about it.` : `Banned user ${notified[0] ?? id} but couldn't find an account associated with them.`,
			});
		}

		if (type === 'server') {

			await BannedServer.create({ id: id }, { ignoreDuplicates: true });
			const serverData = await Server.findByPk(id);

			if (serverData) {

				await Den.destroy({ where: { [Op.or]: [{ id: serverData.foodDenId }, { id: serverData.medicineDenId }, { id: serverData.sleepingDenId }] } });
				await ProxyLimits.destroy({ where: { [Op.or]: [{ id: serverData.proxy_roleLimitsId }, { id: serverData.proxy_channelLimitsId }] } });
				await UserToServer.destroy({ where: { serverId: id } });
				await GroupToServer.destroy({ where: { serverId: id } });
				await DiscordUserToServer.destroy({ where: { serverId: id } });
				const quidToServers = await QuidToServer.findAll({ where: { serverId: id } });
				for (const quidToServer of quidToServers) {
					await QuidToServerToShopRole.destroy({ where: { quidToServerId: quidToServer.id } });
					await quidToServer.destroy();
				}
				await ShopRole.destroy({ where: { serverId: id } });
				await serverData.destroy();


				const guild = await interaction.client.guilds.fetch(id).catch(() => { return null; });
				const user = await client.users.fetch(guild?.ownerId || '').catch(() => { return null; });

				if (guild && user) {

					await user.createDM();
					await user.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` });

					// This is always a reply
					await respond(interaction, {
						content: `Banned server ${guild.name}, deleted their account and was able to notify the guild owner about it.`,
					});
					return;
				}

				// This is always a reply
				await respond(interaction, {
					content: `Banned server ${id}, deleted their account but was not able to notify the guild owner about it.`,
				});
				return;
			}

			// This is always a reply
			await respond(interaction, {
				content: `Banned server ${id} but couldn't find an account associated with them.`,
			});
			return;
		}
	},
};