import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { CurrentRegionType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { getMapData, getSmallerNumber, respond, sendErrorMessage, setCooldown } from '../../utils/helperFunctions';
import { getRandomNumber } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';
const { default_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('drink')
		.setDescription('Drink some water and fill up your thirst meter.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page3',
	position: 4,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, userData, serverData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		await sendDrinkMessage(interaction, userData, messageContent, restEmbed);
	},
};

export async function sendDrinkMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
	messageContent: string,
	restEmbed: EmbedBuilder[],
): Promise<void> {

	if (userData.quid.profile.thirst >= userData.quid.profile.maxThirst) {

		// This is a reply if interaction is a ChatInputCommand, and an update if it's a button
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*Water sounds churned in ${userData.quid.name}'s ear, ${userData.quid.pronoun(2)} mouth longing for just one more drink. It seems like ${userData.quid.pronoun(0)} can never be as hydrated as ${userData.quid.pronounAndPlural(0, 'want')}, but  ${userData.quid.pronoun(0)} had plenty of water today.*`)],
		}, 'update', '@original');
		return;
	}

	await setCooldown(userData, interaction.guildId, true);

	const components = [new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId('water')
			.setEmoji('💧')
			.setStyle(ButtonStyle.Primary))];

	// This is a reply if interaction is a ChatInputCommand, and an update if it's a button
	const botReply = await respond(interaction, {
		content: messageContent,
		embeds: [...restEmbed, new EmbedBuilder()
			.setColor(default_color)
			.setDescription('For the next 15 seconds, click the button as many times as you can!')],
		components: components,
	}, 'update', '@original');

	const collector = botReply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 15_000,
		filter: (i => i.customId === 'water' && i.user.id === interaction.user.id),
	});

	collector.on('collect', async (i) => {
		try {

			await i.deferUpdate();
		}
		catch (error) {

			await sendErrorMessage(interaction, error)
				.catch(e => { console.error(e); });
		}
	});

	collector.on('end', async (collected) => {
		try {

			await setCooldown(userData, interaction.guildId, false);

			const thirstPoints = getSmallerNumber(userData.quid.profile.maxThirst - userData.quid.profile.thirst, getRandomNumber(3, collected.size));
			const currentRegion = userData.quid.profile.currentRegion;

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
					p.currentRegion = CurrentRegionType.Lake;
					p.thirst += thirstPoints;
					u.advice.drinking = true;
				},
			);

			// This is a reply if interaction is a ChatInputCommand, and an update if it's a button
			await respond(interaction, {
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*${userData.quid.name} scurries over to the river and takes hasty gulps. The fresh water runs down ${userData.quid.pronoun(2)} throat and fills ${userData.quid.pronoun(2)} body with new energy.*`)
					.setFooter({ text: `+${thirstPoints} thirst (${userData.quid.profile.thirst}/${userData.quid.profile.maxThirst})${(currentRegion !== CurrentRegionType.Lake) ? '\nYou are now at the lake' : ''}\n\nDon't forget to stay hydrated in real life too! :)` })],
				components: disableAllComponents(components),
			}, 'update', '@original');
		}
		catch (error) {

			await sendErrorMessage(interaction, error)
				.catch(e => { console.error(e); });
		}
	});
}