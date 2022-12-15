import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, GuildMember, AnySelectMenuInteraction } from 'discord.js';
import { userModel, getUserData } from '../models/userModel';
import { ServerSchema } from '../typings/data/server';
import { RankType, WayOfEarningType } from '../typings/data/user';
import { respond, sendErrorMessage } from './helperFunctions';
import { getMapData } from './helperFunctions';
import { missingPermissions } from './permissionHandler';
const { default_color, error_color } = require('../../config.json');

/**
 * Checks if user has reached the requirement to get a role based on their rank.
 */
export async function checkRankRequirements(
	serverData: ServerSchema,
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	member: GuildMember | undefined,
	userRank: RankType,
	sendMessage = false,
): Promise<void> {

	/* If interaction is not in guild or member undefined, return */
	if (!interaction.inGuild() || !member) { return; }

	/* Defining a rankList and a shop of items with the wayOfEarning being rank.
	The reason why Elderly is also 2 is because as Elderly, it isn't clear if you were Hunter or Healer before. Therefore, having the higher rank Elderly shouldn't automatically grant you a Hunter or Healer role. */
	const rankList = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Elderly: 2 };
	const shop = serverData.shop.filter(item => item.wayOfEarning === WayOfEarningType.Rank);

	/* For each item in the shop, check if its requirement is equal to the userRank or higher in the rankList. If so, add that item to the users role database and the corresponding role to their roles. */
	for (const item of shop) {

		if (userRank === item.requirement || rankList[userRank] > rankList[item.requirement as RankType]) {

			try {

				/* Get the userData and the roles of the current quid. */
				const _userData = await userModel.findOne(u => Object.keys(u.userIds).includes(member.id));
				const userData = getUserData(_userData, interaction.guildId, _userData.quids[_userData.servers[member.guild.id]?.currentQuid ?? '']);
				const roles = userData.quid?.profile?.roles;

				/* It's checking if the role is in the database. If it's not, it will add it to the database. */
				if (roles && !roles.some(r => r.roleId === item.roleId && r.wayOfEarning === item.wayOfEarning && r.requirement === item.requirement)) {

					await userData.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
							p.roles.push({
								roleId: item.roleId,
								wayOfEarning: item.wayOfEarning,
								requirement: item.requirement,
							});
						},
					);
				}

				/* It's checking if the member has the role. If they don't, it will add it to their roles. */
				if (!member.roles.cache.has(item.roleId)) {

					if (await missingPermissions(interaction, [
						'ManageRoles', // Needed to give out roles configured in this shop
					]) === true) { continue; }
					await member.roles.add(item.roleId);

					if (sendMessage) {

						// This is always a followUp
						await respond(interaction, {
							content: member.toString(),
							embeds: [new EmbedBuilder()
								.setColor(default_color)
								.setAuthor(interaction.guild ? { name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined } : null)
								.setDescription(`You got the <@&${item.roleId}> role for being ${item.requirement}!`)],
						});
					}
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, interaction, member);
			}
		}
	}

	return;
}

/**
 * Checks if user has reached the requirement to get a role based on their level.
 */
export async function checkLevelRequirements(
	serverData: ServerSchema,
	interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
	member: GuildMember | undefined,
	userLevel: number,
	sendMessage = false,
): Promise<void> {

	/* If interaction is not in guild or member undefined, return */
	if (!interaction.inGuild() || !member) { return; }

	/* Defining a shop of items with the wayOfEarning being levels. */
	const shop = serverData.shop.filter(item => item.wayOfEarning === WayOfEarningType.Levels);

	/* For each item in the shop, check if the userLevel is equal or higher than the item requirement. If so, add that item to the users role database and the corresponding role to their roles. */
	for (const item of shop) {

		if (userLevel >= item.requirement) {

			try {

				/* Get the userData and the roles of the current quid. */
				const _userData = await userModel.findOne(u => Object.keys(u.userIds).includes(member.id));
				const userData = getUserData(_userData, interaction.guildId, _userData.quids[_userData.servers[member.guild.id]?.currentQuid ?? '']);
				const roles = userData.quid?.profile?.roles;

				/* It's checking if the role is in the database. If it's not, it will add it to the database. */
				if (roles && roles.some(r => r.roleId === item.roleId && r.wayOfEarning === item.wayOfEarning && r.requirement === item.requirement) === false) {

					await userData.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
							p.roles.push({
								roleId: item.roleId,
								wayOfEarning: item.wayOfEarning,
								requirement: item.requirement,
							});
						},
					);
				}

				/* It's checking if the member has the role. If they don't, it will add it to their roles. */
				if (!member.roles.cache.has(item.roleId)) {

					if (await missingPermissions(interaction, [
						'ManageRoles', // Needed to give out roles configured in this shop
					]) === true) { continue; }
					await member.roles.add(item.roleId);

					if (sendMessage) {

						// This is always a followUp
						await respond(interaction, {
							content: member.toString(),
							embeds: [new EmbedBuilder()
								.setColor(default_color)
								.setAuthor(interaction.guild ? { name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined } : null)
								.setDescription(`You got the <@&${item.roleId}> role for being level ${item.requirement}!`)],
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