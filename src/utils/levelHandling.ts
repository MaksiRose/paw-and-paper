import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, AnySelectMenuInteraction, GuildMember } from 'discord.js';
import { capitalize, respond, unsafeKeys, widenValues } from './helperFunctions';
import { checkLevelRequirements, checkRoleCatchBlock } from './checkRoleRequirements';
import { getMapData } from './helperFunctions';
import { missingPermissions } from './permissionHandler';
import { WayOfEarningType } from '../typings/data/user';
import QuidToServer from '../models/quidToServer';
import Quid from '../models/quid';
import { pronounAndPlural } from './getQuidInfo';
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
	userData: UserData<never, never>,
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'> | AnySelectMenuInteraction<'cached' | 'raw'>,
): Promise<string> {

	/* newUserLevel is nine tenths of current profile level. */
	const newUserLevel = Math.round(userData.quid.profile.levels - (userData.quid.profile.levels / 10));

	/* footerText displays how many levels are lost, if any, and how much experience is lost, if any. */
	let footerText = '';
	if (newUserLevel !== userData.quid.profile.levels) { footerText += `-${userData.quid.profile.levels - newUserLevel} level${(userData.quid.profile.levels - newUserLevel > 1) ? 's' : ''}\n`; }
	if (userData.quid.profile.experience > 0) { footerText += `-${userData.quid.profile.experience} XP`; }

	const inventory_ = widenValues(userData.quid.profile.inventory);
	/* Updating the footerText and the database for any items the user had. */
	for (const itemType of unsafeKeys(inventory_)) {

		for (const item of unsafeKeys(inventory_[itemType])) {

			if (inventory_[itemType][item] > 0) { footerText += `\n-${inventory_[itemType][item]} ${item}`; }
			inventory_[itemType][item] = 0;
		}
	}

	await userData.update(
		(u) => {
			const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
			p.levels = newUserLevel;
			p.experience = 0;
			p.inventory = inventory_;
		},
	);


	/* Get the guild, member, and the profileData roles where the wayOfEarning is levels and the role requirement bigger than the profile level. */
	const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId);
	const member = await guild.members.fetch(interaction.user.id);
	const roles = userData.quid.profile.roles.filter(role => role.wayOfEarning === WayOfEarningType.Levels && role.requirement > userData.quid.profile.levels);

	/* It's checking if the user has any roles that are earned by leveling up, and if they do, it will remove them from the user's profileData.roles and remove the role from the user. */
	for (const role of roles) {

		try {

			/* It's removing the role from the user's profileData.roles. */
			const userRoleIndex = userData.quid.profile.roles.indexOf(role);
			if (userRoleIndex >= 0) { userData.quid.profile.roles.splice(userRoleIndex, 1); }

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
					p.roles = userData.quid.profile.roles;
				},
			);

			/* It's checking if the user has the role, and if they do, it will remove it and send a message to the user. */
			if (member.roles.cache.has(role.roleId)) {

				if (await missingPermissions(interaction, [
					'ManageRoles', // Needed to give out roles configured in this shop
				]) === true) { continue; }
				await member.roles.remove(role.roleId);

				// This is a followUp
				await respond(interaction, {
					content: member.toString(),
					embeds: [new EmbedBuilder()
						.setColor(default_color)
						.setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
						.setDescription(`You lost the <@&${role.roleId}> role because of a lack of levels!`)],
				});
			}
		}
		catch (error) {

			await checkRoleCatchBlock(error, interaction, member);
		}
	}

	return footerText;
}