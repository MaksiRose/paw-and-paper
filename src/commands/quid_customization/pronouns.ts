import { ActionRowBuilder, EmbedBuilder, ModalBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { addCommasAndAnd, respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import { getDisplayname } from '../../utils/getQuidInfo';
import Quid from '../../models/quid';
const { error_color, default_color } = require('../../../config.json');

type CustomIdArgs = ['selectmodal'] | SelectOptionArgs
type SelectOptionArgs = [`${number}` | 'add' | 'none']

const maxPronounLength = 16;
const maxModalLength = (maxPronounLength * 5) + 8 + 5; // In the modal, the most you can input is 5 pronouns, the word 'singular' plus 5 slashes

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('pronouns')
		.setDescription('Choose the pronouns you are using during roleplay.')
		.toJSON(),
	category: 'page1',
	position: 2,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		// This should always be a reply
		const { id: messageId } = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(`What pronouns does ${quid.name} have?`)
				.setDescription('To change your quids pronouns, select an existing one from the drop-down menu below to edit it, or select "Add another pronoun" to add another one. A pop-up with a text box will open.\n\nTo set the pronouns to they/them for example, type `they/them/their/theirs/themselves/plural`.\nThe 6th spot should be either `singular` ("he/she __is__") or `plural` ("they __are__").\nTo set the pronouns to your own name, you can type `none`.\nTo delete the pronouns, leave the text box empty.\n\nThis is how it would look during roleplay:\n> **They** and the friend that came with **them** laid in **their** den. It was **theirs** because they built it **themselves**. \nYou can use this as reference when thinking about how to add your own (neo-)pronouns.')],
			components: [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([getPronounsMenu(quid)])],
			fetchReply: true,
		});

		if (userToServer) { saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, messageId); }
		return;
	},
	async sendMessageComponentResponse(interaction, { quid }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!hasName(quid) || !customId) { return; } // this would always be a reply

		if (interaction.isStringSelectMenu() && customId.args[0] === 'selectmodal') {

			/* Getting the position of the pronoun in the array, and the existing pronoun in that place */
			const pronounNumber = deconstructSelectOptions<SelectOptionArgs>(interaction)[0]?.[0];
			if (pronounNumber === undefined) { throw new TypeError('pronounNumber is undefined'); }
			const pronounSet = pronounNumber === 'add' ? [] : pronounNumber === 'none' ? ['none'] : (quid.pronouns_en[Number(pronounNumber)]);
			if (pronounSet === undefined) { throw new TypeError('pronounSet is undefined'); }

			/* Getting the remaining length for the pronoun field in the profile command. */
			const pronouns = JSON.parse(JSON.stringify(quid.pronouns_en)) as string[][];
			if (quid.noPronouns_en === true) { pronouns.push(['none']); }
			const profilePronounFieldLengthLeft = 1024 - pronouns.map(pronounSet => pronounSet.length === 1 ? pronounSet[0]! : `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`).join('\n').length;

			const textInput = new TextInputBuilder()
				.setCustomId('pronounInput')
				.setLabel('Text')
				.setStyle(TextInputStyle.Short)
				.setMinLength(pronouns.length > 1 ? 0 : 4)
				// Max Length is either maxModalLength or, if that would exceed the max field value length, make it what is left for a field value length.
				.setMaxLength((profilePronounFieldLengthLeft < maxModalLength) ? profilePronounFieldLengthLeft : maxModalLength)
				.setRequired(pronouns.length < 2 || pronounNumber === 'add');
			if (pronounNumber !== 'add') { textInput.setValue(pronounSet.join('/')); }

			await interaction
				.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid.id, [pronounNumber]))
					.setTitle('Change pronouns')
					.addComponents(new ActionRowBuilder<TextInputBuilder>()
						.setComponents([textInput])),
				);

			// This is always editReply of the message the StringSelectMenu comes from
			await respond(interaction, {
				components: [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([getPronounsMenu(quid)])],
			}, 'update', interaction.message.id);
			return;
		}
	},
	async sendModalResponse(interaction, { quid, user, userToServer, quidToServer }) {

		if (!interaction.isFromMessage()) { return; }
		const customId = deconstructCustomId<SelectOptionArgs>(interaction.customId); // here it is SelectOptionArgs instead of CustomIdArgs because 'selectmodal' is only a customId for the select menu
		if (!hasName(quid) || !customId) { return; } // this would always be a reply

		/* Getting the array position of the pronoun that is being edited, the pronouns that are being set, whether the pronouns are being deleted, and whether the pronouns are being set to none. */
		const pronounNumber = Number(customId.args[0]);
		const chosenPronouns = interaction.fields.getTextInputValue('pronounInput').split('/');
		const willBeDeleted = interaction.fields.getTextInputValue('pronounInput') === '';
		let isNone = false;

		/* If the pronouns won't be deleted, the first chosen pronoun is none and there are no other pronouns chosen, set isNone to true. */
		if (chosenPronouns[0] === 'none' && chosenPronouns.length == 1) { isNone = true; }
		if (customId.args[0] === 'none') { isNone = true; }

		/* Checking if the user has provided the correct amount of arguments. If they haven't, it will send an error message. */
		if (!willBeDeleted && !isNone && chosenPronouns.length !== 6) {

			chosenPronouns.forEach((pronoun, value) => chosenPronouns[value] = `"${pronoun}"`);
			chosenPronouns[chosenPronouns.length - 1] = `and ${chosenPronouns[chosenPronouns.length - 1]}`;

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setDescription(`You provided **${chosenPronouns.length}** arguments: ${addCommasAndAnd(chosenPronouns)}.\nThe first 5 arguments should be of the pronoun you want, and the 6th argument should be either "singular" or "plural".`)],
				ephemeral: true,
			});
			return;
		}

		/* Checking if the 6th spot is either singular or plural. */
		if (!willBeDeleted && !isNone && chosenPronouns[5] !== 'singular' && chosenPronouns[5] !== 'plural') {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setDescription(`For the 6th spot, you wrote "${chosenPronouns[5]}". The 6th spot should be either "singular" or "plural".`)],
				ephemeral: true,
			});
			return;
		}

		/* It checks if the quid already has the pronouns that are being set. */
		if (!willBeDeleted && ((isNone && quid.noPronouns_en) || quid.pronouns_en.map(pronounSet => pronounSet.join('/')).includes(chosenPronouns.join('/')))) {

			// This is always a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setDescription('The quid already has this pronoun!')],
				ephemeral: true,
			});
			return;
		}

		/* Checking if the pronouns are not being deleted, and if the pronouns are not being set to none, and if so, it is checking if the length of each pronoun is between 1 quid and the maximum pronoun length long. If it is not, it will send an error message. */
		if (!willBeDeleted && !isNone) {

			for (const pronoun of chosenPronouns) {

				if (pronoun.length < 1 || pronoun.length > maxPronounLength) {

					// This is always a reply
					await respond(interaction, {
						embeds: [new EmbedBuilder()
							.setColor(error_color)
							.setDescription(`Each pronoun must be between 1 and ${maxPronounLength} characters long.`)],
						ephemeral: true,
					});
					return;
				}
			}
		}

		const oldPronounSet = isNaN(pronounNumber) ? ['none'] : quid.pronouns_en[pronounNumber];

		/* Add the pronouns, send a success message and update the original one. */
		const pronouns = [...quid.pronouns_en];
		if ((willBeDeleted && !isNaN(pronounNumber))) { pronouns.splice(pronounNumber, 1); }
		else if (!isNone && !willBeDeleted) { pronouns[isNaN(pronounNumber) ? pronouns.length : pronounNumber] = chosenPronouns; }

		await quid.update({
			pronouns_en: pronouns,
			noPronouns_en: isNone ? !quid.noPronouns_en : quid.noPronouns_en,
		});

		// This is always an update to the message that the modal is associated with
		await respond(interaction, {
			components: [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([getPronounsMenu(quid)])],
		}, 'update', interaction.message.id);

		const addedOrEditedTo = oldPronounSet === undefined ? 'added pronoun' : `edited pronoun from ${oldPronounSet.join('/')} to`;
		// This is always a followUp
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setTitle(`Successfully ${willBeDeleted ? `deleted pronoun ${oldPronounSet?.join('/')}` : `${addedOrEditedTo} ${chosenPronouns.join('/')}`}!`)],
		});
		return;
	},
};

