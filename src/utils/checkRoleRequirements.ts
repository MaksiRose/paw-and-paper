import { CommandInteraction, GuildMember } from 'discord.js';
import { respond } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { ServerSchema } from '../typedef';
const { default_color, error_color } = require('../../config.json');

/**
 * Checks if user has reached the requirement to get a role based on their rank.
 */
export async function checkRankRequirements(serverData: ServerSchema, interaction: CommandInteraction, member: GuildMember, userRank: 'Youngling' | 'Apprentice' | 'Hunter' | 'Healer' | 'Elderly'): Promise<void> {

	/* If interaction is not in guild, return */
	if (!interaction.inGuild()) { return; }

	/* Defining a rankList and a shop of items with the wayOfEarning being rank.
	The reason why Elderly is also 2 is because as Elderly, it isn't clear if you were Hunter or Healer before. Therefore, having the higher rank Elderly shouldn't automatically grant you a Hunter or Healer role. */
	const rankList = { Youngling: 0, Apprentice: 1, Hunter: 2, Healer: 2, Eldery: 2 };
	const shop = serverData.shop.filter(item => item.wayOfEarning === 'rank');

	/* For each item in the shop, check if its requirement is equal to the userRank or higher in the rankList. If so, add that item to the users role database and the corresponding role to their roles. */
	for (const item of shop) {

		if (userRank === item.requirement || rankList[userRank] > rankList[item.requirement]) {

			try {

				/* Get the userData and the roles of the current character. */
				const userData = await userModel.findOne({ userId: member.id });
				const roles = userData.characters[userData.currentCharacter[interaction.guildId]].profiles[interaction.guildId].roles;

				/* It's checking if the role is in the database. If it's not, it will add it to the database. */
				if (!roles.some(r => r.roleId === item.roleId && r.wayOfEarning === item.wayOfEarning && r.requirement === item.requirement)) {

					await userModel.findOneAndUpdate(
						{ userId: member.id },
						(u) => {
							u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].roles.push({
								roleId: item.roleId,
								wayOfEarning: item.wayOfEarning,
								requirement: item.requirement,
							});
						},
					);
				}

				/* It's checking if the member has the role. If they don't, it will add it to their roles. */
				if (!member.roles.cache.has(item.roleId)) {

					await member.roles.add(item.roleId);

					await respond(interaction, {
						content: member.toString(),
						embeds: [{
							color: default_color,
							author: { name: interaction.guild?.name, icon_url: interaction.guild?.iconURL() || undefined },
							description: `You got the <@&${item.roleId}> role for being ${item.requirement}!`,
						}],
					}, false)
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
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
export async function checkLevelRequirements(serverData: ServerSchema, interaction: CommandInteraction, member: GuildMember, userLevel: number) {

	/* If interaction is not in guild, return */
	if (!interaction.inGuild()) { return; }

	/* Defining a shop of items with the wayOfEarning being levels. */
	const shop = serverData.shop.filter(item => item.wayOfEarning === 'levels');

	/* For each item in the shop, check if the userLevel is equal or higher than the item requirement. If so, add that item to the users role database and the corresponding role to their roles. */
	for (const item of shop) {

		if (userLevel >= item.requirement) {

			try {

				/* Get the userData and the roles of the current character. */
				const userData = await userModel.findOne({ userId: member.id });
				const roles = userData.characters[userData.currentCharacter[interaction.guildId]].profiles[interaction.guildId].roles;

				/* It's checking if the role is in the database. If it's not, it will add it to the database. */
				if (roles.some(r => r.roleId === item.roleId && r.wayOfEarning === item.wayOfEarning && r.requirement === item.requirement) === false) {

					await userModel.findOneAndUpdate(
						{ userId: member.id },
						(u) => {
							u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].roles.push({
								roleId: item.roleId,
								wayOfEarning: item.wayOfEarning,
								requirement: item.requirement,
							});
						},
					);
				}

				/* It's checking if the member has the role. If they don't, it will add it to their roles. */
				if (!member.roles.cache.has(item.roleId)) {

					await member.roles.add(item.roleId);

					await respond(interaction, {
						content: member.toString(),
						embeds: [{
							color: default_color,
							author: { name: interaction.guild?.name, icon_url: interaction.guild?.iconURL() || undefined },
							description: `You got the <@&${item.roleId}> role for being level ${item.requirement}!`,
						}],
					}, false)
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
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
export async function checkRoleCatchBlock(error: any, interaction: CommandInteraction, member: GuildMember): Promise<void> {

	/* If interaction is not in guild, return */
	if (!interaction.inGuild()) { return; }

	/* It's checking if the httpStatus is 403. If it is, then respond that the bot does not have permission to manage roles, or the role is above its highest role, else respond that there was an error trying to add/remove the role. */
	if (error.httpStatus === 403) {

		await respond(interaction, {
			content: member.toString(),
			embeds: [{
				color: /** @type {`#${string}`} */ (error_color),
				title: 'I don\'t have permission to manage roles, or the role is above my highest role. Please ask an admin to edit my permissions or move the wanted role below mine.',
			}],
		}, false)
			.catch((err) => {
				if (err.httpStatus !== 404) { throw new Error(err); }
			});
	}
	else {

		console.error(error);
		await respond(interaction, {
			content: member.toString(),
			embeds: [{
				color: /** @type {`#${string}`} */ (error_color),
				title: 'There was an error trying to add/remove the role :(',
			}],
		}, false)
			.catch((err) => {
				if (err.httpStatus !== 404) { throw new Error(err); }
			});
	}
}