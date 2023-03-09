import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, StringSelectMenuBuilder, SlashCommandBuilder, Snowflake, StringSelectMenuInteraction } from 'discord.js';
import { Op } from 'sequelize';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CurrentRegionType, RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { respond, valueInObject } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { sendDrinkMessage } from '../gameplay_maintenance/drink';
import { getHealResponse } from '../gameplay_maintenance/heal';
import { showInventoryMessage } from '../gameplay_maintenance/inventory';
import { executeResting } from '../gameplay_maintenance/rest';
import { sendStoreMessage } from '../gameplay_maintenance/store';
import { remindOfAttack } from './attack';
import { executePlaying } from './play';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('travel-regions')
		.setDescription('Go to a specific region in your pack, and see who else is there.')
		.addStringOption(option =>
			option.setName('region')
				.setDescription('The region you want to travel to.')
				.setChoices(
					{ name: CurrentRegionType.SleepingDens, value: CurrentRegionType.SleepingDens },
					{ name: CurrentRegionType.FoodDen, value: CurrentRegionType.FoodDen },
					{ name: CurrentRegionType.MedicineDen, value: CurrentRegionType.MedicineDen },
					{ name: CurrentRegionType.Ruins, value: CurrentRegionType.Ruins },
					{ name: CurrentRegionType.Lake, value: CurrentRegionType.Lake },
					{ name: CurrentRegionType.Prairie, value: CurrentRegionType.Prairie },
				)
				.setRequired(false))

		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 4,
	disablePreviousCommand: true,
	modifiesServerProfile: false, // This is technically true, but it's set to false because it does not necessarily reflect your actual activity
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler in sendQuestMessage
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('server is null'); }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);
		const chosenRegion = interaction.options.getString('region');

		const id = await sendTravelMessage(interaction, user, quid, userToServer, quidToServer, messageContent, restEmbed, chosenRegion);
		saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, id);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server, discordUser }) {

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('server is null'); }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		const messageContent = interaction.message.content;
		const restEmbed = interaction.message.embeds.slice(0, -1).map(c => new EmbedBuilder(c.toJSON()));

		if (interaction.isButton()) {

			if (interaction.customId.includes('rest')) {

				await executeResting(interaction, userData, serverData);
			}
			else if (interaction.customId.includes('inventory')) {

				await showInventoryMessage(interaction, userToServer, quidToServer, server, 1);
			}
			else if (interaction.customId.includes('store')) {

				await sendStoreMessage(interaction, user, quid, userToServer, quidToServer, server, restEmbed);
			}
			else if (interaction.customId.includes('heal')) {

				await getHealResponse(interaction, userData, serverData, messageContent, restEmbed, 0);
			}
			else if (interaction.customId.includes('drink')) {

				await sendDrinkMessage(interaction, user, userToServer, quid, quidToServer, messageContent, restEmbed);
			}
			else if (interaction.customId.includes('play')) {

				if (discordUser === undefined) { throw new TypeError('discordUser is undefined'); }
				await executePlaying(interaction, { user, quid, userToServer, quidToServer, discordUser }, server, { forceEdit: true });
			}
		}
		else if (interaction.isStringSelectMenu()) {

			await sendTravelMessage(interaction, user, quid, userToServer, quidToServer, '', restEmbed, interaction.values[0] ?? null);
		}

	},
};

