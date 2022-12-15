import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, RepliableInteraction, SlashCommandBuilder } from 'discord.js';
import { client } from '../..';
import serverModel from '../../models/serverModel';
import { ServerSchema } from '../../typings/data/server';
import { CurrentRegionType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasCooldown, isPassedOut } from '../../utils/checkValidity';
import { capitalizeString, getMapData, respond, sendErrorMessage, userDataServersObject } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { wearDownDen } from '../../utils/wearDownDen';
import { remindOfAttack } from '../gameplay_primary/attack';

const restingIntervalMap: Map<string, NodeJS.Timeout> = new Map();

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
	sendCommand: async (interaction, userData, serverData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

		/* Checks if the profile is on a cooldown or passed out. */
		if (await isPassedOut(interaction, userData, false)) { return; }
		if (await hasCooldown(interaction, userData)) { return; }

		await executeResting(interaction, userData, serverData);
	},
};

// This is either called directly via the command, or via the "Rest" button in the travel-regions command
export async function executeResting(
	interaction: RepliableInteraction<'cached'>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
) {

	if (await missingPermissions(interaction, [
		'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call
	]) === true) { return; }

	const messageContent = remindOfAttack(interaction.guildId);

	if (isResting(userData)) {

		// This is an update to the button if the interaction is a button from the travel-regions command, or a reply if the interaction is a ChatInputCommand
		await respond(interaction, {
			content: messageContent,
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${capitalizeString(userData.quid.pronoun(0))} must be really tired to dream of sleeping!*`),
			],
		}, 'update', '@original');
		return;
	}

	if (userData.quid.profile.energy >= userData.quid.profile.maxEnergy) {

		// This is an update to the button if the interaction is a button from the travel-regions command, or a reply if the interaction is a ChatInputCommand
		await respond(interaction, {
			content: messageContent,
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} trots around the dens eyeing ${userData.quid.pronoun(2)} comfortable moss-covered bed. A nap looks nice, but ${userData.quid.pronounAndPlural(0, 'has', 'have')} far too much energy to rest!*`),
			],
		}, 'update', '@original');
		return;
	}

	await startResting(interaction, userData, serverData, messageContent, false);
}

