import { Octokit } from '@octokit/rest';
import { EmbedBuilder, SlashCommandBuilder, Team, User, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ModalMessageModalSubmitInteraction, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { respond, update } from '../../utils/helperFunctions';
import { CustomClient, SlashCommand } from '../../typedef';
import { disableAllComponents } from '../../utils/componentDisabling';
import { generateId } from 'crystalid';
import { readFileSync, writeFileSync } from 'fs';
const { error_color, default_color, github_token, ticket_channel_id } = require('../../../config.json');

const name: SlashCommand['name'] = 'ticket';
const description: SlashCommand['description'] = 'Report a bug, give feedback, suggest a feature!';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
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
	disablePreviousCommand: false,
	sendCommand: async (client, interaction) => {

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

		await createNewTicket(client, interaction, title, description, label, attachmentURL, ticketId);
	},
};

export async function createNewTicket(
	client: CustomClient,
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
		.setAuthor({ name: interaction.user.tag })
		.setTitle(title)
		.setDescription(description)
		.setImage(attachmentURL)
		.setFooter({ text: label });

	/* Sending the ticket to the dedicated channel */
	const ticketChannel = await async function() {

		const serverChannel = await client.channels
			.fetch(ticket_channel_id)
			.catch(() => { return null; });

		if (serverChannel !== null && serverChannel.isTextBased() && !serverChannel.isDMBased() && serverChannel.guild.members.me?.permissionsIn(serverChannel.id).has('ViewChannel') && serverChannel.guild.members.me?.permissionsIn(serverChannel.id).has('SendMessages')) { return serverChannel; }

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
					.setCustomId(`ticket_approve_ANYONECANCLICK_${ticketId}`)
					.setLabel('Approve')
					.setStyle(ButtonStyle.Success),
				getRespondButton(true, interaction.user.id, ticketId, true),
				new ButtonBuilder()
					.setCustomId('ticket_reject_ANYONECANCLICK')
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

export async function ticketInteractionCollector(
	interaction: ButtonInteraction,
): Promise<void> {

	if (interaction.customId.includes('contact')) {

		if (interaction.customId.includes('user')) {

			const userId = interaction.customId.split('_')[3]?.replace('user', '') || '';

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
				.setCustomId(`ticket_respond_${interaction.customId.replace('ticket_contact_ANYONECANCLICK_', '')}`)
				.setTitle('Respond')
				.setComponents(
					new ActionRowBuilder<TextInputBuilder>()
						.setComponents([new TextInputBuilder()
							.setCustomId('ticket_textinput')
							.setLabel('Message Text')
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true),
						]),
				),
			);
		return;
	}

	if (interaction.customId.includes('approve')) {

		const embed = interaction.message.embeds[0];
		const ticketId = interaction.customId.split('_')[3];
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
				body: `Created by: ${interaction.user.tag} (${interaction.user.id})\n\n${embed?.description}\n\n${embed?.image ? `![](${embed.image?.url})` : ''}\n\n${ticketConversation ? `Additional conversation:\n\`\`\`\n${ticketConversation}\n\`\`\`` : ''}`,
				labels: embed?.footer ? [embed.footer.text] : [],
			});
	}

	await update(interaction, {
		components: disableAllComponents(interaction.message.components),
	});
}

export async function sendRespondToTicketModalResponse(
	interaction: ModalMessageModalSubmitInteraction,
): Promise<void> {

	const args = interaction.customId.replace('ticket_respond_', '').split('_');
	const userOrChannelId = args[0];
	const ticketId = args[1];
	const fromAdmin = args[2] === 'true';
	if (userOrChannelId === undefined) { throw new TypeError('userOrChannelId is undefined'); }
	if (ticketId === undefined) { throw new TypeError('ticketId is undefined'); }

	const messageText = interaction.fields.getTextInputValue('ticket_textinput');

	let ticketConversation = readFileSync(`./database/open_tickets/${ticketId}.txt`, 'utf-8');
	ticketConversation += `\n\n${fromAdmin ? 'ADMIN:' : 'USER:'} ${messageText}`;
	writeFileSync(`./database/open_tickets/${ticketId}.txt`, ticketConversation);

	await respond(interaction, {
		content: `**You replied:**\n>>> ${messageText}`,
		files: [new AttachmentBuilder(`./database/open_tickets/${ticketId}.txt`)
			.setName('ticketConversation.txt')],
	}, false);

	const respondChannel = await async function() {

		if (userOrChannelId.startsWith('user')) {

			const userId = userOrChannelId.replace('user', '');
			const user = await interaction.client.users.fetch(userId);
			return await user.createDM();
		}
		else if (userOrChannelId.startsWith('channel')) {

			const channelId = userOrChannelId.replace('channel', '');
			const serverChannel = await interaction.client.channels.fetch(channelId);
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
}

export function getRespondButton(
	isUser: boolean,
	id: string,
	ticketId: string,
	fromAdmin: boolean,
): ButtonBuilder {

	return new ButtonBuilder()
		.setCustomId(`ticket_contact_ANYONECANCLICK_${isUser ? 'user' : 'channel'}${id}_${ticketId}_${fromAdmin}`)
		.setLabel('Reply')
		.setStyle(ButtonStyle.Secondary);
}