import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Message, RepliableInteraction, SlashCommandBuilder } from 'discord.js';
import { client } from '../..';
import Den from '../../models/den';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CurrentRegionType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasCooldown, isPassedOut } from '../../utils/checkValidity';
import { getDisplayname, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { capitalize, respond, sendErrorMessage } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { wearDownDen } from '../../utils/wearDownDen';
import { remindOfAttack } from '../gameplay_primary/attack';

const restingIntervalMap = new Map<string, NodeJS.Timeout>();

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('rest')
		.setDescription('Get some sleep and fill up your energy meter. Takes some time to refill.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page3',
	position: 5,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server, discordUser }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!discordUser) { throw new TypeError('discordUser is undefined'); }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is on a cooldown or passed out. */
		if (await isPassedOut(interaction, user, userToServer, quid, quidToServer, false)) { return; }
		if (await hasCooldown(interaction, user, userToServer, quid, quidToServer)) { return; }

		await executeResting(interaction, discordUser.id, user, quid, userToServer, quidToServer, server);
	},
};

// This is either called directly via the command, or via the "Rest" button in the travel-regions command
export async function executeResting(
	interaction: RepliableInteraction<'cached'>,
	discordUserId: string,
	user: User,
	quid: Quid,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	server: Server,
) {

	if (await missingPermissions(interaction, [
		'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call
	]) === true) { return; }

	const messageContent = remindOfAttack(interaction.guildId);

	if (isResting(userToServer)) {

		// This is an update to the button if the interaction is a button from the travel-regions command, or a reply if the interaction is a ChatInputCommand
		await respond(interaction, {
			content: messageContent,
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${capitalize(pronoun(quid, 0))} must be really tired to dream of sleeping!*`),
			],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);
		return;
	}

	if (quidToServer.energy >= quidToServer.maxEnergy) {

		// This is an update to the button if the interaction is a button from the travel-regions command, or a reply if the interaction is a ChatInputCommand
		await respond(interaction, {
			content: messageContent,
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} trots around the dens eyeing ${pronoun(quid, 2)} comfortable moss-covered bed. A nap looks nice, but ${pronounAndPlural(quid, 0, 'has', 'have')} far too much energy to rest!*`),
			],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);
		return;
	}

	await startResting(interaction, discordUserId, user, quid, userToServer, quidToServer, server, messageContent, false);
}

// This is either called from above or from the interval
export async function startResting(
	interaction: RepliableInteraction<'cached'> | undefined,
	discordUserId: string,
	user: User,
	quid: Quid,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	server: Server,
	messageContent: string,
	isAutomatic: boolean,
) {

	const component = new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId(`user-settings_reminders_resting_${user.reminders_resting === true ? 'off' : 'on'}_@${user.id}`)
			.setLabel(`Turn automatic resting pings ${user.reminders_resting === true ? 'off' : 'on'}`)
			.setStyle(ButtonStyle.Secondary));
	const prePreviousRegionText = 'You are now at the ';

	let botReply: Message<boolean>;
	let previousRegion: CurrentRegionType;
	let weardownText: string;
	let energyPoints: number;
	if (userToServer.resting_messageId && userToServer.resting_channelId) {

		const channel = await client.channels.fetch(userToServer.resting_channelId);
		if (!channel || !channel.isTextBased() || channel.type === ChannelType.GuildStageVoice) { throw new TypeError('channel is not TextBasedChannel'); }
		botReply = await channel.messages.fetch(userToServer.resting_messageId);

		const embedFooterLines = botReply.embeds[0]?.footer?.text.split('\n');
		isAutomatic = embedFooterLines?.[1]?.includes('inactive') === true || embedFooterLines?.[2]?.includes('inactive') === true;
		previousRegion = (embedFooterLines?.[1]?.startsWith(prePreviousRegionText) === true) ? embedFooterLines[1].replace(prePreviousRegionText, '') as CurrentRegionType : quidToServer.currentRegion;
		weardownText = embedFooterLines?.[embedFooterLines.length - 3] ?? '';
		energyPoints = Number(embedFooterLines?.[0]?.split(' ')[0]?.replace('+', '') ?? '0');
	}
	else {

		previousRegion = quidToServer.currentRegion;
		weardownText = await wearDownDen(server, CurrentRegionType.SleepingDens);
		energyPoints = 0;

		await user.update({ advice_resting: true });
		await quidToServer.update({ currentRegion: CurrentRegionType.SleepingDens });

		const messageOptions = {
			content: messageContent,
			embeds: [await getRestingEmbed(quid, quidToServer, { serverId: server.id, userToServer, quidToServer, user }, energyPoints, prePreviousRegionText, previousRegion, isAutomatic, weardownText)],
			components: isAutomatic ? [component] : [],
		};

		if (interaction !== undefined) {

			// This is always a reply, except if it's from the button from the travel-regions command (aka, a button and non-automatic), in which case it's an update to the message with the button
			const shouldUpdate = interaction.isButton() && isAutomatic === false;
			botReply = await respond(interaction, { ...messageOptions, fetchReply: true }, shouldUpdate ? 'update' : 'reply', (shouldUpdate && interaction.isMessageComponent()) ? interaction.message.id : undefined);
		}
		else if (userToServer.lastInteraction_channelId) {

			const channel = await client.channels.fetch(userToServer.lastInteraction_channelId);
			if (!channel || !channel.isTextBased() || channel.type === ChannelType.GuildStageVoice) { throw new TypeError('channel is not TextBasedChannel'); }
			botReply = await channel.send(messageOptions);
		}
		else {

			throw new Error('Resting could not be started because no messageId and/or channelId of an existing message have been logged, interaction is undefined and lastInteractionChannelId is null');
		}

		await userToServer.update({ resting_channelId: botReply.channelId, resting_messageId: botReply.id });
	}

	// This is just a safety net to make absolutely sure that no two restingIntervals are running at the same time
	clearInterval(restingIntervalMap.get(user.id + quidToServer.serverId));
	restingIntervalMap.delete(user.id + quidToServer.serverId);

	const intervalId = setInterval(async function(): Promise<void> {
		try {

			energyPoints += 1;

			await quidToServer.update({ energy: quidToServer.energy + 1 });

			const embed = await getRestingEmbed(quid, quidToServer, { serverId: server.id, userToServer, quidToServer, user }, energyPoints, prePreviousRegionText, previousRegion, isAutomatic, weardownText);
			await botReply.edit({ // TO DO: At a later point, this and botReply.delete() could check if there is an interaction or lastInteractionToken and whether it's not older than 15 minutes, than edit/delete based off of that and do this as backup if not or if there is an error
				embeds: [embed],
			});

			/* It checks if the user has reached their maximum energy, and if they have, it stops the resting process. */
			if (quidToServer.energy >= quidToServer.maxEnergy) {

				stopResting(userToServer);
				await quidToServer.update({ currentRegion: previousRegion });

				await botReply.delete();

				if (botReply.channel.type === ChannelType.GuildStageVoice) { return; }
				await botReply.channel.send({
					content: user.reminders_resting ? (interaction?.user.toString() || `<@${discordUserId}>`) : undefined,
					embeds: [embed.setDescription(`*${quid.name}'s eyes blink open, ${pronounAndPlural(quid, 0, 'sit')} up to stretch and then walk out into the light and buzz of late morning camp. Younglings are spilling out of the nursery, ambitious to start the day, Hunters and Healers are traveling in and out of the camp border. It is the start of the next good day!*`)],
					components: isAutomatic ? [component] : [],
				});
				return;
			}
			return;
		}
		catch (error) {

			stopResting(userToServer);
			clearInterval(intervalId); // This is another safety net to make sure that an infinite loop doesn't happen, so the interval ID of this exact interval is saved seperately and cleared here
			if (interaction !== undefined) {

				await sendErrorMessage(interaction, error)
					.catch(e => { console.error(e); });
			}
			else { console.error(error); }
		}
	}, 30_000 + await getExtraRestingTime(server));
	restingIntervalMap.set(user.id + quidToServer.serverId, intervalId);
}

