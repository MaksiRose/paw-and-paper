import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, MessageComponentInteraction, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { CurrentRegionType, Profile, Quid, SlashCommand, UserSchema } from '../../typedef';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { pronoun, pronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getSmallerNumber, respond, sendErrorMessage } from '../../utils/helperFunctions';
import { getRandomNumber } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';
const { default_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'drink';
const description: SlashCommand['description'] = 'Drink some water and fill up your thirst meter.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (!serverData) { throw new Error('serverData is null'); }
		if (!hasCompletedAccount(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		/* Checks if the profile is resting, on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		await sendDrinkMessage(interaction, userData, quidData, profileData, messageContent, embedArray);
	},
};

export async function sendDrinkMessage(
	interaction: ChatInputCommandInteraction<'cached'> | MessageComponentInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	messageContent: string | null,
	embedArray: EmbedBuilder[],
): Promise<void> {

	if (profileData.thirst >= profileData.maxThirst) {

		await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setDescription(`*Water sounds churned in ${quidData.name}'s ear, ${pronoun(quidData, 2)} mouth longing for just one more drink. It seems like ${pronoun(quidData, 0)} can never be as hydrated as ${pronounAndPlural(quidData, 0, 'want')}, but  ${pronoun(quidData, 0)} had plenty of water today.*`)],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	cooldownMap.set(userData.uuid + interaction.guildId, true);

	const botReply = await respond(interaction, {
		content: messageContent,
		embeds: [...embedArray, new EmbedBuilder()
			.setColor(default_color)
			.setDescription('For the next 15 seconds, click the button as many times as you can!')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents(new ButtonBuilder()
				.setCustomId('water')
				.setEmoji('💧')
				.setStyle(ButtonStyle.Primary))],
	}, true)
		.catch((error) => { throw new Error(error); });

	const collector = botReply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 15_000,
		filter: (i => i.customId === 'water' && i.user.id === interaction.user.id),
	});

	collector.on('collect', async (i) => {

		await i.deferUpdate()
			.catch((error) => {
				if (error.httpStatus !== 404) { sendErrorMessage(interaction, error); }
			});
	});

	collector.on('end', async (collected) => {

		cooldownMap.set(userData!.uuid + interaction.guildId, false);

		const thirstPoints = getSmallerNumber(profileData.maxThirst - profileData.thirst, getRandomNumber(3, collected.size));
		const currentRegion = profileData.currentRegion;

		try {

			userData = await userModel
				.findOneAndUpdate(
					u => u.uuid === userData!.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.currentRegion = CurrentRegionType.Lake;
						p.thirst += thirstPoints;
						u.advice.drinking = true;
					},
				);
			quidData = getMapData(userData.quids, getMapData(userData?.currentQuid, interaction.guildId));
			profileData = getMapData(quidData.profiles, interaction.guildId);

			await respond(interaction, {
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} scurries over to the river and takes hasty gulps. The fresh water runs down ${pronoun(quidData, 2)} throat and fills ${pronoun(quidData, 2)} body with new energy.*`)
					.setFooter({ text: `+${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})${(currentRegion !== CurrentRegionType.Lake) ? '\nYou are now at the lake' : ''}\n\nDon't forget to stay hydrated in real life too! :)` })],
				components: disableAllComponents(botReply.components),
			}, true);
		}
		catch (error) {

			await sendErrorMessage(interaction, error);
		}
	});
}