import { CommandInteraction, Message, MessageEmbed } from 'discord.js';
import { respond } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { ServerSchema, UserSchema } from '../typedef';
import { checkLevelRequirements, checkRoleCatchBlock } from './checkRoleRequirements';
import { upperCasePronounAndPlural } from './getPronouns';
const { default_color } = require('../../config.json');

/**
 * Checks if the user is eligable for a level up, and sends a message if so.
 */
export async function checkLevelUp(interaction: CommandInteraction<'cached' | 'raw'>, userData: UserSchema, serverData: ServerSchema, botReply?: Message): Promise<Message | undefined> {

	/* Getting characterData and profileData */
	let characterData = userData.characters[userData.currentCharacter[interaction.guildId]];
	let profileData = characterData.profiles[interaction.guildId];

	/* It's checking if the user has enough experience to level up. If they do, it will level them up and then check if they leveled up again. */
	const requiredExperiencePoints = profileData.levels * 50;
	if (profileData.experience >= requiredExperiencePoints) {

		userData = await userModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(u) => {
				u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].experience -= requiredExperiencePoints;
				u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].levels += 1;
			},
		);
		characterData = userData.characters[userData.currentCharacter[interaction.guildId]];
		profileData = characterData.profiles[interaction.guildId];

		if (botReply) {

			botReply.embeds.push(new MessageEmbed()
				.setColor(characterData.color)
				.setTitle(`${characterData.name} just leveled up! ${upperCasePronounAndPlural(characterData, 0, 'is', 'are')} now level ${profileData.levels}.`));

			await botReply
				.edit({ embeds: botReply.embeds })
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		botReply = await checkLevelUp(interaction, userData, serverData, botReply);

		const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId);
		const member = await guild.members.fetch(userData.userId);
		await checkLevelRequirements(serverData, interaction, member, profileData.levels);
	}

	return botReply;
}

/**
 * Decreases the users level based on their current levels and removes their inventory, returns footerText for an updated bot reply.
 */
export async function decreaseLevel(userData: UserSchema, interaction: CommandInteraction<'cached' | 'raw'>): Promise<string> {

	/* Defining characterData and profileData */
	let characterData = userData.characters[userData.currentCharacter[interaction.guildId]];
	let profileData = characterData.profiles[interaction.guildId];

	/* newUserLevel is nine tenths of current profile level. */
	const newUserLevel = Math.round(profileData.levels - (profileData.levels / 10));

	/* footerText displays how many levels are lost, if any, and how much experience is lost, if any. */
	let footerText = '';
	if (newUserLevel !== profileData.levels) { footerText += `-${profileData.levels - newUserLevel} level${(profileData.levels - newUserLevel > 1) ? 's' : ''}\n`; }
	if (profileData.experience > 0) { footerText += `-${profileData.experience} XP`; }

	/* Updating the footerText and the database for any items the user had. */
	for (const itemType of Object.keys(profileData.inventory)) {

		for (const item of Object.keys(profileData.inventory[itemType])) {

			if (profileData.inventory[itemType][item] > 0) {

				footerText += `\n-${profileData.inventory[itemType][item]} ${item}`;
				profileData.inventory[itemType][item] = 0;
			}
		}
	}

	userData = await userModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(u) => {
			u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].levels = newUserLevel;
			u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].experience = 0;
			u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].inventory = profileData.inventory;
		},
	);
	characterData = userData.characters[userData.currentCharacter[interaction.guildId]];
	profileData = characterData.profiles[interaction.guildId];


	/* Get the guild, member, and the profileData roles where the wayOfEarning is levels and the role requirement bigger than the profile level. */
	const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId);
	const member = await guild.members.fetch(userData.userId);
	const roles = profileData.roles.filter(role => role.wayOfEarning === 'levels' && role.requirement > profileData.levels);

	/* It's checking if the user has any roles that are earned by leveling up, and if they do, it will remove them from the user's profileData.roles and remove the role from the user. */
	for (const role of roles) {

		try {

			/* It's removing the role from the user's profileData.roles. */
			const userRoleIndex = profileData.roles.indexOf(role);
			if (userRoleIndex >= 0) { profileData.roles.splice(userRoleIndex, 1); }

			await userModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(u) => {
					u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].roles = profileData.roles;
				},
			);

			/* It's checking if the user has the role, and if they do, it will remove it and send a message to the user. */
			if (member.roles.cache.has(role.roleId)) {

				await member.roles.remove(role.roleId);

				await respond(interaction, {
					content: member.toString(),
					embeds: [{
						color: default_color,
						author: { name: guild.name, icon_url: guild.iconURL() || undefined },
						description: `You lost the <@&${role.roleId}> role because of a lack of levels!`,
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

	return footerText;
}