/**
 * This function returns an embed builder object that contains the embed for the resting command.
 * @param {Quid} quidData - Quid - The quid data object
 * @param {number} energyPoints - The amount of energy points you want to give the user
 * @param {Profile} profileData - Profile - The profile of the user who is resting
 * @param {CurrentRegionType} previousRegion - CurrentRegionType
 * @param {boolean} isAutomatic - boolean - Whether or not the quid is resting because the user was inactive for 10 minutes
 * @param {string} weardownText - This is the text that shows up at the bottom of the embed. It's a string that's generated by the weardown function.
 * @returns A function that returns an embed builder
 */
async function getRestingEmbed(
	quid: Quid,
	quidToServer: QuidToServer,
	displaynameOptions: Parameters<typeof getDisplayname>[1],
	energyPoints: number,
	prePreviousRegionText: string,
	previousRegion: CurrentRegionType,
	isAutomatic: boolean,
	weardownText: string,
): Promise<EmbedBuilder> {

	return new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, displaynameOptions),
			iconURL: quid.avatarURL,
		})
		.setDescription(`*${quid.name}'s chest rises and falls with the crickets. Snoring bounces off each wall, finally exiting the den and rising free to the clouds.*`)
		.setFooter({ text: `+${energyPoints} energy (${quidToServer.energy}/${quidToServer.maxEnergy})${(previousRegion !== CurrentRegionType.SleepingDens) ? `\n${prePreviousRegionText}sleeping dens` : ''}${isAutomatic ? '\nYour quid started resting because you were inactive for 10 minutes' : ''}\n\n${weardownText}\n\nTip: You can also do "/vote" to get +30 energy per vote!` });
}

/**
 * Clears the timeout of the specific user that is resting.
 */
export function stopResting(
	userToServer: UserToServer,
): void {

	userToServer.update({ resting_channelId: null, resting_messageId: null });

	clearInterval(restingIntervalMap.get(userToServer.userId + userToServer.serverId));
	restingIntervalMap.delete(userToServer.userId + userToServer.serverId);
}

/**
 * Returns true if the user is resting, false otherwise
 * @param {string} _id - The _id of the player.
 * @param {string} guildId - The ID of the guild the user is in.
 * @returns A boolean value.
 */
export function isResting(
	userToServer: UserToServer,
): boolean { return restingIntervalMap.has(userToServer.userId + userToServer.serverId); }

/**
 * It gets the server's den stats, calculates a multiplier based on those stats, and returns the
 * difference between 30,000 and 30,000 times the multiplier
 * @param guildId - The ID of the guild that the command was executed in.
 * @returns {Promise<number>} the amount of time in milliseconds that the user will be resting for.
 */
async function getExtraRestingTime(
	server: Server,
): Promise<number> {

	const sleepinDen = await Den.findByPk(server.sleepingDenId, { rejectOnEmpty: true });
	const denStats = sleepinDen.structure + sleepinDen.bedding + sleepinDen.thickness + sleepinDen.evenness;
	const multiplier = denStats / 400;
	return 30_000 - Math.round(30_000 * multiplier);
}