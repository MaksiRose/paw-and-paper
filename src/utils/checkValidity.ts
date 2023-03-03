import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, AnySelectMenuInteraction, time, Message } from 'discord.js';
import { capitalize, getMapData, getMessageId, respond, sendErrorMessage } from './helperFunctions';
import { decreaseLevel } from './levelHandling';
import { stopResting, isResting } from '../commands/gameplay_maintenance/rest';
import { calculateInventorySize } from './simulateItemUse';
import { UserData } from '../typings/data/user';
import { hasName, hasNameAndSpecies } from './checkUserState';
const { error_color } = require('../../config.json');

export async function isPassedOut(
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'> | AnySelectMenuInteraction<'cached' | 'raw'>,
	userData: UserData<never, never>,
	isNew: boolean,
): Promise<boolean> {

	/* This is a function that checks if the user has passed out. If they have, it will send a message to the channel and return true. */
	if (userData.quid.profile.energy <= 0 || userData.quid.profile.health <= 0 || userData.quid.profile.hunger <= 0 || userData.quid.profile.thirst <= 0) {

		const sixHoursInMs = 21_600_000;

		if (isNew) {

			userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
					p.passedOutTimestamp = Date.now();
				},
			);
		}
		else if (userData.quid.profile.passedOutTimestamp + sixHoursInMs < Date.now()) {

			userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
					if (p.energy <= 0) { p.energy = 1; }
					if (p.health <= 0) { p.health = 1; }
					if (p.hunger <= 0) { p.hunger = 1; }
					if (p.thirst <= 0) { p.thirst = 1; }
				},
			);
			return false;
		}

		// This is always a followUp
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} lies on the ground near the pack borders, barely awake.* "Healer!" *${userData.quid.pronounAndPlural(0, 'screeches', 'screech')} with ${userData.quid.pronoun(2)} last energy. Without help, ${userData.quid.pronoun(0)} will not be able to continue.*\n\nIf no one heals you, you will stop being unconscious ${time(Math.floor((userData.quid.profile.passedOutTimestamp + sixHoursInMs) / 1000), 'R')}.`)
				.setFooter(isNew ? { text: await decreaseLevel(userData, interaction) } : null)],
		});

		/* This is a tip that is sent to the user when they pass out for the first time. */
		if (userData.advice.passingout === false) {

			await userData.update(
				(u) => { u.advice.passingout = true; },
			);

			// This is always a followUp
			await respond(interaction, {
				content: `${interaction.user.toString()} ❓ **Tip:**\nIf your health, energy, hunger or thirst points hit zero, you pass out. Another player has to heal you so you can continue playing.\nMake sure to always watch your stats to prevent passing out!`,
			});
		}

		return true;
	}

	return false;
}

/**
 * Checks if the user is on a cooldown. If yes, then send a message and return true, as well as decrease their level if it's new. Else, return false.
 */
export async function hasCooldown(
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'>,
	userData: UserData<never, never>,
): Promise<boolean> {

	if (userData.serverInfo?.hasCooldown === true) {

		// This is always a reply
		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} is so eager to get things done today that ${userData.quid.pronounAndPlural(0, 'is', 'are')} somersaulting. ${capitalize(userData.quid.pronoun(0))} should probably take a few seconds to calm down.*`)],
		});

		setTimeout(async function() {

			await interaction
				.deleteReply(getMessageId(botReply))
				.catch (async error => {

					try {

						console.error(error);
						if (botReply instanceof Message) { botReply.delete(); }
						else { throw error; }
					}
					catch (newError) {

						await sendErrorMessage(interaction, newError)
							.catch(e => { console.error(e); });
					}
				});
		}, 10_000);

		return true;
	}

	return false;
}

/**
 * Checks if the user is resting. If yes, then wake user up and attach an embed to the message. Returns the updated `userData`.
 */
