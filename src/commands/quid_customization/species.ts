import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { capitalize, keyInObject, respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { missingPermissions } from '../../utils/permissionHandler';
import { speciesInfo } from '../..';
import { SpeciesNames } from '../../typings/data/general';
import { SlashCommand } from '../../typings/handle';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import Quid from '../../models/quid';
import { getDisplayname, getDisplayspecies, pronoun } from '../../utils/getQuidInfo';

type CustomIdArgs = ['speciesselect' | 'displayedspeciesmodal'] | []
type SelectOptionArgs = [SpeciesNames] | ['nextpage', `${number}`]

const speciesNameArray = (Object.keys(speciesInfo) as SpeciesNames[]).sort();

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('species')
		.setDescription('Change your quid\'s species or displayed species.')
		.toJSON(),
	category: 'page1',
	position: 1,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		if (!user) { throw new TypeError('user is undefined'); }
		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // this would always be a reply

		/* Define displayed species button */
		const displayedSpeciesButton = getDisplayedSpeciesButton(quid.id);
		/* Define species select menu */
		const speciesMenu = getSpeciesSelectMenu(0, quid.id);

		/* Define embeds */
		const newSpeciesEmbed = new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			})
			.setTitle(`What species is ${quid.name}?`)
			.setDescription('Choosing a species is only necessary for the RPG parts of the bot, and is **permanent**. If you want an earthly, extant species added that is not on the list, [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+) to suggest it. Alternatively, you can choose a species that\'s similar and use the button below to change what species is displayed to be anything you want. You can change the displayed species as many times as you want.');
		const existingSpeciesEmbed = new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			})
			.setDescription(`${quid.name} is a ${getDisplayspecies(quid)}! You cannot change ${pronoun(quid, 2)} species, but you can create another quid via \`/profile\`. Alternatively, you can use the button below to change what species is displayed to be anything you want.`)
			.setFooter({ text: `Here is a list of species that you can choose when making a new quid: ${speciesNameArray.join(', ')}` });

		// This is always a reply
		const botReply = await respond(interaction, {
			embeds: quid.species === null ? [newSpeciesEmbed] : [existingSpeciesEmbed],
			components: [
				...(quid.species === null ? [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([speciesMenu])] : []),
				new ActionRowBuilder<ButtonBuilder>().setComponents([displayedSpeciesButton]),
			],
			fetchReply: true,
		});

		if (userToServer) { saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id); }
	},
	async sendMessageComponentResponse(interaction, { quid, user, userToServer, quidToServer }) {

		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call
		]) === true) { return; }

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!hasName(quid) || !customId) { return; } // this would always be a reply

		if (interaction.isButton() && customId.args[0] === 'displayedspeciesmodal') {

			await interaction
				.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid.id, []))
					.setTitle('Change displayed species')
					.setComponents(
						new ActionRowBuilder<TextInputBuilder>()
							.setComponents([new TextInputBuilder()
								.setCustomId('displayedspecies')
								.setLabel('Displayed species')
								.setStyle(TextInputStyle.Short)
								.setMaxLength(24)
								.setValue(quid.displayedSpecies),
							]),
					),
				);
			return;
		}
		else if (interaction.isButton()) { return; }

		const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
		if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

		if (interaction.isStringSelectMenu() && customId.args[0] === 'speciesselect' && selectOptionId[0] === 'nextpage') {

			/* Getting the speciesPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
			let speciesPage = Number(selectOptionId[1]) + 1;
			if (speciesPage >= Math.ceil(speciesNameArray.length / 24)) { speciesPage = 0; }

			// This should always be an update on the message
			await respond(interaction, {
				components: [
					new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([getSpeciesSelectMenu(speciesPage, customId.executorId)]),
					new ActionRowBuilder<ButtonBuilder>().setComponents([getDisplayedSpeciesButton(customId.executorId)]),
				],
			}, 'update', interaction.message.id);
			return;
		}
		else if (interaction.isStringSelectMenu() && customId.args[0] === 'speciesselect' && keyInObject(speciesInfo, selectOptionId[0])) {

			const chosenSpecies = selectOptionId[0];
			await quid.update({ species: chosenSpecies });

			// This should always be an update on the message
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*A stranger carefully steps over the pack's borders. ${capitalize(pronoun(quid, 2))} face seems friendly. Curious eyes watch ${pronoun(quid, 1)} as ${pronoun(quid, 0)} come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n"${quid.name}," *the ${chosenSpecies} responds. The Alpha takes a friendly step towards ${pronoun(quid, 1)}.* "It's nice to have you here, ${quid.name}," *they say. More and more packmates come closer to greet the newcomer.*`)
					.setFooter({ text: 'You are now done setting up your quid for RPGing! Type "/profile" to look at it.\nWith "/help" you can see how else you can customize your profile, as well as your other options.\nYou can use the button below to change your displayed species.' })],
				components: [
					new ActionRowBuilder<ButtonBuilder>().setComponents([getDisplayedSpeciesButton(customId.executorId)]),
				],
			}, 'update', interaction.message.id);

			// This should always be a followUp
			await respond(interaction, {
				content: `${interaction.user.toString()} ❓ **Tip:**\nGo playing via \`/play\` to find quests and rank up!`,
			});
			return;
		}
	},
	async sendModalResponse(interaction, { quid, user, userToServer, quidToServer }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!hasName(quid) || !customId) { return; } // this would always be a reply

		const displayedSpecies = interaction.fields.getTextInputValue('displayedspecies');

		await quid.update({ displayedSpecies: displayedSpecies });

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(displayedSpecies === '' ? 'Successfully removed your displayed species!' : `Successfully changed displayed species to ${displayedSpecies}!`)],
		});
		return;

	},
};

function getSpeciesSelectMenu(page: number, quidId: string): StringSelectMenuBuilder {

	let speciesMenuOptions: RestOrArray<SelectMenuComponentOptionData> = speciesNameArray.map(speciesName => ({
		label: speciesName,
		value: constructSelectOptions<SelectOptionArgs>([speciesName]),
	}));

	if (speciesMenuOptions.length > 25) {

		speciesMenuOptions = speciesMenuOptions.splice(page * 24, 24);
		speciesMenuOptions.push({
			label: 'Show more species options',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${page}`]),
			description: `You are currently on page ${page + 1}`, emoji: '📋',
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quidId, ['speciesselect']))
		.setPlaceholder('Select a species')
		.setOptions(speciesMenuOptions);
}

function getDisplayedSpeciesButton(quidId: string): ButtonBuilder {

	return new ButtonBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quidId, ['displayedspeciesmodal']))
		.setLabel('Change displayed species')
		.setEmoji('📝')
		.setStyle(ButtonStyle.Secondary);
}