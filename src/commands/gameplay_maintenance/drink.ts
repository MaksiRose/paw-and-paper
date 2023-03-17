import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CurrentRegionType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { getDisplayname, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { getMessageId, respond, sendErrorMessage, setCooldown } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		await sendDrinkMessage(interaction, user, userToServer, quid, quidToServer, messageContent, restEmbed);
	},
};

export async function sendDrinkMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	user: User,
	userToServer: UserToServer,
	quid: Quid<true>,
	quidToServer: QuidToServer,
	messageContent: string,
	restEmbed: EmbedBuilder[],
): Promise<void> {

	if (quidToServer.thirst >= quidToServer.maxThirst) {

		// This is a reply if interaction is a ChatInputCommand, and an update if it's a button
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*Water sounds churned in ${quid.name}'s ear, ${pronoun(quid, 2)} mouth longing for just one more drink. It seems like ${pronoun(quid, 0)} can never be as hydrated as ${pronounAndPlural(quid, 0, 'want')}, but  ${pronoun(quid, 0)} had plenty of water today.*`)],
		}, 'update', interaction.isButton() ? interaction.message.id : undefined);
		return;
	}

	await setCooldown(userToServer, true);

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
	}, 'update', interaction.isButton() ? interaction.message.id : undefined);

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

			await setCooldown(userToServer, false);

			const thirstPoints = Math.min(quidToServer.maxThirst - quidToServer.thirst, getRandomNumber(3, collected.size));
			const currentRegion = quidToServer.currentRegion;

			await quidToServer.update({ currentRegion: CurrentRegionType.Lake, thirst: quidToServer.thirst + thirstPoints });
			await user.update({ advice_drinking: true });

			// This is an editReply
			await respond(interaction, {
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} scurries over to the river and takes hasty gulps. The fresh water runs down ${pronoun(quid, 2)} throat and fills ${pronoun(quid, 2)} body with new energy.*`)
					.setFooter({ text: `+${thirstPoints} thirst (${quidToServer.thirst}/${quidToServer.maxThirst})${(currentRegion !== CurrentRegionType.Lake) ? '\nYou are now at the lake' : ''}\n\nDon't forget to stay hydrated in real life too! :)` })],
				components: disableAllComponents(components),
			}, 'update', getMessageId(botReply));
		}
		catch (error) {

			await sendErrorMessage(interaction, error)
				.catch(e => { console.error(e); });
		}
	});
}