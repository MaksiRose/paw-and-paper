import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { reply } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typings/handle';
const { error_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('avatar')
		.setDescription('Choose an avatar for your quid.')
		.addAttachmentOption(option =>
			option.setName('picture')
				.setDescription('The picture that you want the avatar to be')
				.setRequired(true))
		.toJSON(),
	category: 'page1',
	position: 3,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		if (!hasName(userData, interaction)) { return; }

		/* Checking if the user has sent an attachment. If they have not, it will send an error message. */
		const attachment = interaction.options.getAttachment('picture');
		if (!attachment) {

			await reply(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please send an image to set as your quids avatar!')],
				ephemeral: true,
			}, false);
			return;
		}

		/* Checking if the image is a .png, .jpeg, .jpg, .raw or .webp image. If it is not, it will send an error message. */
		const imageURL = attachment.url;
		if (!imageURL.endsWith('.png') && !imageURL.endsWith('.jpeg') && !imageURL.endsWith('.jpg') && !imageURL.endsWith('.raw') && !imageURL.endsWith('.webp')) {

			await reply(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('This image extension is not supported! Please send a .png, .jp(e)g, .raw or .webp image.')],
				ephemeral: true,
			}, false);
			return;
		}

		await userData.update(
			(u) => {
				const q = getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId || 'DMs'));
				q.avatarURL = imageURL;
			},
		);

		await reply(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: imageURL })
				.setTitle(`Profile picture for ${userData.quid.name} set!`)
				.setImage(imageURL)],
		}, true);
		return;
	},
};