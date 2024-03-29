import { ActionRowBuilder, APIEmbedField, EmbedBuilder, StringSelectMenuBuilder, SlashCommandBuilder, ButtonStyle } from 'discord.js';
import { getArrayElement, respond } from '../../utils/helperFunctions';
import { client, handle, octokit } from '../../cluster';
import { SlashCommand } from '../../typings/handle';
import { ButtonBuilder } from '@discordjs/builders';

const { default_color } = require('../../../config.json');
const { version } = require('../../../package.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Get an explanation of what the bot does and a list of all the commands.')
		.toJSON(),
	category: 'other',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user }) => {

		const tag = `v${version.split('.').slice(0, -1).join('.')}.0`;
		const release = await octokit.rest.repos
			.getReleaseByTag({
				owner: 'MaksiRose',
				repo: 'paw-and-paper',
				tag: tag,
			})
			.catch(function() {
				return { data: { body: undefined } };
			});

		// This is always a reply
		await respond(interaction, {
			embeds: [
				new EmbedBuilder()
					.setColor(default_color)
					.setTitle('Welcome to Paw and Paper!')
					.setDescription(`This bot has powerful tools to help make your roleplay more immersive, or to express your mental shifts.\nAdditionally, it features a community-driven RPG about animals surviving in the wild. Your goal is to go up the ranks, level up, find items, help your friends and keep your stats high.\n\nClick on the menu options below to get an overview of the available commands!\n**If you are new, start with \`/name (name)\`!**\n\n*Latest changes:*\n> ${release.data.body?.split('\n').slice(1, 4).join('\n> ') ?? '(Missing data)'}\n> [Full changelog](https://github.com/MaksiRose/paw-and-paper/releases/tag/${tag})`),
			],
			components: [buildPageSelect(user?.id ?? interaction.user.id)],
		});
		return;
	},
	async sendMessageComponentResponse(interaction) {

		if (!interaction.isStringSelectMenu()) { return; }
		const value = getArrayElement(interaction.values, 0);

		const titles = ['📝 Quid Customization', '🎲 Gameplay (Primary)', '🍗 Gameplay (Maintenance)', '👥 Interaction', '⚙️ Miscellaneous'];
		const titleNr = value.substring(value.length - 1);
		const title = `Page ${titleNr}: ${getArrayElement(titles, Number(titleNr) - 1)}`;

		const description = handle.slashCommands
			.filter(c => c.category === getArrayElement(value.split('_'), 1))
			.sort((c1, c2) => c1.position - c2.position)
			.map(c => {

				const subCommands = (c.data.options ?? []).filter(o => o.type <= 2).map(o => o.name).join('/');
				const options = (c.data.options ?? []).filter(o => o.type > 2).map(o => ` <${o.name}${o.required === true ? '' : '?'}>`).join('');
				return `**\`/${c.data.name}${subCommands.length > 0 ? ` ${subCommands}` : ''}\`**${options.length > 0 ? `\`${options}\`` : ''} - ${c.data.type === 1 || c.data.type === undefined ? c.data.description : 'No description'}`;
			})
			.join('\n');

		let fields: APIEmbedField[] = [];
		if (titleNr === '5') {

			const maksiUser = await client.users.fetch('268402976844939266').catch(() => { return null; });
			const ezraUser = await client.users.fetch('669725936840736840').catch(() => { return null; });
			const renUser = await client.users.fetch('794320272723410955').catch(() => { return null; });
			const jagsUser = await client.users.fetch('840108230176145410').catch(() => { return null; });
			const elliottUser = await client.users.fetch('422145578676256779').catch(() => { return null; });
			const hazenithUser = await client.users.fetch('708943555305144367').catch(() => { return null; });
			const johannaUser = await client.users.fetch('442125304794841099').catch(() => { return null; });
			const skyUser = await client.users.fetch('642963515098923015').catch(() => { return null; });
			const asrielUser = await client.users.fetch('625469376145129502').catch(() => { return null; });

			fields = [
				{ name: '\n**__CREDITS:__**', value: `This bot was made with love by **${maksiUser?.tag}**. Special thanks goes out to:\n\`${elliottUser?.tag}\` - RPG texts, testing, ideas\n\`${ezraUser?.tag}\` - RPG texts, testing\n\`${hazenithUser?.tag}\` - testing, ideas\n\`${skyUser?.tag}\` - testing, \`${asrielUser?.tag}\` - ideas, \`${renUser?.tag}\` - RPG texts\n\`${jagsUser?.tag}\` - drawing the profile picture, \`${johannaUser?.tag}\` - drawing the ginkgo tree.\n\nThis bot was originally created for a Discord server called [Rushing River Pack](https://disboard.org/server/854522091328110595). If you are therian, otherkin, or supporter of those, you are welcome to join.` },
				{ name: '\n**__OTHER:__**', value: `Uptime: ${Math.floor(interaction.client.uptime / 3600000)} hours ${Math.floor(interaction.client.uptime / 60000) % 60} minutes\nPing: ${client.ws.ping} ms\nServer count: ${client.guilds.cache.size}\nVersion: ${version}` },
			];
		}

		// This is always an update to the message with the select menu
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle(title)
				.setDescription(description)
				.setFields(fields)],
			components: [
				interaction.message.components[0] ?? buildPageSelect(interaction.user.id),
				...titleNr === '5' ? [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([
						new ButtonBuilder()
							.setStyle(ButtonStyle.Link)
							.setURL('https://discord.gg/9DENgj8q5Q')
							.setLabel('Support Server'),
						new ButtonBuilder()
							.setStyle(ButtonStyle.Link)
							.setURL('https://streamlabs.com/maksirose/tip')
							.setLabel('Donate'),
						new ButtonBuilder()
							.setStyle(ButtonStyle.Link)
							.setURL('https://github.com/MaksiRose/paw-and-paper')
							.setLabel('Source Code'),
						new ButtonBuilder()
							.setStyle(ButtonStyle.Link)
							.setURL('https://github.com/MaksiRose/paw-and-paper/blob/stable/Terms%20of%20Service.md')
							.setLabel('ToS'),
						new ButtonBuilder()
							.setStyle(ButtonStyle.Link)
							.setURL('https://github.com/MaksiRose/paw-and-paper/blob/stable/Privacy%20Policy.md')
							.setLabel('Privacy Policy'),
					])] : [],
			],
		}, 'update', interaction.message.id);

		return;

	},
};

function buildPageSelect(
	userId: string,
) {
	return new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents([
			new StringSelectMenuBuilder()
				.setCustomId(`help_options_@${userId}`)
				.setPlaceholder('Select a page')
				.setOptions([
					{ label: 'Page 1', value: 'help_page1', description: 'Quid Customization', emoji: '📝' },
					{ label: 'Page 2', value: 'help_page2', description: 'Gameplay (Primary)', emoji: '🎲' },
					{ label: 'Page 3', value: 'help_page3', description: 'Gameplay (Maintenance)', emoji: '🍗' },
					{ label: 'Page 4', value: 'help_page4', description: 'Interaction', emoji: '👥' },
					{ label: 'Page 5', value: 'help_page5', description: 'Miscellaneous', emoji: '⚙️' },
				]),
		]);
}