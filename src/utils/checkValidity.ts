import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CommandInteraction, EmbedBuilder, MessageComponentInteraction } from 'discord.js';
import { cooldownMap } from '../events/interactionCreate';
import { respond, sendErrorMessage } from './helperFunctions';
import userModel from '../models/userModel';
import { Quid, Profile, UserSchema, Inventory } from '../typedef';
import { getMapData } from './helperFunctions';
import { pronoun, pronounAndPlural, upperCasePronoun } from './getPronouns';
import { decreaseLevel } from './levelHandling';
import { stopResting } from '../commands/gameplay_maintenance/rest';
const { error_color } = require('../../config.json');

export async function isPassedOut(
	interaction: CommandInteraction<'cached' | 'raw'> | MessageComponentInteraction<'cached' | 'raw'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	isNew: boolean,
): Promise<boolean> {

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
				.catch((error) => { throw new Error(error); });
		}

		return true;
	}

	return false;
}

/**
 * Checks if the user is on a cooldown. If yes, then send a message and return true, as well as decrease their level if it's new. Else, return false.
 */
export async function hasCooldown(
	interaction: CommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'>,
	userData: UserSchema,
	quidData: Quid,
): Promise<boolean> {

	if (cooldownMap.get(userData.uuid + interaction.guildId) === true) {

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
						.catch (async error => {

							await sendErrorMessage(interaction, error)
								.catch(e => { console.error(e); });
						});
				}, 10_000);
			})
			.catch((error) => { throw new Error(error); });

		return true;
	}

	return false;
}

/**
 * Checks if the user is resting. If yes, then wake user up and attach an embed to the message. Returns the updated `userData`.
 */
export async function isResting(
	interaction: CommandInteraction<'cached' | 'raw'> | MessageComponentInteraction<'cached' | 'raw'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	embedArray: Array<EmbedBuilder>,
): Promise<UserSchema> {

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
export async function isInvalid(
	interaction: CommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	embedArray: Array<EmbedBuilder>,
): Promise<boolean> {

	if (await isPassedOut(interaction, userData, quidData, profileData, false)) { return true; }
	if (await hasCooldown(interaction, userData, quidData)) { return true; }
	await isResting(interaction, userData, quidData, profileData, embedArray);
	return false;
}

function hasTooManyItems(
	profileData: Profile,
): boolean {

	/** The amount of allowed items in a profiles inventory. */
	const allowedItemAmount = 5;

	/** This is an array of all the inventory objects. */
	const inventoryObjectValues = Object.values(profileData.inventory) as Array<Inventory[keyof Inventory]>;
	/** This is an array of numbers as the properties of the keys in the inventory objects, which are numbers representing the amount one has of the key which is an item type. */
	const inventoryNumberValues = inventoryObjectValues.map(type => Object.values(type)).flat();

	/* Checks whether the combined number of all the items is bigger than the allowed item count. */
	return inventoryNumberValues.reduce((a, b) => a + b) >= allowedItemAmount;
}

/**
 * It checks if the user has a full inventory, and if so, sends a message to the user
 * @param interaction - The CommandInteraction object.
 * @param quidData - The quid's data.
 * @param profileData - The profile data of the user.
 * @param embedArray - An array of embeds to send before the inventory full embed.
 * @param messageContent - The message content to send with the embeds.
 * @returns A boolean.
 */
export async function hasFullInventory(
	interaction: CommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	quidData: Quid,
	profileData: Profile,
	embedArray: EmbedBuilder[],
	messageContent: string | null,
): Promise<boolean> {

	if (hasTooManyItems(profileData)) {

		await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} approaches the pack borders, ${pronoun(quidData, 2)} mouth filled with various things. As eager as ${pronounAndPlural(quidData, 0, 'is', 'are')} to go into the wild, ${pronounAndPlural(quidData, 0, 'decide')} to store some things away first.*`)
				.setFooter({ text: 'You can only hold up to 5 items in your personal inventory. Type "/store" to put things into the pack inventory!' }),
			],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId('stats_store')
					.setLabel('Store food away')
					.setStyle(ButtonStyle.Secondary),
				)],
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return true;
	}

	return false;
}

export function isInteractable(
	interaction: CommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserSchema | null,
	messageContent: string | null,
	embedArray: EmbedBuilder[],
): userData is UserSchema {

	if (!userData) {

		respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user has no account :('),
			],
			ephemeral: true,
		}, false)
			.catch(error => { throw new Error(error); });
		return false;
	}

	const quidData = userData.quids[userData.currentQuid[interaction.guildId] || ''];
	const profileData = quidData?.profiles[interaction.guildId];
	if (!quidData || !profileData) {

		respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user has no selected quid :('),
			],
			ephemeral: true,
		}, false)
			.catch(error => { throw new Error(error); });
		return false;
	}

	if (quidData.name === '' || quidData.species === '') {

		respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid is not set up for the RPG :('),
			],
			ephemeral: true,
		}, false)
			.catch(error => { throw new Error(error); });
		return false;
	}

	if (profileData.health <= 0 || profileData.energy <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) {

		respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid is passed out :('),
			],
			ephemeral: true,
		}, false)
			.catch(error => { throw new Error(error); });
		return false;
	}

	if (profileData.isResting) {

		respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid is resting :('),
			],
			ephemeral: true,
		}, false)
			.catch(error => { throw new Error(error); });
		return false;
	}

	if (cooldownMap.get(userData.uuid + interaction.guildId)) {

		respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid is busy :('),
			],
			ephemeral: true,
		}, false)
			.catch(error => { throw new Error(error); });
		return false;
	}

	if (hasTooManyItems(profileData)) {

		respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid has too many items in their inventory :('),
			],
			ephemeral: true,
		}, false)
			.catch(error => { throw new Error(error); });
		return false;
	}

	return true;
}