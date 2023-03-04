import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, AnySelectMenuInteraction, time, Message } from 'discord.js';
import { capitalize, getMessageId, respond, sendErrorMessage } from './helperFunctions';
import { decreaseLevel } from './levelHandling';
import { stopResting, isResting } from '../commands/gameplay_maintenance/rest';
import { hasName, hasNameAndSpecies } from './checkUserState';
import QuidToServer from '../models/quidToServer';
import { getDisplayname, pronoun, pronounAndPlural } from './getQuidInfo';
import Quid from '../models/quid';
import User from '../models/user';
import UserToServer from '../models/userToServer';
const { error_color } = require('../../config.json');

export async function isPassedOut(
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached' | 'raw'> | AnySelectMenuInteraction<'cached' | 'raw'>,
	user: User,
	userToServer: UserToServer | undefined,
	quid: Quid,
	quidToServer: QuidToServer,
	isNew: boolean,
): Promise<boolean> {

	/* This is a function that checks if the user has passed out. If they have, it will send a message to the channel and return true. */
	if (quidToServer.energy <= 0 || quidToServer.health <= 0 || quidToServer.hunger <= 0 || quidToServer.thirst <= 0) {

		const sixHoursInMs = 21_600_000;

		if (isNew) {

			await quidToServer.update({ passedOutTimestamp: Date.now() });
		}
		else if (quidToServer.passedOutTimestamp + sixHoursInMs < Date.now()) {

			await quidToServer.update({ energy: quidToServer.energy || 1, health: quidToServer.health || 1, hunger: quidToServer.hunger || 1, thirst: quidToServer.thirst || 1 });
			return false;
		}

		// This is always a followUp
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} lies on the ground near the pack borders, barely awake.* "Healer!" *${pronounAndPlural(quid, 0, 'screeches', 'screech')} with ${pronoun(quid, 2)} last energy. Without help, ${pronoun(quid, 0)} will not be able to continue.*\n\nIf no one heals you, you will stop being unconscious ${time(Math.floor((quidToServer.passedOutTimestamp + sixHoursInMs) / 1000), 'R')}.`)
				.setFooter(isNew ? { text: await decreaseLevel(quidToServer, interaction) } : null)],
		});

		/* This is a tip that is sent to the user when they pass out for the first time. */
		if (user.advice_passingOut === false) {

			await user.update({ advice_passingOut: true });

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
	user: User,
	userToServer: UserToServer | undefined,
	quid: Quid,
	quidToServer: QuidToServer,
): Promise<boolean> {

	if (userToServer?.hasCooldown === true) {

		// This is always a reply
		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} is so eager to get things done today that ${pronounAndPlural(quid, 0, 'is', 'are')} somersaulting. ${capitalize(pronoun(quid, 0))} should probably take a few seconds to calm down.*`)],
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
	user: User,
	userToServer: UserToServer,
	quid: Quid,
	quidToServer: QuidToServer,
): Promise<EmbedBuilder[]> {

	/* This is a function that checks if the user is resting. If they are, it will wake them up and attach an embed to the message. */
	if (isResting(userToServer) === true) {

		stopResting(userToServer);

		return [new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			})
			.setDescription(`*${quid.name} opens ${pronoun(quid, 2)} eyes, blinking at the bright sun. After a long stretch, ${pronounAndPlural(quid, 0, 'leave')} ${pronoun(quid, 2)} den to continue ${pronoun(quid, 2)} day.*`)
			.setFooter({ text: `Current energy: ${quidToServer.energy}` })];
	}

	return [];
}

/**
 * Checks if the user is passed out, on a cooldown or resting, sends or attaches the appropriate message/embed, and returns a boolean of the result.
 */
export async function isInvalid(
	interaction: ChatInputCommandInteraction<'cached' | 'raw'> | ButtonInteraction<'cached'>,
	user: User,
	userToServer: UserToServer,
	quid: Quid,
	quidToServer: QuidToServer,
): Promise<EmbedBuilder[] | false> {

	if (await isPassedOut(interaction, user, userToServer, quid, quidToServer, false)) { return false; }
	if (await hasCooldown(interaction, user, userToServer, quid, quidToServer)) { return false; }
	return await checkResting(interaction, user, userToServer, quid, quidToServer);
}

function hasTooManyItems(
	quidToServer: QuidToServer,
): boolean {

	/** The amount of allowed items in a profiles inventory. */
	const allowedItemAmount = 5;

	/* Checks whether the combined number of all the items is bigger than the allowed item count. */
	return quidToServer.inventory.length >= allowedItemAmount;
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
	user: User | undefined,
	userToServer: UserToServer | undefined,
	quid: Quid,
	quidToServer: QuidToServer,
	restEmbed: EmbedBuilder[],
	messageContent: string,
): Promise<boolean> {

	if (hasTooManyItems(quidToServer)) {

		// This is always a reply
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} approaches the pack borders, ${pronoun(quid, 2)} mouth filled with various things. As eager as ${pronounAndPlural(quid, 0, 'is', 'are')} to go into the wild, ${pronounAndPlural(quid, 0, 'decide')} to store some things away first.*`)
				.setFooter({ text: 'You can only hold up to 5 items in your personal inventory. Type "/store" or click the button below to put things into the pack inventory!' }),
			],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`stats_store_@${quid.userId}`)
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
	quid: Quid | undefined,
	quidToServer: QuidToServer | undefined,
	user: User | undefined,
	userToServer: UserToServer | undefined,
	messageContent: string,
	restEmbed: EmbedBuilder[],
	options?: { checkPassedOut?: boolean, checkResting?: boolean, checkCooldown?: boolean, checkFullInventory?: boolean },
): quid is Quid<true> {

	if (!user) {

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

	if (!hasName(quid)) {

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

	if (!hasNameAndSpecies(quid)) {

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

	if (options?.checkPassedOut !== false) {

		if (quidToServer === undefined) { throw new Error('quid exists, but quidToServer is undefined'); }
		if (quidToServer.health <= 0 || quidToServer.energy <= 0 || quidToServer.hunger <= 0 || quidToServer.thirst <= 0) {

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
	}

	if (options?.checkResting !== false) {

		if (userToServer === undefined) { throw new Error('user exists, but userToServer is undefined'); }
		if (isResting(userToServer)) {

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
	}

	if (options?.checkCooldown !== false && userToServer?.hasCooldown === true) {

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

	if (options?.checkFullInventory !== false) {

		if (quidToServer === undefined) { throw new Error('quid exists, but quidToServer is undefined'); }
		if (hasTooManyItems(quidToServer)) {

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
	}

	return true;
}