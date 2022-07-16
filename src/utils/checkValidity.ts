import { CommandInteraction, MessageEmbed } from 'discord.js';
import { hasCooldownMap, respond } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { UserSchema } from '../typedef';
import { stopResting } from './executeResting';
import { pronoun, pronounAndPlural, upperCasePronoun } from './getPronouns';
import { decreaseLevel } from './levelHandling';

export async function isPassedOut(interaction: CommandInteraction<'cached' | 'raw'>, uuid: string, isNew: boolean): Promise<boolean> {

	/* Defining the userData, characterData and profileData */
	const userData = await userModel.findOne({ uuid: uuid }).catch(() => { return null; });
	const characterData = userData?.characters?.[userData.currentCharacter?.[interaction.guildId || 'DMs']];
	const profileData = characterData?.profiles?.[interaction.guildId || 'DMs'];

	/* This is a function that checks if the user has passed out. If they have, it will send a message to the channel and return true. */
	if (userData && characterData && profileData && (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0)) {

		await respond(interaction, {
			embeds: [ new MessageEmbed({
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} lies on the ground near the pack borders, barely awake.* "Healer!" *${pronounAndPlural(characterData, 0, 'screeches', 'screech')} with ${pronoun(characterData, 2)} last energy. Without help, ${pronoun(characterData, 0)} will not be able to continue.*`,
				footer: isNew ? { text: await decreaseLevel(userData, interaction) } : undefined,
			})],
		}, true)
			.catch((error) => { throw new Error(error); });

		/* This is a tip that is sent to the user when they pass out for the first time. */
		if (userData.advice.passingout === false) {

			await userModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(u) => { u.advice.passingout = true; },
			);

			await respond(interaction, {
				content: `${interaction.user.toString()} ❓ **Tip:**\nIf your health, energy, hunger or thirst points hit zero, you pass out. Another player has to heal you so you can continue playing.\nMake sure to always watch your stats to prevent passing out!`,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		return true;
	}

	return false;
}

/**
 * Checks if the user is on a cooldown. If yes, then send a message and return true, as well as decrease their level if it's new. Else, return false.
 */
export async function hasCooldown(interaction: CommandInteraction<'cached' | 'raw'>, userData: UserSchema, commandName: string): Promise<boolean> {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guildId]];

	if (hasCooldownMap.get(userData?.uuid + interaction.guildId) === true && commandName === interaction.commandName) {

		await respond(interaction, {
			embeds: [{
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} is so eager to get things done today that ${pronounAndPlural(characterData, 0, 'is', 'are')} somersaulting. ${upperCasePronoun(characterData, 0)} should probably take a few seconds to calm down.*`,
			}],
		}, false)
			.then(reply => {
				setTimeout(async function() {

					await reply
						.delete()
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});
				}, 10000);
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return true;
	}

	return false;
}

/**
 * Checks if the user is resting. If yes, then wake user up and attach an embed to the message. Returns the updated `userData`.
 */
export async function isResting(interaction: CommandInteraction<'cached' | 'raw'>, userData: UserSchema, embedArray: Array<MessageEmbed>): Promise<UserSchema> {

	const characterData = userData.characters[userData.currentCharacter[interaction.guildId]];
	const profileData = characterData.profiles[interaction.guildId];

	/* This is a function that checks if the user is resting. If they are, it will wake them up and attach an embed to the message. */
	if (profileData.isResting == true) {

		userData = await userModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(u) => {
				u.characters[u.currentCharacter[interaction.guildId]].profiles[interaction.guildId].isResting = false;
			},
		);

		stopResting(interaction.user.id, interaction.guildId);

		embedArray.unshift(new MessageEmbed({
			color: characterData.color,
			author: { name: characterData.name, icon_url: characterData.avatarURL },
			description: `*${characterData.name} opens ${pronoun(characterData, 2)} eyes, blinking at the bright sun. After a long stretch, ${pronounAndPlural(characterData, 0, 'leave')} ${pronoun(characterData, 2)} den to continue ${pronoun(characterData, 2)} day.*`,
			footer: { text: `Current energy: ${profileData.energy}` },
		}));
	}

	return userData;
}

/**
 * Checks if the user is passed out, on a cooldown or resting, sends or attaches the appropriate message/embed, and returns a boolean of the result.
 */
export async function isInvalid(interaction: CommandInteraction<'cached' | 'raw'>, userData: UserSchema, embedArray: Array<MessageEmbed>, commandName: string): Promise<boolean> {

	if (await isPassedOut(interaction, userData.uuid, false)) {

		return true;
	}

	if (await hasCooldown(interaction, userData, commandName)) {

		return true;
	}

	await isResting(interaction, userData, embedArray);

	return false;
}