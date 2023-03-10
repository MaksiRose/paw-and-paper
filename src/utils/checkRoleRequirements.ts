import { generateId } from 'crystalid';
import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, GuildMember, AnySelectMenuInteraction, Collection, Guild } from 'discord.js';
import { Op } from 'sequelize';
import DiscordUser from '../models/discordUser';
import DiscordUserToServer from '../models/discordUserToServer';
import QuidToServer from '../models/quidToServer';
import QuidToServerToShopRole from '../models/quidToServerToShopRole';
import ShopRole from '../models/shopRole';
import { RankType, WayOfEarningType } from '../typings/data/user';
import { respond, sendErrorMessage } from './helperFunctions';
import { missingPermissions } from './permissionHandler';
const { default_color, error_color } = require('../../config.json');

/**
 * Checks if user has reached the requirement to get a role based on their rank.
 */
export async function checkRankRequirements(
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'>,
	members: GuildMember[],
	quidToServer: QuidToServer,
	sendMessage = false,
	shopRoles?: ShopRole[],
): Promise<void> {

	/* Defining a rankList and a shop of items with the wayOfEarning being rank.
	The reason why Elderly is also 2 is because as Elderly, it isn't clear if you were Hunter or Healer before. Therefore, having the higher rank Elderly shouldn't automatically grant you a Hunter or Healer role. */
	const rankList = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Elderly: 2 };
	shopRoles = shopRoles ?? await ShopRole.findAll({ where: { serverId: interaction.guildId, wayOfEarning: WayOfEarningType.Rank } });

	/* For each item in the shop, check if its requirement is equal to the userRank or higher in the rankList. If so, add that item to the users role database and the corresponding role to their roles. */
	for (const role of shopRoles) {

		if (quidToServer.rank === role.requirement || rankList[quidToServer.rank] > rankList[role.requirement as RankType]) {

			/* Get the userData and the roles of the current quid. */
			const roles = await QuidToServerToShopRole.findAll({ where: { quidToServerId: quidToServer.id } });

			for (const member of members) {
				try {

					/* It's checking if the role is in the database. If it's not, it will add it to the database. */
					if (roles.some(r => r.shopRoleId === role.id) === false) {

						await QuidToServerToShopRole.create({ id: generateId(), shopRoleId: role.id, quidToServerId: quidToServer.id });
					}

					/* It's checking if the member has the role. If they don't, it will add it to their roles. */
					if (!member.roles.cache.has(role.id)) {

						if (await missingPermissions(interaction, [
							'ManageRoles', // Needed to give out roles configured in this shop
						]) === true) { continue; }
						await member.roles.add(role.id);

						if (sendMessage) {

							// This is always a followUp
							await respond(interaction, {
								content: member.toString(),
								embeds: [new EmbedBuilder()
									.setColor(default_color)
									.setAuthor(interaction.guild ? { name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined } : null)
									.setDescription(`You got the <@&${role.id}> role for being ${role.requirement}!`)],
							});
						}
					}
				}
				catch (error) {

					await checkRoleCatchBlock(error, interaction, member);
				}
			}
		}
	}

	return;
}

/**
 * Checks if user has reached the requirement to get a role based on their level.
 */
export async function checkLevelRequirements(
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'> | AnySelectMenuInteraction<'cached' | 'raw'>,
	members: GuildMember[],
	quidToServer: QuidToServer,
	sendMessage = false,
	shopRoles?: ShopRole[],
): Promise<void> {

	/* Defining a shop of items with the wayOfEarning being levels. */
	shopRoles = shopRoles ?? await ShopRole.findAll({ where: { serverId: interaction.guildId, wayOfEarning: WayOfEarningType.Levels } });

	/* For each item in the shop, check if the userLevel is equal or higher than the item requirement. If so, add that item to the users role database and the corresponding role to their roles. */
	for (const role of shopRoles) {

		if (quidToServer.levels >= Number(role.requirement)) {

			/* Get the userData and the roles of the current quid. */
			const roles = await QuidToServerToShopRole.findAll({ where: { quidToServerId: quidToServer.id } });

			for (const member of members) {
				try {

					/* It's checking if the role is in the database. If it's not, it will add it to the database. */
					if (roles.some(r => r.shopRoleId === role.id) === false) {

						await QuidToServerToShopRole.create({ id: generateId(), shopRoleId: role.id, quidToServerId: quidToServer.id });
					}

					/* It's checking if the member has the role. If they don't, it will add it to their roles. */
					if (!member.roles.cache.has(role.id)) {

						if (await missingPermissions(interaction, [
							'ManageRoles', // Needed to give out roles configured in this shop
						]) === true) { continue; }
						await member.roles.add(role.id);

						if (sendMessage) {

							// This is always a followUp
							await respond(interaction, {
								content: member.toString(),
								embeds: [new EmbedBuilder()
									.setColor(default_color)
									.setAuthor(interaction.guild ? { name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined } : null)
									.setDescription(`You got the <@&${role.id}> role for being level ${role.requirement}!`)],
							});
						}
					}
				}
				catch (error) {

					await checkRoleCatchBlock(error, interaction, member);
				}
			}
		}
	}
}

/**
 * Check if the bot has permission to add the role. If not, then send a message explaining the problem, else send a generic error message.
 */
export async function checkRoleCatchBlock(
	error: any,
	interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
	member: GuildMember,
): Promise<void> {

	/* If interaction is not in guild, return */
	if (!interaction.inGuild()) { return; }

	/* It's checking if the httpStatus is 403. If it is, then respond that the bot does not have permission to manage roles, or the role is above its highest role, else respond that there was an error trying to add/remove the role. */
	if (error.httpStatus === 403) {

		// This is always a followUp
		await respond(interaction, {
			content: member.toString(),
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setTitle('I don\'t have permission to manage roles, or the role is above my highest role. Please ask an admin to edit my permissions or move the wanted role below mine.')],
		});
	}
	else {

		await sendErrorMessage(interaction, error)
			.catch(e => { console.error(e); });
	}
}

export async function updateAndGetMembers(
	userId: string,
	guild: Guild,
): Promise<GuildMember[]> {

	const discordUsers = await DiscordUser.findAll({ where: { userId: userId } });

	const discordUsersToServer = (await DiscordUserToServer.findAll({
		where: {
			serverId: guild.id,
			discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
		},
	}));

	const sortedDiscordUsersToServer = new Collection(discordUsers.map(du => [du.id, discordUsersToServer.find(duts => duts.discordUserId === du.id)]));
	const members: GuildMember[] = [];

	for (let [discordUserId, discordUserToServer] of sortedDiscordUsersToServer) {

		if (discordUserToServer && discordUserToServer.isMember) {

			await guild.members
				.fetch(discordUserId)
				.then(member => members.push(member))
				.catch(() => { discordUserToServer!.update({ isMember: false, lastUpdatedTimestamp: Date.now() }); });
		}
		/* If there is no discordUserToServer entry or if the entry was last updated more than a month ago */
		else if (!discordUserToServer || discordUserToServer.lastUpdatedTimestamp < Date.now() - 2_629_746_000) {

			const member = await guild.members.fetch(discordUserId).catch(() => { return null; });
			if (member) { members.push(member); }

			if (!discordUserToServer) {

				discordUserToServer = await DiscordUserToServer.create({
					id: generateId(),
					discordUserId: discordUserId,
					serverId: guild.id,
					isMember: member !== null,
					lastUpdatedTimestamp: Date.now(),
				});
			}
			else if (discordUserToServer) { await discordUserToServer.update({ isMember: member !== null, lastUpdatedTimestamp: Date.now() }); }
		}
	}

	return members;
}