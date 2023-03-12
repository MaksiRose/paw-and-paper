import { ChannelType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getMessageId, respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { SlashCommand } from '../../typings/handle';
import Quid from '../../models/quid';
import DiscordUser from '../../models/discordUser';
import { getDisplayname } from '../../utils/getQuidInfo';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (!hasName(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);
		if (channel === null) { throw new TypeError('channel is null'); }
		if (!channel.isTextBased()) { throw new TypeError('channel is not text based'); }
		if (channel.type === ChannelType.GuildStageVoice) { throw new Error('discord.js is janky'); }

		// This is always a reply
		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setDescription('Please upload an image to this channel within the next 60 seconds to set as your quids avatar!')],
		});

		const discordUserIds = (await DiscordUser.findAll({ where: { userId: user.id } })).map(du => du.id);
		await channel
			.awaitMessages({
				filter: m => discordUserIds.includes(m.author.id) && m.attachments.size > 0,
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

				await quid.update({ avatarURL: imageURL });

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(quid.color)
						.setAuthor({
							name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
							iconURL: quid.avatarURL,
						})
						.setTitle(`Profile picture for ${quid.name} set!`)
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