import { ActionRowBuilder, APIEmbedField, EmbedBuilder, StringSelectMenuBuilder, SlashCommandBuilder } from 'discord.js';
import { getArrayElement, respond, update } from '../../utils/helperFunctions';
import { client, handle } from '../..';
import { SlashCommand } from '../../typings/handle';

const { default_color, maksi, ezra, ren, jags, elliott, hazenith, johanna, sky, asriel } = require('../../../config.json');
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
	sendCommand: async (interaction, userData) => {

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle('Welcome to Paw and Paper!')
				.setDescription('This bot has powerful tools to help make your roleplay more immersive, or to express your mental shifts.\nAdditionally, it features a community-driven RPG about animals surviving in the wild. Your goal is to go up the ranks, level up, find items, help your friends and keep your stats high.\n\nClick on the menu options below to get an overview of the available commands!\n**If you are new, start with `/name (name)`!**')],
			components: [new ActionRowBuilder<StringSelectMenuBuilder>()
				.setComponents([new StringSelectMenuBuilder()
					.setCustomId(`help_options_@${userData?._id ?? interaction.user.id}`)
					.setPlaceholder('Select a page')
					.setOptions([
						{ label: 'Page 1', value: 'help_page1', description: 'Quid Customization', emoji: '📝' },
						{ label: 'Page 2', value: 'help_page2', description: 'Gameplay (Primary)', emoji: '🎲' },
						{ label: 'Page 3', value: 'help_page3', description: 'Gameplay (Maintenance)', emoji: '🍗' },
						{ label: 'Page 4', value: 'help_page4', description: 'Interaction', emoji: '👥' },
						{ label: 'Page 5', value: 'help_page5', description: 'Miscellaneous', emoji: '⚙️' },
					])])],
		}, true);
		return;
	},
	async sendMessageComponentResponse(interaction) {

		if (!interaction.isSelectMenu()) { return; }
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

			const maksiUser = await client.users.fetch(maksi).catch(() => { return null; });
			const ezraUser = await client.users.fetch(ezra).catch(() => { return null; });
			const renUser = await client.users.fetch(ren).catch(() => { return null; });
			const jagsUser = await client.users.fetch(jags).catch(() => { return null; });
			const elliottUser = await client.users.fetch(elliott).catch(() => { return null; });
			const hazenithUser = await client.users.fetch(hazenith).catch(() => { return null; });
			const johannaUser = await client.users.fetch(johanna).catch(() => { return null; });
			const skyUser = await client.users.fetch(sky).catch(() => { return null; });
			const asrielUser = await client.users.fetch(asriel).catch(() => { return null; });

			fields = [
				{ name: '\n**__CREDITS:__**', value: `This bot was made with love by **${maksiUser?.tag}**. Special thanks goes out to:\n\`${elliottUser?.tag}\` - RPG texts, testing, ideas\n\`${ezraUser?.tag}\` - RPG texts, testing\n\`${hazenithUser?.tag}\` - testing, ideas\n\`${skyUser?.tag}\` - testing, \`${asrielUser?.tag}\` - ideas, \`${renUser?.tag}\` - RPG texts\n\`${jagsUser?.tag}\` - drawing the profile picture, \`${johannaUser?.tag}\` - drawing the ginkgo tree.\n\nThis bot was originally created for a Discord server called [Rushing River Pack](https://disboard.org/server/854522091328110595). If you are therian, otherkin, or supporter of those, you are welcome to join.` },
				{ name: '\n**__OTHER:__**', value: `If you want to support me, you can donate [here](https://streamlabs.com/maksirose/tip)! :)\nYou can find the GitHub repository for this project [here](https://github.com/MaksiRose/paw-and-paper).\nBy using this bot, you agree to its [Terms and Service](https://github.com/MaksiRose/paw-and-paper/blob/stable/Terms%20of%20Service.md) and [Privacy Policy](https://github.com/MaksiRose/paw-and-paper/blob/stable/Privacy%20Policy.md).\nThe bot is currently running on version ${version}.` },
			];

		}

		await update(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle(title)
				.setDescription(description)
				.setFields(fields)],
		});

		return;

	},
};