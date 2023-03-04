import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, AnySelectMenuInteraction, GuildMember } from 'discord.js';
import { capitalize, respond } from './helperFunctions';
import { checkLevelRequirements, checkRoleCatchBlock } from './checkRoleRequirements';
import { missingPermissions } from './permissionHandler';
import { WayOfEarningType } from '../typings/data/user';
import QuidToServer from '../models/quidToServer';
import Quid from '../models/quid';
import { pronounAndPlural } from './getQuidInfo';
import QuidToServerToShopRole from '../models/quidToServerToShopRole';
import ShopRole from '../models/shopRole';
import { Op } from 'sequelize';
import DiscordUser from '../models/discordUser';
import DiscordUserToServer from '../models/discordUserToServer';
const { default_color } = require('../../config.json');

/**
 * Checks if the user is eligable for a level up, and sends an embed and updated profileData if so.
 */
export async function checkLevelUp(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	quid: Quid,
	quidToServer: QuidToServer,
	members: GuildMember[],
): Promise<EmbedBuilder[]> {

	let embed: EmbedBuilder[] = [];

	/* It's checking if the user has enough experience to level up. If they do, it will level them up and then check if they leveled up again. */
	const requiredExperiencePoints = quidToServer.levels * 50;
	if (quidToServer.experience >= requiredExperiencePoints) {

		quidToServer = await quidToServer.update({ experience: quidToServer.experience - requiredExperiencePoints, levels: quidToServer.levels + 1 });

		embed = [new EmbedBuilder()
			.setColor(quid.color)
			.setTitle(`${quid.name} just leveled up! ${capitalize(pronounAndPlural(quid, 0, 'is', 'are'))} now level ${quidToServer.levels}.`)];

		const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);
		if (levelUpEmbed.length > 0) { embed = levelUpEmbed; }

		await checkLevelRequirements(interaction, members, quidToServer, true);
	}

	return embed;
}

/**
 * Decreases the users level based on their current levels and removes their inventory, returns footerText for an updated bot reply.
 */
export async function decreaseLevel(
	quidToServer: QuidToServer,
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'> | AnySelectMenuInteraction<'cached' | 'raw'>,
): Promise<string> {

	/* newUserLevel is nine tenths of current profile level. */
	const newUserLevel = Math.round(quidToServer.levels - (quidToServer.levels / 10));

	/* footerText displays how many levels are lost, if any, and how much experience is lost, if any. */
	let footerText = '';
	if (newUserLevel !== quidToServer.levels) { footerText += `-${quidToServer.levels - newUserLevel} level${(quidToServer.levels - newUserLevel > 1) ? 's' : ''}\n`; }
	if (quidToServer.experience > 0) { footerText += `-${quidToServer.experience} XP`; }

	const countObj: {[key: string]: number} = quidToServer.inventory.reduce((acc, curr) => {
		if (!acc[curr]) { acc[curr] = 1; }
		else { acc[curr]++; }
		return acc;
	}, {} as Record<string, number>);

	for (const key of Object.keys(countObj)) {
		footerText += `\n-${countObj[key]} ${key}`;
	}

	quidToServer = await quidToServer.update({ levels: newUserLevel, experience: 0, inventory: [] });

	/* Get the guild, member, and the profileData roles where the wayOfEarning is levels and the role requirement bigger than the profile level. */
	const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId);

	const quid = await Quid.findByPk(quidToServer.quidId, { rejectOnEmpty: true });
	const discordUsers = await DiscordUser.findAll({ where: { userId: quid.userId } });
	const discordUserToServer = await DiscordUserToServer.findAll({
		where: {
			serverId: interaction.guildId,
			isMember: true,
			discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
		},
	});

	const members = (await Promise.all(discordUserToServer
		.map(async (duts) => (await guild.members.fetch(duts.discordUserId).catch(() => {
			duts.update({ isMember: false });
			return null;
		}))))).filter(function(v): v is GuildMember { return v !== null; });

	const roleConnections = await QuidToServerToShopRole.findAll({ where: { quidToServerId: quidToServer.id } });
	const roles = await ShopRole.findAll({
		where: {
			id: { [Op.in]: roleConnections.map(rc => rc.shopRoleId) },
			wayOfEarning: WayOfEarningType.Levels,
			requirement: { [Op.gt]: newUserLevel },
		},
	});
	const filteredRoleConnections = roleConnections.filter((rc) => roles.some((role) => role.id === rc.shopRoleId));

	// quidToServer.roles.filter(role => role.wayOfEarning === WayOfEarningType.Levels && role.requirement > quidToServer.levels);

	/* It's checking if the user has any roles that are earned by leveling up, and if they do, it will remove them from the user's profileData.roles and remove the role from the user. */
	for (const roleConnection of filteredRoleConnections) {
		for (const member of members) {
			try {

				/* It's checking if the user has the role, and if they do, it will remove it and send a message to the user. */
				if (member.roles.cache.has(roleConnection.shopRoleId)) {

					if (await missingPermissions(interaction, [
						'ManageRoles', // Needed to give out roles configured in this shop
					]) === true) { continue; }
					await member.roles.remove(roleConnection.shopRoleId);

					// This is a followUp
					await respond(interaction, {
						content: member.toString(),
						embeds: [new EmbedBuilder()
							.setColor(default_color)
							.setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
							.setDescription(`You lost the <@&${roleConnection.shopRoleId}> role because of a lack of levels!`)],
					});
				}
			}
			catch (error) {

				await checkRoleCatchBlock(error, interaction, member);
			}
		}

		/* It's removing the role connection. */
		await roleConnection.destroy();
	}

	return footerText;
}