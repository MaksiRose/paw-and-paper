import { CommandInteraction, EmbedBuilder, SelectMenuInteraction } from 'discord.js';
import { hasCooldownMap, respond } from '../events/interactionCreate';
import userModel from '../models/userModel';
import { Quid, Profile, UserSchema } from '../typedef';
import { stopResting } from './executeResting';
import { getMapData } from './getInfo';
import { pronoun, pronounAndPlural, upperCasePronoun } from './getPronouns';
import { decreaseLevel } from './levelHandling';

export async function isPassedOut(interaction: CommandInteraction<'cached' | 'raw'>, userData: UserSchema, quidData: Quid, profileData: Profile, isNew: boolean): Promise<boolean> {

	/* This is a function that checks if the user has passed out. If they have, it will send a message to the channel and return true. */
	if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) {

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} lies on the ground near the pack borders, barely awake.* "Healer!" *${pronounAndPlural(quidData, 0, 'screeches', 'screech')} with ${pronoun(quidData, 2)} last energy. Without help, ${pronoun(quidData, 0)} will not be able to continue.*`)
				.setFooter(isNew ? { text: await decreaseLevel(userData, quidData, profileData, interaction) } : null)],
		}, false)
			.catch((error) => { throw new Error(error); });

		/* This is a tip that is sent to the user when they pass out for the first time. */
		if (userData.advice.passingout === false) {

			await userModel.findOneAndUpdate(
				u => u.uuid === userData.uuid,
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
export async function hasCooldown(interaction: CommandInteraction<'cached' | 'raw'>, userData: UserSchema, quidData: Quid, commandName: string): Promise<boolean> {

	if (hasCooldownMap.get(userData?.uuid + interaction.guildId) === true && commandName === interaction.commandName) {

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} is so eager to get things done today that ${pronounAndPlural(quidData, 0, 'is', 'are')} somersaulting. ${upperCasePronoun(quidData, 0)} should probably take a few seconds to calm down.*`)],
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
export async function isResting(interaction: CommandInteraction<'cached' | 'raw'> | SelectMenuInteraction<'cached' | 'raw'>, userData: UserSchema, quidData: Quid, profileData: Profile, embedArray: Array<EmbedBuilder>): Promise<UserSchema> {

	/* This is a function that checks if the user is resting. If they are, it will wake them up and attach an embed to the message. */
	if (profileData.isResting == true) {

		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userData.uuid,
			(u) => {
				const p = getMapData(getMapData(u.quids, quidData._id).profiles, interaction.guildId);
				p.isResting = false;
			},
		);

		stopResting(interaction.user.id, interaction.guildId);

		embedArray.unshift(new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
			.setDescription(`*${quidData.name} opens ${pronoun(quidData, 2)} eyes, blinking at the bright sun. After a long stretch, ${pronounAndPlural(quidData, 0, 'leave')} ${pronoun(quidData, 2)} den to continue ${pronoun(quidData, 2)} day.*`)
			.setFooter({ text: `Current energy: ${profileData.energy}` }));
	}

	return userData;
}

/**
 * Checks if the user is passed out, on a cooldown or resting, sends or attaches the appropriate message/embed, and returns a boolean of the result.
 */
export async function isInvalid(interaction: CommandInteraction<'cached' | 'raw'>, userData: UserSchema, quidData: Quid, profileData: Profile, embedArray: Array<EmbedBuilder>, commandName: string): Promise<boolean> {

	if (await isPassedOut(interaction, userData, quidData, profileData, false)) {

		return true;
	}

	if (await hasCooldown(interaction, userData, quidData, commandName)) {

		return true;
	}

	await isResting(interaction, userData, quidData, profileData, embedArray);

	return false;
}