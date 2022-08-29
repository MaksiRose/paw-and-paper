import { ButtonInteraction, CommandInteraction, EmbedBuilder, SelectMenuInteraction } from 'discord.js';
import { respond, unsafeKeys, widenValues } from './helperFunctions';
import userModel from '../models/userModel';
import { Quid, Profile, ServerSchema, UserSchema, WayOfEarningType } from '../typedef';
import { checkLevelRequirements, checkRoleCatchBlock } from './checkRoleRequirements';
import { getMapData } from './helperFunctions';
import { upperCasePronounAndPlural } from './getPronouns';
const { default_color } = require('../../config.json');

/**
 * Checks if the user is eligable for a level up, and sends an embed and updated profileData if so.
 */
export async function checkLevelUp(
	interaction: CommandInteraction<'cached'> | SelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	serverData: ServerSchema,
): Promise<{ levelUpEmbed: EmbedBuilder | null, profileData: Profile; }> {

	let embed: EmbedBuilder | null = null;

	/* It's checking if the user has enough experience to level up. If they do, it will level them up and then check if they leveled up again. */
	const requiredExperiencePoints = profileData.levels * 50;
	if (profileData.experience >= requiredExperiencePoints) {

		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userData.uuid,
			(u) => {
				const p = getMapData(getMapData(u.quids, quidData._id).profiles, interaction.guildId);
				p.experience -= requiredExperiencePoints;
				p.levels += 1;
			},
		);
		quidData = getMapData(userData.quids, quidData._id);
		profileData = getMapData(quidData.profiles, interaction.guildId);

		embed = new EmbedBuilder()
			.setColor(quidData.color)
			.setTitle(`${quidData.name} just leveled up! ${upperCasePronounAndPlural(quidData, 0, 'is', 'are')} now level ${profileData.levels}.`);

		const checkLevel = await checkLevelUp(interaction, userData, quidData, profileData, serverData);
		if (checkLevel.levelUpEmbed) {

			embed = checkLevel.levelUpEmbed;
			profileData = checkLevel.profileData;
		}

		const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId);
		const member = await guild.members.fetch(interaction.user.id);
		await checkLevelRequirements(serverData, interaction, member, profileData.levels);
	}

	return { levelUpEmbed: embed, profileData };
}

/**
 * Decreases the users level based on their current levels and removes their inventory, returns footerText for an updated bot reply.
 */
export async function decreaseLevel(
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	interaction: CommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached'>,
): Promise<string> {

	/* newUserLevel is nine tenths of current profile level. */
	const newUserLevel = Math.round(profileData.levels - (profileData.levels / 10));

	/* footerText displays how many levels are lost, if any, and how much experience is lost, if any. */
	let footerText = '';
	if (newUserLevel !== profileData.levels) { footerText += `-${profileData.levels - newUserLevel} level${(profileData.levels - newUserLevel > 1) ? 's' : ''}\n`; }
	if (profileData.experience > 0) { footerText += `-${profileData.experience} XP`; }

	const inventory_ = widenValues(profileData.inventory);
	/* Updating the footerText and the database for any items the user had. */
	for (const itemType of unsafeKeys(inventory_)) {

		for (const item of unsafeKeys(inventory_[itemType])) {

			footerText += `\n-${inventory_[itemType][item]} ${item}`;
			inventory_[itemType][item] = 0;
		}
	}

	userData = await userModel.findOneAndUpdate(
		u => u.uuid === userData.uuid,
		(u) => {
			const p = getMapData(getMapData(u.quids, quidData._id).profiles, interaction.guildId);
			p.levels = newUserLevel;
			p.experience = 0;
			p.inventory = inventory_;
		},
	);
	quidData = getMapData(userData.quids, quidData._id);
	profileData = getMapData(quidData.profiles, interaction.guildId);


	/* Get the guild, member, and the profileData roles where the wayOfEarning is levels and the role requirement bigger than the profile level. */
	const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId);
	const member = await guild.members.fetch(interaction.user.id);
	const roles = profileData.roles.filter(role => role.wayOfEarning === WayOfEarningType.Levels && role.requirement > profileData.levels);

	/* It's checking if the user has any roles that are earned by leveling up, and if they do, it will remove them from the user's profileData.roles and remove the role from the user. */
	for (const role of roles) {

		try {

			/* It's removing the role from the user's profileData.roles. */
			const userRoleIndex = profileData.roles.indexOf(role);
			if (userRoleIndex >= 0) { profileData.roles.splice(userRoleIndex, 1); }

			await userModel.findOneAndUpdate(
				u => u.uuid === userData.uuid,
				(u) => {
					const p = getMapData(getMapData(u.quids, quidData._id).profiles, interaction.guildId);
					p.roles = profileData.roles;
				},
			);

			/* It's checking if the user has the role, and if they do, it will remove it and send a message to the user. */
			if (member.roles.cache.has(role.roleId)) {

				await member.roles.remove(role.roleId);

				await respond(interaction, {
					content: member.toString(),
					embeds: [new EmbedBuilder()
						.setColor(default_color)
						.setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
						.setDescription(`You lost the <@&${role.roleId}> role because of a lack of levels!`)],
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

	return footerText;
}