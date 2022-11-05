import { Octokit } from '@octokit/rest';
import { EmbedBuilder, SlashCommandBuilder, Team, User, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { respond, update } from '../../utils/helperFunctions';
import { disableAllComponents } from '../../utils/componentDisabling';
import { generateId } from 'crystalid';
import { readFileSync, writeFileSync } from 'fs';
import { hasPermission } from '../../utils/permissionHandler';
import { client } from '../../client';
import { SlashCommand } from '../../typings/handle';
import { constructCustomId, deconstructCustomId } from '../../utils/customId';
const { error_color, default_color, github_token, ticket_channel_id } = require('../../../config.json');

type CustomIdArgs = ['contact', 'user' | 'channel', string, string, `${boolean}`] | ['reject'] | ['approve', string]

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('ticket')
		.setDescription('Report a bug, give feedback, suggest a feature!')
		.addStringOption(option =>
			option.setName('title')
				.setDescription('Give a short summary of what the ticket is about')
				.setMaxLength(100)
				.setRequired(true))
		.addStringOption(option =>
			option.setName('description')
				.setDescription('Describe the problem in detail')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('label')
				.setDescription('Choose what kind of ticket this is')
				.addChoices(
					{ name: 'Bug', value: 'bug' },
					{ name: 'New Feature/Feedback', value: 'improvement' },
				)
				.setRequired(true))
		.addAttachmentOption(option =>
			option.setName('attachment')
				.setDescription('Optional picture or video to add context'))
		.toJSON(),
	category: 'page5',
	position: 2,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		/* Checking if the ticket is empty. If it is, it will send an error message. */
		const title = interaction.options.getString('title');
		const description = interaction.options.getString('description');
		const label = interaction.options.getString('label');
		const attachmentURL = interaction.options.getAttachment('attachment')?.url || null;
		const ticketId = generateId();

		if (!title || !description || !label) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Your ticket doesn\'t have a title, description and label!')
					.setDescription('Note: To suggest a species [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+).')],
				ephemeral: true,
			}, false);
			return;
		}

		await createNewTicket(interaction, title, description, label, attachmentURL, ticketId);
	},
	async sendMessageComponentResponse(interaction) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!interaction.isButton() || !customId) { return; }
		if (customId.args[0] === 'contact') {

			if (customId.args[1] === 'user') {

				const userId = customId.args[2];

				const user = await interaction.client.users.fetch(userId);
				const dmChannel = await user
					.createDM()
					.catch(error => {
						if (error.status !== 403) { return null; }
						throw error;
					});

				if (!dmChannel) {

					await respond(interaction, {
						content: `The user ${user.tag} doesn't allow DM's. Try sending a friend request or checking if you share a server with them.`,
					}, true);
					return;
				}
			}

			await interaction
				.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, 'EVERYONE', customId.args))
					.setTitle('Respond')
					.setComponents(
						new ActionRowBuilder<TextInputBuilder>()
							.setComponents([new TextInputBuilder()
								.setCustomId('response')
								.setLabel('Message Text')
								.setStyle(TextInputStyle.Paragraph)
								.setRequired(true),
							]),
					),
				);
			return;
		}

		if (customId.args[0] === 'approve') {

			const embed = interaction.message.embeds[0];
			const ticketId = customId.args[1];
			const ticketConversation = readFileSync(`./database/open_tickets/${ticketId}.txt`, 'utf-8');

			const octokit = new Octokit({
				auth: github_token,
				userAgent: 'paw-and-paper',
			});

			await octokit.rest.issues
				.create({
					owner: 'MaksiRose',
					repo: 'paw-and-paper',
					title: embed?.title || 'New issue',
					body: `Created by: ${embed?.author?.name}\n\n${embed?.description}${embed?.image ? `\n![](${embed.image?.url})` : ''}\n\n${ticketConversation ? `Additional conversation:\n\`\`\`\n${ticketConversation}\n\`\`\`` : ''}`,
					labels: embed?.footer ? [embed.footer.text] : [],
				});
		}

		await update(interaction, {
			components: disableAllComponents(interaction.message.components),
		});

	},
	async sendModalResponse(interaction) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!interaction.isFromMessage() || !customId || customId.args[0] !== 'contact') { return; }
		const userOrChannel = customId.args[1];
		const userOrChannelId = customId.args[2];
		const ticketId = customId.args[3];
		const fromAdmin = customId.args[4] === 'true';

		const messageText = interaction.fields.getTextInputValue('response');

		let ticketConversation = readFileSync(`./database/open_tickets/${ticketId}.txt`, 'utf-8');
		ticketConversation += `\n\n${fromAdmin ? 'ADMIN:' : 'USER:'} ${messageText}`;
		writeFileSync(`./database/open_tickets/${ticketId}.txt`, ticketConversation);

		await respond(interaction, {
			content: `**You replied:**\n>>> ${messageText}`,
			files: [new AttachmentBuilder(`./database/open_tickets/${ticketId}.txt`)
				.setName('ticketConversation.txt')],
		}, false);

		const respondChannel = await async function() {

			if (userOrChannel === 'user') {

				const user = await interaction.client.users.fetch(userOrChannelId);
				return await user.createDM();
			}
			else if (userOrChannel === 'channel') {

				const serverChannel = await interaction.client.channels.fetch(userOrChannelId);
				if (serverChannel !== null && serverChannel.isTextBased()) { return serverChannel; }
			}
			throw new Error('Couldn\'t get a channel');
		}();

		await respondChannel
			.send({
				content: `**New response to ticket:**\n>>> ${messageText}`,
				embeds: interaction.message.embeds,
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([getRespondButton(interaction.message.channel.isDMBased(), interaction.message.channel.isDMBased() ? interaction.user.id : interaction.message.channelId, ticketId, !fromAdmin)])],
				files: [new AttachmentBuilder(`./database/open_tickets/${ticketId}.txt`)
					.setName('ticketConversation.txt')],
			});
	},
};

export async function createNewTicket(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	title: string,
	description: string,
	label: string,
	attachmentURL: string | null,
	ticketId: string,
): Promise<void> {

	/* Creating the ticket embed */
	const ticketEmbed = new EmbedBuilder()
		.setColor('#eb6420')
		.setAuthor({ name: `${interaction.user.tag} (${interaction.user.id})` })
		.setTitle(title)
		.setDescription(description)
		.setImage(attachmentURL)
		.setFooter({ text: label });

	/* Sending the ticket to the dedicated channel */
	const ticketChannel = await async function() {

		const serverChannel = await client.channels
			.fetch(ticket_channel_id)
			.catch(() => { return null; });

		if (serverChannel !== null && serverChannel.isTextBased() && !serverChannel.isDMBased() && await hasPermission(serverChannel.guild.members.me ?? serverChannel.client.user.id, serverChannel, 'ViewChannel') && await hasPermission(serverChannel.guild.members.me ?? serverChannel.client.user.id, serverChannel, serverChannel.isThread() ? 'SendMessagesInThreads' : 'SendMessages')) { return serverChannel; }

		let ownerId = '';
		if (client.isReady()) {

			const application = await client.application.fetch();
			if (application.owner instanceof User) { ownerId = application.owner.id; }
			else if (application.owner instanceof Team) { ownerId = application.owner.ownerId || ''; }
		}

		const owner = await client.users.fetch(ownerId);
		const dmChannel = await owner.createDM();
		return dmChannel;
	}();

	await ticketChannel
		.send({
			content: '**New ticket**',
			embeds: [ticketEmbed],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, 'EVERYONE', ['approve', ticketId]))
					.setLabel('Approve')
					.setStyle(ButtonStyle.Success),
				getRespondButton(true, interaction.user.id, ticketId, true),
				new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, 'EVERYONE', ['reject']))
					.setLabel('Reject')
					.setStyle(ButtonStyle.Danger)])],
		});

	/* Creating a text file of the ticket conversation */
	writeFileSync(`./database/open_tickets/${ticketId}.txt`, 'FULL CONVERSATION REGARDING THIS TICKET');

	/* Sending the response to the user. */
	await respond(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setTitle('Thank you for your contribution!')
			.setDescription('You help improve the bot.\nNote: To suggest a species [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+).')
			.setFooter({ text: 'We might need to get in contact with you for clarification regarding your ticket. If we have no way of contacting you (i.e. DMs being closed, not allowing friend requests and not being in the support server), your ticket might not be considered.' }), ticketEmbed],
	}, true);
}

export function getRespondButton(
	isUser: boolean,
	id: string,
	ticketId: string,
	fromAdmin: boolean,
): ButtonBuilder {

	return new ButtonBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, 'EVERYONE', ['contact', isUser ? 'user' : 'channel', id, ticketId, `${fromAdmin}`]))
		.setLabel('Reply')
		.setStyle(ButtonStyle.Secondary);
}