// This is either called from above or from the interval
export async function startResting(
	interaction: RepliableInteraction<'cached'> | undefined,
	userData: UserData<never, never>,
	serverData: ServerSchema,
	messageContent: string,
	isAutomatic: boolean,
) {

	const component = new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId(`settings_reminders_resting_${userData.settings.reminders.resting === true ? 'off' : 'on'}_@${userData._id}`)
			.setLabel(`Turn automatic resting pings ${userData.settings.reminders.resting === true ? 'off' : 'on'}`)
			.setStyle(ButtonStyle.Secondary));
	const prePreviousRegionText = 'You are now at the ';

	let botReply: Message<boolean>;
	let previousRegion: CurrentRegionType;
	let weardownText: string;
	let energyPoints: number;
	if (userData.serverInfo?.restingMessageId && userData.serverInfo?.restingChannelId) {

		const channel = await client.channels.fetch(userData.serverInfo.restingChannelId);
		if (!channel || !channel.isTextBased()) { throw new TypeError('channel is not TextBasedChannel'); }
		botReply = await channel.messages.fetch(userData.serverInfo.restingMessageId);

		const embedFooterLines = botReply.embeds[0]?.footer?.text.split('\n');
		isAutomatic = embedFooterLines?.[1]?.includes('inactive') === true || embedFooterLines?.[2]?.includes('inactive') === true;
		previousRegion = (embedFooterLines?.[1]?.startsWith(prePreviousRegionText) === true) ? embedFooterLines[1].replace(prePreviousRegionText, '') as CurrentRegionType : userData.quid.profile.currentRegion;
		weardownText = embedFooterLines?.[embedFooterLines.length - 3] ?? '';
		energyPoints = Number(embedFooterLines?.[0]?.split(' ')[0]?.replace('+', '') ?? '0');
	}
	else {

		previousRegion = userData.quid.profile.currentRegion;
		weardownText = await wearDownDen(serverData, CurrentRegionType.SleepingDens);
		energyPoints = 0;

		await userData.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.servers, serverData.serverId).currentQuid ?? '').profiles, serverData.serverId);
				p.currentRegion = CurrentRegionType.SleepingDens;
				u.advice.resting = true;
			},
		);

		const messageOptions = {
			content: messageContent,
			embeds: [getRestingEmbed(userData, energyPoints, prePreviousRegionText, previousRegion, isAutomatic, weardownText)],
			components: isAutomatic ? [component] : [],
		};

		if (interaction !== undefined) {

			// This is always a reply, except if it's from the button from the travel-regions command (aka, a button and non-automatic), in which case it's an update to the message with the button
			const shouldUpdate = interaction.isButton() && isAutomatic === false;
			botReply = await respond(interaction, { ...messageOptions, fetchReply: true }, shouldUpdate ? 'update' : 'reply', shouldUpdate ? '@original' : undefined);
		}
		else if (userData.serverInfo?.lastInteractionChannelId) {

			const channel = await client.channels.fetch(userData.serverInfo.lastInteractionChannelId);
			if (!channel || !channel.isTextBased()) { throw new TypeError('channel is not TextBasedChannel'); }
			botReply = await channel.send(messageOptions);
		}
		else {

			throw new Error('Resting could not be started because no messageId and/or channelId of an existing message have been logged, interaction is undefined and lastInteractionChannelId is null');
		}

		await userData.update(
			(u) => {
				u.servers[serverData.serverId] = {
					...userDataServersObject(u, serverData.serverId),
					restingChannelId: botReply.channelId,
					restingMessageId: botReply.id,
				};
			},
		);
	}

	restingIntervalMap.set(userData._id + serverData.serverId, setInterval(async function(): Promise<void> {
		try {

			energyPoints += 1;

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, serverData.serverId).currentQuid ?? '').profiles, serverData.serverId);
					p.energy += 1;
				},
			);

			const embed = getRestingEmbed(userData, energyPoints, prePreviousRegionText, previousRegion, isAutomatic, weardownText);
			await botReply.edit({ // TO DO: At a later point, this and botReply.delete() could check if there is an interaction or lastInteractionToken and whether it's not older than 15 minutes, than edit/delete based off of that and do this as backup if not or if there is an error
				embeds: [embed],
			});

			/* It checks if the user has reached their maximum energy, and if they have, it stops the resting process. */
			if (userData.quid.profile.energy >= userData.quid.profile.maxEnergy) {

				stopResting(userData);
				userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.servers, serverData.serverId).currentQuid ?? '').profiles, serverData.serverId);
						p.currentRegion = previousRegion;
					},
				);

				await botReply.delete();

				await botReply.channel.send({
					content: userData.settings.reminders.resting ? (interaction?.user.toString() || `<@${Object.keys(userData.userIds)[0]}>`) : undefined,
					embeds: [embed.setDescription(`*${userData.quid.name}'s eyes blink open, ${userData.quid.pronounAndPlural(0, 'sit')} up to stretch and then walk out into the light and buzz of late morning camp. Younglings are spilling out of the nursery, ambitious to start the day, Hunters and Healers are traveling in and out of the camp border. It is the start of the next good day!*`)],
					components: isAutomatic ? [component] : [],
				});
				return;
			}
			return;
		}
		catch (error) {

			stopResting(userData);
			if (interaction !== undefined) {

				await sendErrorMessage(interaction, error)
					.catch(e => { console.error(e); });
			}
			else { console.error(error); }
		}
	}, 30_000 + await getExtraRestingTime(serverData.serverId)));
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
function getRestingEmbed(
	userData: UserData<never, never>,
	energyPoints: number,
	prePreviousRegionText: string,
	previousRegion: CurrentRegionType,
	isAutomatic: boolean,
	weardownText: string,
): EmbedBuilder {

	return new EmbedBuilder()
		.setColor(userData.quid.color)
		.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
		.setDescription(`*${userData.quid.name}'s chest rises and falls with the crickets. Snoring bounces off each wall, finally exiting the den and rising free to the clouds.*`)
		.setFooter({ text: `+${energyPoints} energy (${userData.quid.profile.energy}/${userData.quid.profile.maxEnergy})${(previousRegion !== CurrentRegionType.SleepingDens) ? `\n${prePreviousRegionText}sleeping dens` : ''}${isAutomatic ? '\nYour quid started resting because you were inactive for 10 minutes' : ''}\n\n${weardownText}\n\nTip: You can also do "/vote" to get +30 energy per vote!` });
}

/**
 * Clears the timeout of the specific user that is resting.
 */
export function stopResting(
	userData: UserData<never, never>,
): void {

	userData.update(
		(u) => {
			u.servers[userData.quid.profile.serverId] = {
				...userDataServersObject(u, userData.quid.profile.serverId),
				restingChannelId: null,
				restingMessageId: null,
			};
		},
	);

	clearInterval(restingIntervalMap.get(userData._id + userData.quid.profile.serverId));
	restingIntervalMap.delete(userData._id + userData.quid.profile.serverId);
}

/**
 * Returns true if the user is resting, false otherwise
 * @param {string} _id - The _id of the player.
 * @param {string} guildId - The ID of the guild the user is in.
 * @returns A boolean value.
 */
export function isResting(
	userData: UserData<never, never>,
): boolean { return restingIntervalMap.has(userData._id + userData.quid.profile.serverId); }

/**
 * It gets the server's den stats, calculates a multiplier based on those stats, and returns the
 * difference between 30,000 and 30,000 times the multiplier
 * @param guildId - The ID of the guild that the command was executed in.
 * @returns {Promise<number>} the amount of time in milliseconds that the user will be resting for.
 */
async function getExtraRestingTime(
	guildId: string,
): Promise<number> {

	const serverData = await serverModel.findOne(s => s.serverId === guildId);

	const denStats = serverData.dens.sleepingDens.structure + serverData.dens.sleepingDens.bedding + serverData.dens.sleepingDens.thickness + serverData.dens.sleepingDens.evenness;
	const multiplier = denStats / 400;
	return 30_000 - Math.round(30_000 * multiplier);
}