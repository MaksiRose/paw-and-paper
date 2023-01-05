import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getMessageId, respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typings/handle';
const { error_color, default_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('avatar')
		.setDescription('Choose an avatar for your quid.')
		.toJSON(),
	category: 'page1',
	position: 3,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		if (!hasName(userData, interaction)) { return; } // This is always a reply

		const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);
		if (channel === null) { throw new TypeError('channel is null'); }
		if (!channel.isTextBased()) { throw new TypeError('channel is not text based'); }

		// This is always a reply
		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setDescription('Please upload an image to this channel within the next 60 seconds to set as your quids avatar!')],
		});

		await channel
			.awaitMessages({
				filter: m => Object.keys(userData.userIds).includes(m.author.id) && m.attachments.size > 0,
				time: 60_000,
				max: 1,
				errors: ['time'],
			})
			.then(async function(collected) {

				const message = collected.first();
				if (!message) { throw new Error('time'); }

				const attachment = message.attachments.first();
				if (!attachment) { throw new Error('time'); }

				/* Checking if the image is a .png, .jpeg, .jpg, .raw or .webp image. If it is not, it will send an error message. */
				const imageURL = attachment.url;
				if (!imageURL.endsWith('.png') && !imageURL.endsWith('.jpeg') && !imageURL.endsWith('.jpg') && !imageURL.endsWith('.raw') && !imageURL.endsWith('.webp')) {

					// This is always a followUp
					await respond(interaction, {
						embeds: [new EmbedBuilder()
							.setColor(error_color)
							.setTitle('This image extension is not supported! Please send a .png, .jp(e)g, .raw or .webp image.')],
						ephemeral: true,
					});
					return;
				}

				await userData.update(
					(u) => {
						const q = getMapData(u.quids, getMapData(u.servers, interaction.guildId || 'DMs').currentQuid ?? '');
						q.avatarURL = imageURL;
					},
				);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(userData.quid.color)
						.setAuthor({ name: userData.quid.getDisplayname(), iconURL: imageURL })
						.setTitle(`Profile picture for ${userData.quid.name} set!`)
						.setImage(imageURL)],
				});
			})
			.catch(async function() {

				// This is always an editReply
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('An image has not been uploaded to this channel in time!')],
					ephemeral: true,
				}, 'reply', getMessageId(botReply));
			});
	},
};