import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getQuidDisplayname, respond } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'avatar';
const description: SlashCommand['description'] = 'Choose an avatar for your quid.';
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
	modifiesServerProfile: false,
	sendCommand: async (client, interaction, userData) => {

		if (!hasName(interaction, userData)) { return; }

		/* Checking if the user has sent an attachment. If they have not, it will send an error message. */
		const attachment = interaction.options.getAttachment('picture');
		if (!attachment) {

			await respond(interaction, {
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

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('This image extension is not supported! Please send a .png, .jp(e)g, .raw or .webp image.')],
				ephemeral: true,
			}, false);
			return;
		}

		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userData?.uuid,
			(u) => {
				const q = getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId || 'DM'));
				q.avatarURL = imageURL;
			},
		);
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: imageURL })
				.setTitle(`Profile picture for ${quidData.name} set!`)
				.setImage(imageURL)],
		}, true);
		return;
	},
};