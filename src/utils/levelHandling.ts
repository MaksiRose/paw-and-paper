import { CommandInteraction, Message, MessageEmbed } from 'discord.js';
import userModel from '../models/userModel';
import { ServerSchema, UserSchema } from '../typedef';
import { checkLevelRequirements } from './checkRoleRequirements';
import { upperCasePronounAndPlural } from './getPronouns';

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
		await checkLevelRequirements(serverData, message, member, profileData.levels);
	}

	return botReply;
}