async function sendTravelMessage(
	interaction: ChatInputCommandInteraction<'cached'> | StringSelectMenuInteraction<'cached'>,
	user: User,
	quid: Quid,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	messageContent: string,
	restEmbed: EmbedBuilder[],
	chosenRegion: string | null,
): Promise<Snowflake> {

	const embed = new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});
	const travelComponent = new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`travel-regions_options_@${user.id}`)
			.setPlaceholder('Select a region to travel to')
			.setOptions([
				{ label: CurrentRegionType.SleepingDens, value: CurrentRegionType.SleepingDens, emoji: '💤' },
				{ label: CurrentRegionType.FoodDen, value: CurrentRegionType.FoodDen, emoji: '🍖' },
				{ label: CurrentRegionType.MedicineDen, value: CurrentRegionType.MedicineDen, emoji: '🌿' },
				{ label: CurrentRegionType.Ruins, value: CurrentRegionType.Ruins, emoji: '🏛️' },
				{ label: CurrentRegionType.Lake, value: CurrentRegionType.Lake, emoji: '🌊' },
				{ label: CurrentRegionType.Prairie, value: CurrentRegionType.Prairie, emoji: '🌼' },
			]),
		);

	if (chosenRegion && valueInObject(CurrentRegionType, chosenRegion)) {

		await quidToServer.update({ currentRegion: chosenRegion });
	}

	if (chosenRegion === CurrentRegionType.SleepingDens) {

		embed.setDescription(`*${quid.name} slowly trots to the sleeping dens, tired from all the hard work ${pronoun(quid, 0)} did. For a moment, the ${getDisplayspecies(quid)} thinks about if ${pronounAndPlural(quid, 0, 'want')} to rest or just a break.*`);

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`travel-regions_rest_@${user.id}`)
					.setLabel('Rest')
					.setStyle(ButtonStyle.Primary))],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.FoodDen) {

		embed.setDescription(`*${quid.name} runs to the food den. Maybe ${pronoun(quid, 0)} will eat something, or put ${pronoun(quid, 2)} food onto the pile.*`);

		const foodDenQuidsToServer = await QuidToServer.findAll({ where: { currentRegion: CurrentRegionType.FoodDen } });
		const foodDenQuids = await Quid.findAll({ where: { id: { [Op.in]: foodDenQuidsToServer.map(qts => qts.quidId) } } });
		const foodDenUsers = await User.findAll({ where: { id: { [Op.in]: foodDenQuids.map(q => q.userId) } } });

		let foodDenDiscordUsersList = '';
		for (const foodDenUser of foodDenUsers) {

			const discordUsers = await DiscordUser.findAll({ where: { userId: foodDenUser.id } });
			const discordUserToServer = await DiscordUserToServer.findOne({
				where: {
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
					serverId: interaction.guildId,
				},
			});

			if (discordUserToServer) {

				const discordUserMention = `<@${discordUserToServer.discordUserId}>\n`;
				if ((foodDenDiscordUsersList + discordUserMention).length > 1024) { break; }
				else { foodDenDiscordUsersList += discordUserMention; }
			}
		}

		if (foodDenDiscordUsersList.length > 0) { embed.addFields({ name: 'Packmates at the food den:', value: foodDenDiscordUsersList }); }

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(`travel-regions_inventory_@${user.id}`)
						.setLabel('View inventory')
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId(`travel-regions_store_@${user.id}`)
						.setLabel('Store items away')
						.setStyle(ButtonStyle.Primary),
				])],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.MedicineDen) {

		embed.setDescription(`*${quid.name} rushes over to the medicine den. Nearby are a mix of packmates, some with illnesses and injuries, others trying to heal them.*`);

		const medicineDenQuidsToServer = await QuidToServer.findAll({ where: { currentRegion: CurrentRegionType.MedicineDen } });
		const medicineDenQuids = await Quid.findAll({ where: { id: { [Op.in]: medicineDenQuidsToServer.map(qts => qts.quidId) } } });
		const medicineDenUsers = await User.findAll({ where: { id: { [Op.in]: medicineDenQuids.map(q => q.userId) } } });

		let medicineDenDiscordUsersList = '';
		for (const medicineDenUser of medicineDenUsers) {

			const discordUsers = await DiscordUser.findAll({ where: { userId: medicineDenUser.id } });
			const discordUserToServer = await DiscordUserToServer.findOne({
				where: {
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
					serverId: interaction.guildId,
				},
			});

			if (discordUserToServer) {

				const discordUserMention = `<@${discordUserToServer.discordUserId}>\n`;
				if ((medicineDenDiscordUsersList + discordUserMention).length > 1024) { break; }
				else { medicineDenDiscordUsersList += discordUserMention; }
			}
		}

		if (medicineDenDiscordUsersList.length > 0) { embed.addFields({ name: 'Packmates at the medicine den:', value: medicineDenDiscordUsersList }); }

		const healerQuidsToServer = await QuidToServer.findAll({ where: { rank: { [Op.not]: RankType.Youngling } } });
		const healerQuids = await Quid.findAll({ where: { id: { [Op.in]: healerQuidsToServer.map(qts => qts.quidId) } } });
		const healerUsers = await User.findAll({ where: { id: { [Op.in]: healerQuids.map(q => q.userId) } } });

		let healerDiscordUsersList = '';
		for (const healerUser of healerUsers) {

			const discordUsers = await DiscordUser.findAll({ where: { userId: healerUser.id } });
			const discordUserToServer = await DiscordUserToServer.findOne({
				where: {
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
					serverId: interaction.guildId,
				},
			});

			if (discordUserToServer) {

				const discordUserMention = `<@${discordUserToServer.discordUserId}>\n`;
				if ((healerDiscordUsersList + discordUserMention).length > 1024) { break; }
				else { healerDiscordUsersList += discordUserMention; }
			}
		}

		if (healerDiscordUsersList.length > 0) { embed.addFields({ name: 'Packmates that can heal:', value: healerDiscordUsersList }); }

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [
				travelComponent,
				...(quidToServer.rank === RankType.Youngling ? [] : [new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(`travel-regions_heal_@${user.id}`)
						.setLabel('Heal')
						.setStyle(ButtonStyle.Primary))]),
			],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.Ruins) {

		embed.setDescription(`*${quid.name} walks up to the ruins, carefully stepping over broken bricks. Hopefully, ${pronoun(quid, 0)} will find someone to talk with.*`);

		const ruinsQuidsToServer = await QuidToServer.findAll({ where: { currentRegion: CurrentRegionType.Ruins } });
		const ruinsQuids = await Quid.findAll({ where: { id: { [Op.in]: ruinsQuidsToServer.map(qts => qts.quidId) } } });
		const ruinsUsers = await User.findAll({ where: { id: { [Op.in]: ruinsQuids.map(q => q.userId) } } });

		let ruinsDiscordUsersList = '';
		for (const ruinsUser of ruinsUsers) {

			const discordUsers = await DiscordUser.findAll({ where: { userId: ruinsUser.id } });
			const discordUserToServer = await DiscordUserToServer.findOne({
				where: {
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
					serverId: interaction.guildId,
				},
			});

			if (discordUserToServer) {

				const discordUserMention = `<@${discordUserToServer.discordUserId}>\n`;
				if ((ruinsDiscordUsersList + discordUserMention).length > 1024) { break; }
				else { ruinsDiscordUsersList += discordUserMention; }
			}
		}

		if (ruinsDiscordUsersList.length > 0) { embed.addFields({ name: 'Packmates at the ruins:', value: ruinsDiscordUsersList }); }

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.Lake) {

		embed.setDescription(`*${quid.name} looks at ${pronoun(quid, 2)} reflection as ${pronounAndPlural(quid, 0, 'passes', 'pass')} the lake. Suddenly the ${getDisplayspecies(quid)} remembers how long ${pronounAndPlural(quid, 0, 'has', 'have')}n't drunk anything.*`);

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`travel-regions_drink_@${user.id}`)
					.setLabel('Drink')
					.setStyle(ButtonStyle.Primary))],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else if (chosenRegion === CurrentRegionType.Prairie) {

		embed.setDescription(`*${quid.name} approaches the prairie, watching younger packmates testing their strength in playful fights. Maybe the ${getDisplayspecies(quid)} could play with them!*`);

		const prairieQuidsToServer = await QuidToServer.findAll({ where: { currentRegion: CurrentRegionType.Prairie } });
		const prairieQuids = await Quid.findAll({ where: { id: { [Op.in]: prairieQuidsToServer.map(qts => qts.quidId) } } });
		const prairieUsers = await User.findAll({ where: { id: { [Op.in]: prairieQuids.map(q => q.userId) } } });

		let prairieDiscordUsersList = '';
		for (const prairieUser of prairieUsers) {

			const discordUsers = await DiscordUser.findAll({ where: { userId: prairieUser.id } });
			const discordUserToServer = await DiscordUserToServer.findOne({
				where: {
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
					serverId: interaction.guildId,
				},
			});

			if (discordUserToServer) {

				const discordUserMention = `<@${discordUserToServer.discordUserId}>\n`;
				if ((prairieDiscordUsersList + discordUserMention).length > 1024) { break; }
				else { prairieDiscordUsersList += discordUserMention; }
			}
		}

		if (prairieDiscordUsersList.length > 0) { embed.addFields({ name: 'Packmates at the prairie:', value: prairieDiscordUsersList }); }

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent, new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`travel-regions_play_@${user.id}`)
					.setLabel('Play')
					.setStyle(ButtonStyle.Primary))],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : '@original')).id;
	}
	else {

		embed.setDescription(`You are currently at the ${quidToServer.currentRegion}! Here are the regions you can go to:`);
		embed.setFields([
			{ name: '💤 sleeping dens', value: 'A place to sleep and relax. Go here if you need to refill your energy!' },
			{ name: '🍖 food den', value: 'Inspect all the food the pack has gathered, eat some or add to it from your inventory!' },
			{ name: '🌿 medicine den', value: 'Go here if you need to be healed. Someone will come and help you.' },
			{ name: '🏛️ ruins', value: 'These old stones are a little creepy at night, but at day packmates frequently gather here to talk and meet up.' },
			{ name: '🌊 lake', value: 'Not only do some aquatic packmates live here, but it is also the primary source of fresh water, in case someone is thirsty.' },
			{ name: '🌼 prairie', value: 'This is where the Younglings go to play! Everyone else can also come here and play with them.' },
		]);

		return (await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [travelComponent],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined)).id;
	}
}