/** Creating a drop - down menu with all the pronouns the quid has. */
function getPronounsMenu(
	quid: Quid,
): StringSelectMenuBuilder {

	/* Getting the remaining length for the pronoun field in the profile command. */
	const pronouns = JSON.parse(JSON.stringify(quid.pronouns_en)) as string[][];
	if (quid.noPronouns_en === true) { pronouns.push(['none']); }
	const profilePronounFieldLengthLeft = 1024 - pronouns.map(pronounSet => pronounSet.length === 1 ? pronounSet[0]! : `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`).join('\n').length;

	/* Creating the pronouns menu options */
	const pronounsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	quid.pronouns_en.forEach((pronounSet, value) => {

		pronounsMenuOptions.push({
			label: `${pronounSet[0]}/${pronounSet[1]}`,
			description: `(${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]}/${pronounSet[5]})`,
			value: constructSelectOptions<SelectOptionArgs>([`${value}`]),
		});
	});
	if (quid.noPronouns_en) {

		pronounsMenuOptions.push({
			label: 'none',
			description: '(Uses your name instead)',
			value: constructSelectOptions<SelectOptionArgs>(['none']),
		});
	}

	if (pronounsMenuOptions.length < 25 && profilePronounFieldLengthLeft >= 4) {

		pronounsMenuOptions.push({
			label: 'Add another pronoun',
			value: constructSelectOptions<SelectOptionArgs>(['add']),
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid.id, ['selectmodal']))
		.setPlaceholder('Select a pronoun to change')
		.setOptions(pronounsMenuOptions);
}