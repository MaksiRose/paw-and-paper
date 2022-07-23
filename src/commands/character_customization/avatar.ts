import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkAccountCompletion';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'avatar';
const description: SlashCommand['description'] = 'Choose an avatar for your character.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addAttachmentOption(option =>
			option.setName('picture')
				.setDescription('The picture that you want the avatar to be')
				.setRequired(true))
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction, userData) => {

		if (!hasName(interaction, userData)) { return; }

		/* Checking if the user has sent an attachment. If they have not, it will send an error message. */
		const attachment = interaction.options.getAttachment('picture');
		if (!attachment) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please send an image to set as your characters profile picture!')],
				ephemeral: true,
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		/* Checking if the image is a .png, .jpeg, .jpg, .raw or .webp image. If it is not, it will send an error message. */
		const imageURL = attachment.url;
		if (!imageURL.endsWith('.png') && !imageURL.endsWith('.jpeg') && !imageURL.endsWith('.jpg') && !imageURL.endsWith('.raw') && !imageURL.endsWith('.webp')) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('This image extension is not supported! Please send a .png, .jp(e)g, .raw or .webp image.')],
				ephemeral: true,
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userData?.uuid,
			(u) => {
				u.characters[u.currentCharacter[interaction.guildId || 'DM']].avatarURL = imageURL;
			},
		);
		const characterData = userData.characters[userData.currentCharacter[interaction.guildId || 'DM']];

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(characterData.color)
				.setAuthor({ name: characterData.name, iconURL: imageURL })
				.setTitle(`Profile picture for ${characterData.name} set!`)
				.setImage(imageURL)],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	},
};