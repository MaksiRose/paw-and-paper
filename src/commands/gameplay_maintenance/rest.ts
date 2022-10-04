import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, RepliableInteraction, SlashCommandBuilder } from 'discord.js';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { CurrentRegionType, Profile, Quid, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { hasCooldown, isPassedOut } from '../../utils/checkValidity';
import { pronoun, pronounAndPlural, upperCasePronoun } from '../../utils/getPronouns';
import { getMapData, getQuidDisplayname, respond, sendErrorMessage } from '../../utils/helperFunctions';
import { wearDownDen } from '../../utils/wearDownDen';
import { remindOfAttack } from '../gameplay_primary/attack';

const restingIntervalMap: Map<string, NodeJS.Timeout> = new Map();

const name: SlashCommand['name'] = 'rest';
const description: SlashCommand['description'] = 'Get some sleep and fill up your energy meter. Takes some time to refill.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (client, interaction, userData, serverData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasName(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);
		if (!hasSpecies(interaction, quidData)) { return; }

		/* Checks if the profile is on a cooldown or passed out. */
		if (await isPassedOut(interaction, userData, quidData, profileData, false)) { return; }
		if (await hasCooldown(interaction, userData, quidData)) { return; }

		await startResting(interaction, userData, quidData, profileData, serverData);
	},
};

export async function startResting(
	interaction: RepliableInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid<true>,
	profileData: Profile,
	serverData: ServerSchema,
) {

	const messageContent = remindOfAttack(interaction.guildId);

	if (profileData.isResting === true || isResting(userData._id, profileData.serverId)) {

		await respond(interaction, {
			content: messageContent,
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} dreams of resting on a beach, out in the sun. The imaginary wind rocked the also imaginative hammock. ${upperCasePronoun(quidData, 0)} must be really tired to dream of sleeping!*`),
			],
		}, false);
		return;
	}

	if (profileData.energy >= profileData.maxEnergy) {

		await respond(interaction, {
			content: messageContent,
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} trots around the dens eyeing ${pronoun(quidData, 2)} comfortable moss-covered bed. A nap looks nice, but ${pronounAndPlural(quidData, 0, 'has', 'have')} far too much energy to rest!*`),
			],
		}, false);
		return;
	}

	const previousRegion = profileData.currentRegion;

	await userModel.findOneAndUpdate(
		u => u._id === userData._id,
		(u) => {
			const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
			p.isResting = true;
			p.currentRegion = CurrentRegionType.SleepingDens;
			u.advice.resting = true;
		},
	);

	const isAutomatic = !interaction.isCommand() || interaction.commandName !== name;

	const weardownText = await wearDownDen(serverData, CurrentRegionType.SleepingDens);
	let energyPoints = 0;

	const component = new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId(`settings_reminders_resting_${userData.settings.reminders.resting === true ? 'off' : 'on'}`)
			.setLabel(`Turn automatic resting pings ${userData.settings.reminders.resting === true ? 'off' : 'on'}`)
			.setStyle(ButtonStyle.Secondary));

	const botReply = await respond(interaction, {
		content: messageContent,
		embeds: [getRestingEmbed(userData, quidData, energyPoints, profileData, previousRegion, isAutomatic, weardownText)],
		components: isAutomatic ? [component] : [],
	}, false);

	restingIntervalMap.set(userData._id + interaction.guildId, setInterval(async function(): Promise<void> {
		try {

			energyPoints += 1;

			userData = await userModel.findOneAndUpdate(
				u => u._id === userData._id,
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
					p.energy += 1;
				},
			);
			quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
			profileData = getMapData(quidData.profiles, interaction.guildId);

			const embed = getRestingEmbed(userData, quidData, energyPoints, profileData, previousRegion, isAutomatic, weardownText);
			await botReply.edit({
				embeds: [embed],
			});

			/* It checks if the user has reached their maximum energy, and if they have, it stops the resting process. */
			if (profileData.energy >= profileData.maxEnergy) {

				userData = await userModel.findOneAndUpdate(
					u => u._id === userData._id,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.isResting = false;
						p.currentRegion = previousRegion;
					},
				);

				await botReply.delete();

				await botReply.channel.send({
					content: userData.settings.reminders.resting ? interaction.user.toString() : undefined,
					embeds: [embed.setDescription(`*${quidData.name}'s eyes blink open, ${pronounAndPlural(quidData, 0, 'sit')} up to stretch and then walk out into the light and buzz of late morning camp. Younglings are spilling out of the nursery, ambitious to start the day, Hunters and Healers are traveling in and out of the camp border. It is the start of the next good day!*`)],
					components: isAutomatic ? [component] : [],
				});

				stopResting(userData._id, interaction.guildId);
				return;
			}
			return;
		}
		catch (error) {

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
	userData: UserSchema,
	quidData: Quid<true>,
	energyPoints: number,
	profileData: Profile,
	previousRegion: CurrentRegionType,
	isAutomatic: boolean,
	weardownText: string,
): EmbedBuilder {

	return new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: getQuidDisplayname(userData, quidData, profileData.serverId), iconURL: quidData.avatarURL })
		.setDescription(`*${quidData.name}'s chest rises and falls with the crickets. Snoring bounces off each wall, finally exiting the den and rising free to the clouds.*`)
		.setFooter({ text: `+${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${(previousRegion !== CurrentRegionType.SleepingDens) ? '\nYou are now at the sleeping dens' : ''}${isAutomatic ? '\nYour quid started resting because you were inactive for 10 minutes' : ''}\n\n${weardownText}\n\nTip: You can also do "/vote" to get +30 energy per vote!` });
}

/**
 * Clears the timeout of the specific user that is resting.
 */
export function stopResting(
	_id: string,
	guildId: string,
): void {

	clearInterval(restingIntervalMap.get(_id + guildId));
	restingIntervalMap.delete(_id + guildId);
}

/**
 * Returns true if the user is resting, false otherwise
 * @param {string} _id - The _id of the player.
 * @param {string} guildId - The ID of the guild the user is in.
 * @returns A boolean value.
 */
export function isResting(
	_id: string,
	guildId: string,
): boolean { return restingIntervalMap.has(_id + guildId); }

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