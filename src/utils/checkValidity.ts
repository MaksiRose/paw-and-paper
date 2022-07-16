import { CommandInteraction, MessageEmbed } from 'discord.js';
import { respond } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { pronoun, pronounAndPlural } from './getPronouns';
import { decreaseLevel } from './levelHandling';

export async function isPassedOut(interaction: CommandInteraction<'cached' | 'raw'>, uuid: string, isNew: boolean): Promise<boolean> {

	const userData = await userModel.findOne({ uuid: uuid }).catch(() => { return null; });
	const characterData = userData?.characters?.[userData.currentCharacter?.[interaction.guildId || 'DMs']];
	const profileData = characterData?.profiles?.[interaction.guildId || 'DMs'];

	if (userData && characterData && profileData && (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0)) {

		const botReply = await respond(interaction, {
			embeds: [ new MessageEmbed({
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} lies on the ground near the pack borders, barely awake.* "Healer!" *${pronounAndPlural(characterData, 0, 'screeches', 'screech')} with ${pronoun(characterData, 2)} last energy. Without help, ${pronoun(characterData, 0)} will not be able to continue.*`,
				footer: isNew ? { text: await decreaseLevel(userData, interaction) } : undefined,
			})],
		}, true)
			.catch((error) => { throw new Error(error); });

		await passingoutAdvice(message, userData);

		return true;
	}
}