export async function checkResting(
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'> | AnySelectMenuInteraction<'cached'>,
	userData: UserData<never, never>,
): Promise<EmbedBuilder[]> {

	/* This is a function that checks if the user is resting. If they are, it will wake them up and attach an embed to the message. */
	if (isResting(userData) === true) {

		stopResting(userData);

		return [new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
			.setDescription(`*${userData.quid.name} opens ${userData.quid.pronoun(2)} eyes, blinking at the bright sun. After a long stretch, ${userData.quid.pronounAndPlural(0, 'leave')} ${userData.quid.pronoun(2)} den to continue ${userData.quid.pronoun(2)} day.*`)
			.setFooter({ text: `Current energy: ${userData.quid.profile.energy}` })];
	}

	return [];
}

/**
 * Checks if the user is passed out, on a cooldown or resting, sends or attaches the appropriate message/embed, and returns a boolean of the result.
 */
export async function isInvalid(
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
): Promise<EmbedBuilder[] | false> {

	if (await isPassedOut(interaction, userData, false)) { return false; }
	if (await hasCooldown(interaction, userData)) { return false; }
	return await checkResting(interaction, userData);
}

function hasTooManyItems(
	userData: UserData<never, never>,
): boolean {

	/** The amount of allowed items in a profiles inventory. */
	const allowedItemAmount = 5;

	/* Checks whether the combined number of all the items is bigger than the allowed item count. */
	return calculateInventorySize(userData.quid.profile.inventory) >= allowedItemAmount;
}

/**
 * It checks if the user has a full inventory, and if so, sends a message to the user
 * @param interaction - The ChatInputCommandInteraction object.
 * @param quidData - The quid's data.
 * @param profileData - The profile data of the user.
 * @param restEmbed - An array of embeds to send before the inventory full embed.
 * @param messageContent - The message content to send with the embeds.
 * @returns A boolean.
 */
export async function hasFullInventory(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
	restEmbed: EmbedBuilder[],
	messageContent: string,
): Promise<boolean> {

	if (hasTooManyItems(userData)) {

		// This is always a reply
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} approaches the pack borders, ${userData.quid.pronoun(2)} mouth filled with various things. As eager as ${userData.quid.pronounAndPlural(0, 'is', 'are')} to go into the wild, ${userData.quid.pronounAndPlural(0, 'decide')} to store some things away first.*`)
				.setFooter({ text: 'You can only hold up to 5 items in your personal inventory. Type "/store" or click the button below to put things into the pack inventory!' }),
			],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`stats_store_@${userData._id}`)
					.setLabel('Store items away')
					.setStyle(ButtonStyle.Secondary),
				)],
		});

		return true;
	}

	return false;
}

export function isInteractable(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	userData: UserData<undefined, ''> | null,
	messageContent: string,
	restEmbed: EmbedBuilder[],
	options?: { checkPassedOut?: boolean, checkResting?: boolean, checkCooldown?: boolean, checkFullInventory?: boolean },
): userData is UserData<never, never> {

	if (!userData) {

		// This is always a reply
		respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user has no account :('),
			],
			ephemeral: true,
		});
		return false;
	}

	if (!hasName(userData)) {

		// This is always a reply
		respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user has no selected quid :('),
			],
			ephemeral: true,
		});
		return false;
	}

	if (!hasNameAndSpecies(userData)) {

		// This is always a reply
		respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid is not set up for the RPG :('),
			],
			ephemeral: true,
		});
		return false;
	}

	if (options?.checkPassedOut !== false && (userData.quid.profile.health <= 0 || userData.quid.profile.energy <= 0 || userData.quid.profile.hunger <= 0 || userData.quid.profile.thirst <= 0)) {

		// This is always a reply
		respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid is passed out :('),
			],
			ephemeral: true,
		});
		return false;
	}

	if (options?.checkResting !== false && isResting(userData)) {

		// This is always a reply
		respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid is resting :('),
			],
			ephemeral: true,
		});
		return false;
	}

	if (options?.checkCooldown !== false && userData.serverInfo?.hasCooldown === true) {

		// This is always a reply
		respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid is busy :('),
			],
			ephemeral: true,
		});
		return false;
	}

	if (options?.checkFullInventory !== false && hasTooManyItems(userData)) {

		// This is always a reply
		respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(error_color)
				.setTitle('The mentioned user\'s selected quid has too many items in their inventory :('),
			],
			ephemeral: true,
		});
		return false;
	}

	return true;
}