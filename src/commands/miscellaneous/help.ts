import { ActionRowBuilder, APIEmbedField, EmbedBuilder, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { getArrayElement, respond, update } from '../../utils/helperFunctions';
import { CustomClient, SlashCommand } from '../../typedef';

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
	sendCommand: async (client, interaction, userData) => {

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle('Welcome to Paw and Paper!')
				.setDescription('This bot has powerful tools to help make your roleplay more immersive, or to express your mental shifts.\nAdditionally, it features a community-driven RPG about animals surviving in the wild. Your goal is to go up the ranks, level up, find items, help your friends and keep your stats high.\n\nClick on the menu options below to get an overview of the available commands!\n**If you are new, start with `/name (name)`!**')],
			components: [new ActionRowBuilder<SelectMenuBuilder>()
				.setComponents([new SelectMenuBuilder()
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
};

export async function helpInteractionCollector(
	client: CustomClient,
	interaction: SelectMenuInteraction,
): Promise<void> {

	const value = getArrayElement(interaction.values, 0);

	const titles = ['📝 Quid Customization', '🎲 Gameplay (Primary)', '🍗 Gameplay (Maintenance)', '👥 Interaction', '⚙️ Miscellaneous'];
	const titleNr = value.substring(value.length - 1);
	const title = `Page ${titleNr}: ${getArrayElement(titles, Number(titleNr) - 1)}`;

	const description = client.slashCommands
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
	if (interaction.values[0] === 'help_page1') {

		await update(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle('Page 1: 📝 Quid Customization')
				.setDescription('**`/name`** - Start your adventure! (Re-)name a quid.\n**`/species`** - Change your quid\'s species or displayed species.\n**`/pronouns`** - Choose the pronouns you are using during roleplay.\n**`/avatar`** - Choose an avatar for your quid.\n**`/color`** - Enter a valid hex code to give your messages and profile that color.\n**`/description`** - Give a more detailed description of your quid.\n**`/proxy`** - Add a proxy or autoproxy for your quid.\n**`/nickname`** - A global or server-specific replacement for your regular name.\n**`/tag`** - A global or server-specific snippet of text appended to your display name.\n**`/profile`** - Look up all the available info about a quid or change the quid you are using.\n**`/delete`** - Delete parts of or your entire account.')],
		});
		return;

	}

	if (interaction.values[0] === 'help_page2') {

		await update(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle('Page 2: 🎲 Gameplay (Primary)')
				.setDescription('**`/play`** - The main activity of Younglings. Costs energy, but gives XP.\n**`/practice`** - Practice fighting in a safe environment. Not available to Younglings.\n**`/explore`** - The main activity of every rank above Younglings. Find meat and herbs. Costs energy, but gives XP. __Not available to Younglings.__\n**`/scavenge`** - Scavenge for carcass and materials. Costs energy, but gives XP. __Not available to Younglings.__\n**`/travel-regions`** - Go to a specific region in your pack.\n**`/attack`** - If humans are attacking the pack, you can fight back using this command.\n**`/recover`** - If the pack has no herbs to heal an injury, you can recover your injury using this command.\n**`/start-quest`** - Get quests by playing (as Youngling) or exploring. Start them with this command.\n**`/rank-up`** - Once you successfully finished a quest, you can move up a rank using this command.')],
		});
		return;

	}

	if (interaction.values[0] === 'help_page3') {

		await update(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle('Page 3: 🍗 Gameplay (Maintenance)')
				.setDescription('**`/stats`** - Quick view of your quids condition.\n**`/inventory`** - This is a collection of all the things your pack has gathered, listed up.\n**`/store`** - Take items you have gathered for your pack, and put them in the pack inventory.\n**`/eat`** - Take the appropriate food for your species out of the packs food pile and fill up your hunger meter.\n**`/drink`** - Drink some water and fill up your thirst meter.\n**`/rest`** - Get some sleep and fill up your energy meter. Takes some time to refill.\n**`/vote`** - Vote for this bot on one of three websites and get +30 energy each time.\n**`/heal`** - Heal your packmates. Costs energy, but gives XP. __Not available to Younglings. More effective on others than on yourself. More effective for Healers and Elderlies.__\n**`/repair`** - Repair dens. Costs energy, but gives XP. __Not available to Younglings. More effective for Hunters and Elderlies.__\n**`/water-tree`** - If you have a ginkgo sapling, you can water it using this command.')],
		});
		return;

	}

	if (interaction.values[0] === 'help_page4') {

		await update(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle('Page 4: 👥 Interaction')
				.setDescription('**`/adventure`** - Go adventuring with a friend. Requires 6 friendship hearts.\n**`/share`** - Mention someone to share a story or anecdote. Costs energy, but gives XP to the other person. __Only available to elderlies.__\n**`/playfight`** - You can play Connect Four or Tic Tac Toe.\n**`/say`** - Sends a message as if your quid was saying it.\n**`/hug`** - Hug someone, if they consent.\n**`/profilelist`** - View a list of all the profiles that exist on this server.\n**`/friendships`** - View a list of all the friendships that you have with other players.\n**`/roll`** - Roll dices.\n**`/skills`** - Show a list of or edit custom skills/ability scores.')],
		});
		return;
	}

	if (interaction.values[0] === 'help_page5') {

		const maksiUser = await client.users
			.fetch(maksi)
			.catch(() => { return null; });

		const ezraUser = await client.users
			.fetch(ezra)
			.catch(() => { return null; });

		const renUser = await client.users
			.fetch(ren)
			.catch(() => { return null; });

		const jagsUser = await client.users
			.fetch(jags)
			.catch(() => { return null; });

		const elliottUser = await client.users
			.fetch(elliott)
			.catch(() => { return null; });

		const hazenithUser = await client.users
			.fetch(hazenith)
			.catch(() => { return null; });

		const johannaUser = await client.users
			.fetch(johanna)
			.catch(() => { return null; });

		const skyUser = await client.users
			.fetch(sky)
			.catch(() => { return null; });

		const asrielUser = await client.users
			.fetch(asriel)
			.catch(() => { return null; });

		await update(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle('Page 5: ⚙️ Miscellaneous')
				.setDescription('**`/shop`** - Buy roles with experience points.\n**`/server-settings`** - List of server-specific settings like shop roles, update notifications and more.\n**`/ticket`** - Report a bug, give feedback, suggest a feature!')
				.setFields([
					{ name: '\n**__CREDITS:__**', value: `This bot was made with love by **${maksiUser?.tag}**. Special thanks goes out to:\n\`${elliottUser?.tag}\` - RPG texts, testing, ideas\n\`${ezraUser?.tag}\` - RPG texts, testing\n\`${hazenithUser?.tag}\` - testing, ideas\n\`${skyUser?.tag}\` - testing, \`${asrielUser?.tag}\` - ideas, \`${renUser?.tag}\` - RPG texts\n\`${jagsUser?.tag}\` - drawing the profile picture, \`${johannaUser?.tag}\` - drawing the ginkgo tree.\n\nThis bot was originally created for a Discord server called [Rushing River Pack](https://disboard.org/server/854522091328110595). If you are therian, otherkin, or supporter of those, you are welcome to join.` },
					{ name: '\n**__OTHER:__**', value: `If you want to support me, you can donate [here](https://streamlabs.com/maksirose/tip)! :)\nYou can find the GitHub repository for this project [here](https://github.com/MaksiRose/paw-and-paper).\nBy using this bot, you agree to its [Terms and Service](https://github.com/MaksiRose/paw-and-paper/blob/stable/Terms%20of%20Service.md) and [Privacy Policy](https://github.com/MaksiRose/paw-and-paper/blob/stable/Privacy%20Policy.md).\nThe bot is currently running on version ${version}.` },
				])],
		});
		return;
	}
}