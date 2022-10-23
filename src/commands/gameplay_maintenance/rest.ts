import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, RepliableInteraction, SlashCommandBuilder } from 'discord.js';
import serverModel from '../../models/serverModel';
import { ServerSchema } from '../../typings/data/server';
import { CurrentRegionType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasCooldown, isPassedOut } from '../../utils/checkValidity';
import { capitalizeString, getMapData, respond, sendErrorMessage } from '../../utils/helperFunctions';
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
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

		/* Checks if the profile is on a cooldown or passed out. */
		if (await isPassedOut(interaction, userData, false)) { return; }
		if (await hasCooldown(interaction, userData)) { return; }

		await startResting(interaction, userData, serverData);
	},
};

export async function startResting(
	interaction: RepliableInteraction<'cached'>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
) {

	if (await missingPermissions(interaction, [
		'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call
	]) === true) { return; }

	const messageContent = remindOfAttack(interaction.guildId);

	if (userData.quid.profile.isResting === true || isResting(userData)) {

		await respond(interaction, {
			content: messageContent,
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${capitalizeString(userData.quid.pronoun(0))} must be really tired to dream of sleeping!*`),
			],
		}, false);
		return;
	}

	if (userData.quid.profile.energy >= userData.quid.profile.maxEnergy) {

		await respond(interaction, {
			content: messageContent,
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} trots around the dens eyeing ${userData.quid.pronoun(2)} comfortable moss-covered bed. A nap looks nice, but ${userData.quid.pronounAndPlural(0, 'has', 'have')} far too much energy to rest!*`),
			],
		}, false);
		return;
	}

	const previousRegion = userData.quid.profile.currentRegion;

	await userData.update(
		(u) => {
			const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
			p.isResting = true;
			p.currentRegion = CurrentRegionType.SleepingDens;
			u.advice.resting = true;
		},
	);

	const isAutomatic = !interaction.isCommand() || interaction.commandName !== command.data.name;

	const weardownText = await wearDownDen(serverData, CurrentRegionType.SleepingDens);
	let energyPoints = 0;

	const component = new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId(`settings_reminders_resting_${userData.settings.reminders.resting === true ? 'off' : 'on'}_@${userData._id}`)
			.setLabel(`Turn automatic resting pings ${userData.settings.reminders.resting === true ? 'off' : 'on'}`)
			.setStyle(ButtonStyle.Secondary));

	const botReply = await respond(interaction, {
		content: messageContent,
		embeds: [getRestingEmbed(userData, energyPoints, previousRegion, isAutomatic, weardownText)],
		components: isAutomatic ? [component] : [],
	}, false);

	restingIntervalMap.set(userData._id + interaction.guildId, setInterval(async function(): Promise<void> {
		try {

			energyPoints += 1;

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
					p.energy += 1;
				},
			);

			const embed = getRestingEmbed(userData, energyPoints, previousRegion, isAutomatic, weardownText);
			await botReply.edit({
				embeds: [embed],
			});

			/* It checks if the user has reached their maximum energy, and if they have, it stops the resting process. */
			if (userData.quid.profile.energy >= userData.quid.profile.maxEnergy) {

				await userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.isResting = false;
						p.currentRegion = previousRegion;
					},
				);

				await botReply.delete();

				await botReply.channel.send({
					content: userData.settings.reminders.resting ? interaction.user.toString() : undefined,
					embeds: [embed.setDescription(`*${userData.quid.name}'s eyes blink open, ${userData.quid.pronounAndPlural(0, 'sit')} up to stretch and then walk out into the light and buzz of late morning camp. Younglings are spilling out of the nursery, ambitious to start the day, Hunters and Healers are traveling in and out of the camp border. It is the start of the next good day!*`)],
					components: isAutomatic ? [component] : [],
				});

				stopResting(userData);
				return;
			}
			return;
		}
		catch (error) {

			stopResting(userData);
			await sendErrorMessage(interaction, error)
				.catch(e => { console.error(e); });
		}
	}, 30_000 + await getExtraRestingTime(interaction.guildId)));
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
	previousRegion: CurrentRegionType,
	isAutomatic: boolean,
	weardownText: string,
): EmbedBuilder {

	return new EmbedBuilder()
		.setColor(userData.quid.color)
		.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
		.setDescription(`*${userData.quid.name}'s chest rises and falls with the crickets. Snoring bounces off each wall, finally exiting the den and rising free to the clouds.*`)
		.setFooter({ text: `+${energyPoints} energy (${userData.quid.profile.energy}/${userData.quid.profile.maxEnergy})${(previousRegion !== CurrentRegionType.SleepingDens) ? '\nYou are now at the sleeping dens' : ''}${isAutomatic ? '\nYour quid started resting because you were inactive for 10 minutes' : ''}\n\n${weardownText}\n\nTip: You can also do "/vote" to get +30 energy per vote!` });
}

/**
 * Clears the timeout of the specific user that is resting.
 */
export function stopResting(
	userData: UserData<never, never>,
): void {

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